package com.hesed.dto;

import com.hesed.models.Order;
import com.hesed.models.OrderItem;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class OrderResponse {
    private UUID id;
    private String orderNumber;
    private String status;
    private String channel;
    private BigDecimal totalAmount;
    private LocalDateTime orderedAt;
    private LocalDateTime resolvedAt;
    private UUID customerId;
    private String customerName;
    private String customerPhone;
    private String notes;
    private List<Item> items;

    @Data
    public static class Item {
        private UUID id;
        private UUID productId;
        private String productSku;
        private String productName;
        private String productCategory;
        private BigDecimal unitPrice;
        private BigDecimal effectivePrice;
        private BigDecimal subtotal;   // effectivePrice * quantity
        private BigDecimal costPrice;
        private Integer quantity;
        private Boolean wasPromotion;
        private BigDecimal discountPercent;

        static Item from(OrderItem oi) {
            Item i = new Item();
            i.setId(oi.getId());
            i.setProductId(oi.getProduct() != null ? oi.getProduct().getId() : null);
            i.setProductSku(oi.getProductSku());
            i.setProductName(oi.getProductName());
            i.setProductCategory(oi.getProductCategory());
            i.setUnitPrice(oi.getUnitPrice());
            i.setEffectivePrice(oi.getEffectivePrice());
            int qty = oi.getQuantity() != null ? oi.getQuantity() : 1;
            i.setSubtotal(oi.getEffectivePrice() != null
                    ? oi.getEffectivePrice().multiply(java.math.BigDecimal.valueOf(qty)) : null);
            i.setCostPrice(oi.getCostPrice());
            i.setQuantity(oi.getQuantity());
            i.setWasPromotion(oi.getWasPromotion());
            i.setDiscountPercent(oi.getDiscountPercent());
            return i;
        }
    }

    public static OrderResponse from(Order o) {
        OrderResponse r = new OrderResponse();
        r.setId(o.getId());
        r.setOrderNumber(o.getOrderNumber());
        r.setStatus(o.getStatus());
        r.setChannel(o.getChannel());
        r.setTotalAmount(o.getTotalAmount());
        r.setOrderedAt(o.getOrderedAt());
        r.setResolvedAt(o.getResolvedAt());
        r.setCustomerId(o.getCustomer() != null ? o.getCustomer().getId() : null);
        r.setCustomerName(o.getCustomerName());
        r.setCustomerPhone(o.getCustomerPhone());
        r.setNotes(o.getNotes());
        r.setItems(o.getItems().stream().map(Item::from).toList());
        return r;
    }

    /**
     * Versão PÚBLICA (retorno do POST /api/orders do catálogo, sem auth):
     * omite o costPrice de cada item — o cliente não deve ver o custo interno.
     * Demais campos (preço de venda, total) são mantidos para confirmação do pedido.
     */
    public static OrderResponse fromPublic(Order o) {
        OrderResponse r = from(o);
        if (r.getItems() != null) {
            r.getItems().forEach(i -> i.setCostPrice(null));
        }
        return r;
    }
}
