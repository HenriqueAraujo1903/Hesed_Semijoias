package com.hesed.services;

import com.hesed.dto.AdminOrderCreateRequest;
import com.hesed.dto.OrderRequest;
import com.hesed.dto.OrderResponse;
import com.hesed.dto.OrderUpdateRequest;
import com.hesed.models.Customer;
import com.hesed.models.Order;
import com.hesed.models.OrderItem;
import com.hesed.models.Product;
import com.hesed.models.Promotion;
import com.hesed.repositories.CustomerRepository;
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
    private final StockService stockService;
    private final CustomerRepository customerRepository;

    public OrderService(OrderRepository orderRepository,
                        ProductRepository productRepository,
                        PromotionRepository promotionRepository,
                        StockService stockService,
                        CustomerRepository customerRepository) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.promotionRepository = promotionRepository;
        this.stockService = stockService;
        this.customerRepository = customerRepository;
    }

    /**
     * Cria um pedido a partir dos produtos selecionados no catálogo.
     * Faz snapshot de preço e promoção de cada item NO MOMENTO do pedido.
     */
    /** Teto de itens por pedido do catálogo público (proteção contra abuso/lixo). */
    private static final int MAX_ITEMS_PER_ORDER = 50;

    @Transactional
    public OrderResponse create(OrderRequest request) {
        if (request.getProductIds().size() > MAX_ITEMS_PER_ORDER) {
            throw new RuntimeException("Pedido excede o número máximo de itens (" + MAX_ITEMS_PER_ORDER + ").");
        }

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
        // Fluxo PÚBLICO (catálogo): não expõe o custo dos itens no retorno.
        return OrderResponse.fromPublic(orderRepository.save(order));
    }

    /**
     * Cria um pedido pela operadora (venda direta, fora do catálogo).
     * Canal = DIRETA. Se confirm=true, nasce CONFIRMADO (nome obrigatório).
     */
    @Transactional
    public OrderResponse createDirect(AdminOrderCreateRequest request) {
        boolean confirm = Boolean.TRUE.equals(request.getConfirm());

        if (request.getItems().size() > MAX_ITEMS_PER_ORDER) {
            throw new RuntimeException("Pedido excede o número máximo de itens (" + MAX_ITEMS_PER_ORDER + ").");
        }

        LocalDateTime now = LocalDateTime.now();

        Order order = Order.builder()
                .orderNumber(generateUniqueOrderNumber())
                .status(confirm ? "CONFIRMADO" : "PENDENTE")
                .channel("DIRETA")
                .orderedAt(now)
                .resolvedAt(confirm ? now : null)
                .notes(trimToNull(request.getNotes()))
                .build();

        // Vincula cliente cadastrado (se houver) e monta o snapshot de nome/telefone.
        applyCustomer(order, request.getCustomerId(), request.getCustomerName(), request.getCustomerPhone());

        if (confirm && order.getCustomerName() == null) {
            throw new RuntimeException("Informe o nome do cliente para confirmar a venda.");
        }
        if (confirm && order.getCustomerPhone() == null) {
            throw new RuntimeException("Informe o telefone do cliente para confirmar a venda.");
        }

        for (AdminOrderCreateRequest.Item reqItem : request.getItems()) {
            if (reqItem.getProductId() == null) {
                throw new RuntimeException("Item sem produto informado.");
            }
            Product product = productRepository.findById(reqItem.getProductId())
                    .orElseThrow(() -> new RuntimeException("Produto não encontrado: " + reqItem.getProductId()));
            int qty = (reqItem.getQuantity() != null && reqItem.getQuantity() >= 1) ? reqItem.getQuantity() : 1;
            order.getItems().add(buildSnapshotItem(order, product, qty, reqItem.getEffectivePrice(), now));
        }

        recalcTotal(order);
        Order saved = orderRepository.save(order);

        // Venda direta que já nasce confirmada consome o estoque imediatamente.
        if (confirm) {
            stockService.consumeForOrder(saved);
        }

        return OrderResponse.from(saved);
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

        // Preserva o custo do snapshot original por produto (o custo é do instante
        // do pedido, não da edição — evita divergência de margem se o custo mudar).
        java.util.Map<UUID, BigDecimal> originalCostByProduct = new java.util.HashMap<>();
        for (OrderItem existing : order.getItems()) {
            if (existing.getProduct() != null && existing.getCostPrice() != null) {
                originalCostByProduct.putIfAbsent(existing.getProduct().getId(), existing.getCostPrice());
            }
        }

        // Reconstrói a lista de itens a partir do request (orphanRemoval limpa os antigos)
        order.getItems().clear();
        for (OrderUpdateRequest.Item reqItem : request.getItems()) {
            if (reqItem.getProductId() == null) {
                throw new RuntimeException("Item sem produto informado.");
            }
            Product product = productRepository.findById(reqItem.getProductId())
                    .orElseThrow(() -> new RuntimeException("Produto não encontrado: " + reqItem.getProductId()));

            int qty = (reqItem.getQuantity() != null && reqItem.getQuantity() >= 1) ? reqItem.getQuantity() : 1;
            OrderItem item = buildSnapshotItem(order, product, qty, reqItem.getEffectivePrice(), now);
            // Se o produto já estava no pedido, mantém o custo do snapshot original
            BigDecimal preservedCost = originalCostByProduct.get(product.getId());
            if (preservedCost != null) {
                item.setCostPrice(preservedCost);
            }
            order.getItems().add(item);
        }

        applyCustomer(order, request.getCustomerId(), request.getCustomerName(), request.getCustomerPhone());
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

        // Nome e telefone do cliente são obrigatórios para resolver o pedido
        // (confirmar ou cancelar) — necessários para o aviso automático via WhatsApp.
        boolean resolving = normalized.equals("CONFIRMADO") || normalized.equals("CANCELADO");
        if (resolving && (order.getCustomerName() == null || order.getCustomerName().isBlank())) {
            throw new RuntimeException("Informe o nome do cliente antes de " +
                    (normalized.equals("CONFIRMADO") ? "confirmar" : "cancelar") + " o pedido.");
        }
        if (resolving && (order.getCustomerPhone() == null || order.getCustomerPhone().isBlank())) {
            throw new RuntimeException("Informe o telefone do cliente antes de " +
                    (normalized.equals("CONFIRMADO") ? "confirmar" : "cancelar") + " o pedido.");
        }

        String previous = order.getStatus();

        // Baixa/estorno de estoque conforme a transição.
        // O estoque só é consumido enquanto o pedido está CONFIRMADO.
        boolean wasConfirmed = "CONFIRMADO".equals(previous);
        boolean willBeConfirmed = "CONFIRMADO".equals(normalized);
        if (!wasConfirmed && willBeConfirmed) {
            stockService.consumeForOrder(order);   // passou a vender → dá baixa
        } else if (wasConfirmed && !willBeConfirmed) {
            stockService.restockForOrder(order);    // deixou de vender → estorna
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
                effectivePrice = unitPrice.multiply(factor)
                        .setScale(2, java.math.RoundingMode.HALF_UP);
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
            BigDecimal price = item.getEffectivePrice() != null ? item.getEffectivePrice() : BigDecimal.ZERO;
            total = total.add(price.multiply(BigDecimal.valueOf(qty)));
        }
        order.setTotalAmount(total);
    }

    private String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /**
     * Resolve o cliente cadastrado (se customerId vier) e o vincula ao pedido,
     * preenchendo o snapshot de nome/telefone a partir do cadastro. Se não vier
     * id, mantém o cliente nulo e usa os campos de texto informados (fluxo antigo).
     * Retorna o par [name, phone] a ser gravado como snapshot.
     */
    private void applyCustomer(Order order, UUID customerId, String nameText, String phoneText) {
        if (customerId != null) {
            Customer c = customerRepository.findById(customerId)
                    .orElseThrow(() -> new RuntimeException("Cliente não encontrado."));
            order.setCustomer(c);
            // Snapshot: prioriza dados do cadastro; texto informado pode sobrescrever
            // se preenchido (ex.: ajuste pontual do nome naquele pedido).
            order.setCustomerName(trimToNull(nameText) != null ? trimToNull(nameText) : c.getName());
            order.setCustomerPhone(trimToNull(phoneText) != null ? trimToNull(phoneText) : c.getPhone());
        } else {
            order.setCustomer(null);
            order.setCustomerName(trimToNull(nameText));
            order.setCustomerPhone(trimToNull(phoneText));
        }
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
