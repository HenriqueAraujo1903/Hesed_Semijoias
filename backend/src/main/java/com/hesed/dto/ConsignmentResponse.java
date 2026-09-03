package com.hesed.dto;

import com.hesed.models.Consignment;
import com.hesed.models.ConsignmentItem;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class ConsignmentResponse {
    private UUID id;
    private UUID consigneeId;
    private String consigneeName;
    private String status;
    private BigDecimal commissionRate;
    private BigDecimal totalSold;
    private BigDecimal commissionAmount;
    private BigDecimal netAmount;
    private LocalDateTime openedAt;
    private LocalDateTime closedAt;
    private String notes;
    private List<Item> items;

    @Data
    public static class Item {
        private UUID id;
        private UUID productId;
        private String productSku;
        private String productName;
        private int quantity;
        private int soldQuantity;
        private int returnedQuantity;
        private BigDecimal unitSalePrice;

        static Item from(ConsignmentItem ci) {
            Item i = new Item();
            i.setId(ci.getId());
            i.setProductId(ci.getProduct() != null ? ci.getProduct().getId() : null);
            i.setProductSku(ci.getProductSku());
            i.setProductName(ci.getProductName());
            i.setQuantity(ci.getQuantity() != null ? ci.getQuantity() : 0);
            i.setSoldQuantity(ci.getSoldQuantity() != null ? ci.getSoldQuantity() : 0);
            i.setReturnedQuantity(ci.getReturnedQuantity() != null ? ci.getReturnedQuantity() : 0);
            i.setUnitSalePrice(ci.getUnitSalePrice());
            return i;
        }
    }

    public static ConsignmentResponse from(Consignment c) {
        ConsignmentResponse r = new ConsignmentResponse();
        r.setId(c.getId());
        if (c.getConsignee() != null) {
            r.setConsigneeId(c.getConsignee().getId());
            r.setConsigneeName(c.getConsignee().getName());
        }
        r.setStatus(c.getStatus());
        r.setCommissionRate(c.getCommissionRate());
        r.setTotalSold(c.getTotalSold());
        r.setCommissionAmount(c.getCommissionAmount());
        r.setNetAmount(c.getNetAmount());
        r.setOpenedAt(c.getOpenedAt());
        r.setClosedAt(c.getClosedAt());
        r.setNotes(c.getNotes());
        r.setItems(c.getItems().stream().map(Item::from).toList());
        return r;
    }
}
