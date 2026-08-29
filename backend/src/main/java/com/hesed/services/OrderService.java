package com.hesed.services;

import com.hesed.dto.OrderRequest;
import com.hesed.dto.OrderResponse;
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

        BigDecimal total = BigDecimal.ZERO;

        for (UUID productId : request.getProductIds()) {
            Product product = productRepository.findById(productId)
                    .orElseThrow(() -> new RuntimeException("Produto não encontrado: " + productId));

            // Detecta promoção ativa para o snapshot
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
                    // Calcula preço promocional a partir do percentual, se não houver promoPrice
                    BigDecimal factor = BigDecimal.ONE.subtract(
                            promo.getDiscountPercent().divide(BigDecimal.valueOf(100)));
                    effectivePrice = unitPrice.multiply(factor);
                }
            }

            OrderItem item = OrderItem.builder()
                    .order(order)
                    .product(product)
                    .productSku(product.getSku())
                    .productName(product.getName())
                    .productCategory(product.getCategory())
                    .unitPrice(unitPrice)
                    .effectivePrice(effectivePrice)
                    .costPrice(product.getCostPrice())
                    .quantity(1)
                    .wasPromotion(wasPromotion)
                    .discountPercent(discountPercent)
                    .build();

            order.getItems().add(item);
            total = total.add(effectivePrice);
        }

        order.setTotalAmount(total);
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

        order.setStatus(normalized);
        order.setResolvedAt(normalized.equals("PENDENTE") ? null : LocalDateTime.now());

        return OrderResponse.from(orderRepository.save(order));
    }

    public long countByStatus(String status) {
        return orderRepository.countByStatus(status);
    }

    // ---- helpers ----

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
