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
        r.setNotes(o.getNotes());
        r.setItems(o.getItems().stream().map(Item::from).toList());
        return r;
    }
}
