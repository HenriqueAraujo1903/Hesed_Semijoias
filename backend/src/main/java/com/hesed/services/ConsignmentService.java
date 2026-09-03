package com.hesed.services;

import com.hesed.dto.ConsignmentRequest;
import com.hesed.dto.ConsignmentResponse;
import com.hesed.dto.ConsignmentSettleRequest;
import com.hesed.models.Consignee;
import com.hesed.models.Consignment;
import com.hesed.models.ConsignmentItem;
import com.hesed.models.Product;
import com.hesed.repositories.ConsigneeRepository;
import com.hesed.repositories.ConsignmentRepository;
import com.hesed.repositories.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ConsignmentService {

    private final ConsignmentRepository consignmentRepository;
    private final ConsigneeRepository consigneeRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final OrderService orderService;

    public ConsignmentService(ConsignmentRepository consignmentRepository,
                              ConsigneeRepository consigneeRepository,
                              ProductRepository productRepository,
                              StockService stockService,
                              OrderService orderService) {
        this.consignmentRepository = consignmentRepository;
        this.consigneeRepository = consigneeRepository;
        this.productRepository = productRepository;
        this.stockService = stockService;
        this.orderService = orderService;
    }

    public List<ConsignmentResponse> findAll(String status) {
        String st = (status != null && !status.isBlank()) ? status.trim().toUpperCase() : null;
        return consignmentRepository.findFiltered(st).stream().map(ConsignmentResponse::from).toList();
    }

    public ConsignmentResponse findById(UUID id) {
        return ConsignmentResponse.from(getWithItems(id));
    }

    /**
     * Abre um lote: valida a revendedora, define a comissão (do request ou da
     * revendedora), monta os itens e RESERVA o estoque de cada produto.
     */
    @Transactional
    public ConsignmentResponse open(ConsignmentRequest request) {
        Consignee consignee = consigneeRepository.findById(request.getConsigneeId())
                .orElseThrow(() -> new RuntimeException("Revendedora não encontrada."));

        BigDecimal commission = request.getCommissionRate() != null
                ? request.getCommissionRate() : consignee.getCommissionRate();

        Consignment c = Consignment.builder()
                .consignee(consignee)
                .status("ABERTO")
                .commissionRate(commission)
                .openedAt(LocalDateTime.now())
                .notes(request.getNotes())
                .build();

        for (ConsignmentRequest.Item reqItem : request.getItems()) {
            if (reqItem.getQuantity() == null || reqItem.getQuantity() < 1) {
                throw new RuntimeException("Quantidade inválida para um item do lote.");
            }
            Product product = productRepository.findById(reqItem.getProductId())
                    .orElseThrow(() -> new RuntimeException("Produto não encontrado: " + reqItem.getProductId()));

            BigDecimal price = reqItem.getUnitSalePrice() != null
                    ? reqItem.getUnitSalePrice() : product.getSalePrice();

            ConsignmentItem item = ConsignmentItem.builder()
                    .consignment(c)
                    .product(product)
                    .productSku(product.getSku())
                    .productName(product.getName())
                    .quantity(reqItem.getQuantity())
                    .soldQuantity(0)
                    .returnedQuantity(0)
                    .unitSalePrice(price)
                    .build();
            c.getItems().add(item);
        }

        Consignment saved = consignmentRepository.save(c);

        // Reserva o estoque de cada produto (disponível -> reservado).
        for (ConsignmentItem item : saved.getItems()) {
            stockService.reserve(item.getProduct().getId(), item.getQuantity(),
                    "Consignação " + shortId(saved.getId()) + " — " + consignee.getName());
        }

        return ConsignmentResponse.from(getWithItems(saved.getId()));
    }

    /**
     * Registra o acerto (quantidade vendida por item) num lote ABERTO, sem fechar.
     * Permite salvar o acerto parcial antes de fechar.
     */
    @Transactional
    public ConsignmentResponse settle(UUID id, ConsignmentSettleRequest request) {
        Consignment c = getWithItems(id);
        if (!"ABERTO".equals(c.getStatus())) {
            throw new RuntimeException("Apenas lotes abertos podem ser acertados.");
        }
        Map<UUID, Integer> soldByItem = request.getItems().stream()
                .collect(Collectors.toMap(ConsignmentSettleRequest.Item::getItemId,
                        ConsignmentSettleRequest.Item::getSoldQuantity));

        for (ConsignmentItem item : c.getItems()) {
            Integer sold = soldByItem.get(item.getId());
            if (sold == null) continue;
            if (sold < 0 || sold > item.getQuantity()) {
                throw new RuntimeException("Quantidade vendida inválida para " + item.getProductName()
                        + " (levado: " + item.getQuantity() + ").");
            }
            item.setSoldQuantity(sold);
        }
        consignmentRepository.save(c);
        return ConsignmentResponse.from(getWithItems(id));
    }

    /**
     * Fecha o lote: consome do estoque reservado o que foi vendido (baixa real),
     * libera de volta o que sobrou (devolvido), gera a venda CONSIGNADA (entra na
     * receita) e apura a comissão. Idempotente por status (só fecha ABERTO).
     */
    @Transactional
    public ConsignmentResponse close(UUID id, ConsignmentSettleRequest settle) {
        Consignment c = getWithItems(id);
        if (!"ABERTO".equals(c.getStatus())) {
            throw new RuntimeException("Este lote já foi fechado.");
        }

        // Aplica o acerto informado no fechamento (se veio) antes de fechar.
        if (settle != null && settle.getItems() != null) {
            Map<UUID, Integer> soldByItem = settle.getItems().stream()
                    .collect(Collectors.toMap(ConsignmentSettleRequest.Item::getItemId,
                            ConsignmentSettleRequest.Item::getSoldQuantity));
            for (ConsignmentItem item : c.getItems()) {
                Integer sold = soldByItem.get(item.getId());
                if (sold == null) continue;
                if (sold < 0 || sold > item.getQuantity()) {
                    throw new RuntimeException("Quantidade vendida inválida para " + item.getProductName()
                            + " (levado: " + item.getQuantity() + ").");
                }
                item.setSoldQuantity(sold);
            }
        }

        LocalDateTime now = LocalDateTime.now();
        BigDecimal totalSold = BigDecimal.ZERO;
        List<OrderService.ConsignmentSaleItem> saleItems = new ArrayList<>();

        for (ConsignmentItem item : c.getItems()) {
            int qty = item.getQuantity() != null ? item.getQuantity() : 0;
            int sold = item.getSoldQuantity() != null ? item.getSoldQuantity() : 0;
            int returned = qty - sold;
            item.setReturnedQuantity(returned);

            UUID pid = item.getProduct().getId();
            String tag = "Consignação " + shortId(c.getId());

            if (sold > 0) {
                stockService.consumeReserved(pid, sold, tag + " — venda", null);
                item.setSoldAt(now);
                BigDecimal price = item.getUnitSalePrice() != null ? item.getUnitSalePrice() : BigDecimal.ZERO;
                totalSold = totalSold.add(price.multiply(BigDecimal.valueOf(sold)));
                saleItems.add(new OrderService.ConsignmentSaleItem(pid, sold, price));
            }
            if (returned > 0) {
                stockService.releaseReservation(pid, returned, tag + " — devolução");
                item.setReturnedAt(now);
            }
        }

        // Gera a venda consignada (receita integrada, canal CONSIGNADO) se houve venda.
        if (!saleItems.isEmpty()) {
            orderService.createConsignmentSale(c.getConsignee().getName(), saleItems, now);
        }

        // Apura comissão do lote.
        BigDecimal rate = c.getCommissionRate() != null ? c.getCommissionRate() : BigDecimal.ZERO;
        BigDecimal commission = totalSold.multiply(rate).setScale(2, RoundingMode.HALF_UP);
        c.setTotalSold(totalSold.setScale(2, RoundingMode.HALF_UP));
        c.setCommissionAmount(commission);
        c.setNetAmount(totalSold.subtract(commission).setScale(2, RoundingMode.HALF_UP));
        c.setStatus("FECHADO");
        c.setClosedAt(now);

        consignmentRepository.save(c);
        return ConsignmentResponse.from(getWithItems(id));
    }

    /**
     * Cancela um lote ABERTO: libera todo o estoque reservado de volta e marca
     * como CANCELADO. Não gera venda nem comissão.
     */
    @Transactional
    public ConsignmentResponse cancel(UUID id) {
        Consignment c = getWithItems(id);
        if (!"ABERTO".equals(c.getStatus())) {
            throw new RuntimeException("Apenas lotes abertos podem ser cancelados.");
        }
        for (ConsignmentItem item : c.getItems()) {
            int qty = item.getQuantity() != null ? item.getQuantity() : 0;
            if (qty > 0) {
                stockService.releaseReservation(item.getProduct().getId(), qty,
                        "Consignação " + shortId(c.getId()) + " — cancelada");
            }
        }
        c.setStatus("CANCELADO");
        c.setClosedAt(LocalDateTime.now());
        consignmentRepository.save(c);
        return ConsignmentResponse.from(getWithItems(id));
    }

    private Consignment getWithItems(UUID id) {
        return consignmentRepository.findByIdWithItems(id)
                .orElseThrow(() -> new RuntimeException("Lote de consignação não encontrado."));
    }

    private static String shortId(UUID id) {
        return id.toString().substring(0, 8);
    }
}
