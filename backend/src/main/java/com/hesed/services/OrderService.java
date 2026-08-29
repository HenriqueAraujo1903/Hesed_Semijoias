package com.hesed.services;

import com.hesed.dto.OrderRequest;
import com.hesed.dto.OrderResponse;
import com.hesed.dto.OrderUpdateRequest;
import com.hesed.models.Order;
import com.hesed.models.OrderItem;
import com.hesed.models.Product;
import com.hesed.models.Promotion;
import com.hesed.repositories.OrderRepository;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.PromotionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Random;
import java.util.UUID;

@Service
public class OrderService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final Random RANDOM = new Random();

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final PromotionRepository promotionRepository;

    public OrderService(OrderRepository orderRepository,
                        ProductRepository productRepository,
                        PromotionRepository promotionRepository) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.promotionRepository = promotionRepository;
    }

    /**
     * Cria um pedido a partir dos produtos selecionados no catálogo.
     * Faz snapshot de preço e promoção de cada item NO MOMENTO do pedido.
     */
    @Transactional
    public OrderResponse create(OrderRequest request) {
        LocalDateTime now = LocalDateTime.now();

        Order order = Order.builder()
                .orderNumber(resolveOrderNumber(request.getOrderNumber()))
                .status("PENDENTE")
                .channel("WHATSAPP")
                .orderedAt(now)
                .notes(request.getNotes())
                .build();

        for (UUID productId : request.getProductIds()) {
            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new RuntimeException("Produto não encontrado: " + productId));
            order.getItems().add(buildSnapshotItem(order, product, 1, null, now));
        }

        recalcTotal(order);
        return OrderResponse.from(orderRepository.save(order));
    }

    /**
     * Edita um pedido PENDENTE: itens (qtd, preço), dados do cliente e notas.
     * Pedidos já resolvidos (CONFIRMADO/CANCELADO) são imutáveis.
     */
    @Transactional
    public OrderResponse update(UUID id, OrderUpdateRequest request) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Pedido não encontrado."));

        if (!"PENDENTE".equals(order.getStatus())) {
            throw new RuntimeException("Apenas pedidos pendentes podem ser editados.");
        }

        LocalDateTime now = LocalDateTime.now();

        // Reconstrói a lista de itens a partir do request (orphanRemoval limpa os antigos)
        order.getItems().clear();
        for (OrderUpdateRequest.Item reqItem : request.getItems()) {
            if (reqItem.getProductId() == null) {
                throw new RuntimeException("Item sem produto informado.");
            }
            Product product = productRepository.findById(reqItem.getProductId())
                    .orElseThrow(() -> new RuntimeException("Produto não encontrado: " + reqItem.getProductId()));

            int qty = (reqItem.getQuantity() != null && reqItem.getQuantity() >= 1) ? reqItem.getQuantity() : 1;
            order.getItems().add(buildSnapshotItem(order, product, qty, reqItem.getEffectivePrice(), now));
        }

        order.setCustomerName(trimToNull(request.getCustomerName()));
        order.setCustomerPhone(trimToNull(request.getCustomerPhone()));
        order.setNotes(trimToNull(request.getNotes()));

        recalcTotal(order);
        return OrderResponse.from(orderRepository.save(order));
    }

    public List<OrderResponse> findAll(String status) {
        return orderRepository.findByStatusFiltered(status)
                .stream()
                .map(OrderResponse::from)
                .toList();
    }

    @Transactional
    public OrderResponse updateStatus(UUID id, String newStatus) {
        String normalized = newStatus == null ? "" : newStatus.trim().toUpperCase();
        if (!List.of("PENDENTE", "CONFIRMADO", "CANCELADO").contains(normalized)) {
            throw new RuntimeException("Status inválido: " + newStatus);
        }

        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Pedido não encontrado."));

        // Nome do cliente é obrigatório para confirmar a venda
        if (normalized.equals("CONFIRMADO")
                && (order.getCustomerName() == null || order.getCustomerName().isBlank())) {
            throw new RuntimeException("Informe o nome do cliente antes de confirmar a venda.");
        }

        order.setStatus(normalized);
        order.setResolvedAt(normalized.equals("PENDENTE") ? null : LocalDateTime.now());

        return OrderResponse.from(orderRepository.save(order));
    }

    public long countByStatus(String status) {
        return orderRepository.countByStatus(status);
    }

    // ---- helpers ----

    /** Constrói um OrderItem com snapshot de produto/promoção. Se overridePrice
     *  for informado, usa-o como effectivePrice (negociação manual). */
    private OrderItem buildSnapshotItem(Order order, Product product, int quantity,
                                        BigDecimal overridePrice, LocalDateTime now) {
        List<Promotion> activePromos = promotionRepository.findActiveByProduct(product.getId(), now);
        Promotion promo = activePromos.isEmpty() ? null : activePromos.get(0);

        BigDecimal unitPrice = product.getSalePrice();
        BigDecimal effectivePrice = unitPrice;
        boolean wasPromotion = false;
        BigDecimal discountPercent = null;

        if (promo != null) {
            wasPromotion = true;
            discountPercent = promo.getDiscountPercent();
            if (promo.getPromoPrice() != null) {
                effectivePrice = promo.getPromoPrice();
            } else if (promo.getDiscountPercent() != null) {
                BigDecimal factor = BigDecimal.ONE.subtract(
                        promo.getDiscountPercent().divide(BigDecimal.valueOf(100)));
                effectivePrice = unitPrice.multiply(factor);
            }
        }

        // Preço negociado manualmente sobrepõe o cálculo automático
        if (overridePrice != null && overridePrice.signum() >= 0) {
            effectivePrice = overridePrice;
        }

        return OrderItem.builder()
                .order(order)
                .product(product)
                .productSku(product.getSku())
                .productName(product.getName())
                .productCategory(product.getCategory())
                .unitPrice(unitPrice)
                .effectivePrice(effectivePrice)
                .costPrice(product.getCostPrice())
                .quantity(quantity)
                .wasPromotion(wasPromotion)
                .discountPercent(discountPercent)
                .build();
    }

    /** Total = soma de (effectivePrice * quantity) de cada item. */
    private void recalcTotal(Order order) {
        BigDecimal total = BigDecimal.ZERO;
        for (OrderItem item : order.getItems()) {
            int qty = item.getQuantity() != null ? item.getQuantity() : 1;
            total = total.add(item.getEffectivePrice().multiply(BigDecimal.valueOf(qty)));
        }
        order.setTotalAmount(total);
    }

    private String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private String resolveOrderNumber(String requested) {
        if (requested != null && !requested.isBlank() && !orderRepository.existsByOrderNumber(requested)) {
            return requested;
        }
        return generateUniqueOrderNumber();
    }

    private String generateUniqueOrderNumber() {
        String candidate;
        do {
            String date = LocalDateTime.now().format(DATE_FMT);
            int random = 1000 + RANDOM.nextInt(9000);
            candidate = "HSD-" + date + "-" + random;
        } while (orderRepository.existsByOrderNumber(candidate));
        return candidate;
    }
}
