package com.hesed.dto;

import com.hesed.models.PurchaseBatch;
import com.hesed.models.PurchaseBatchItem;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class PurchaseBatchResponse {
    private UUID id;
    private UUID supplierId;
    private String supplierName;
    private LocalDate purchaseDate;
    private BigDecimal totalAmount;
    private Integer installmentsCount;
    private UUID expenseId;
    private String notes;
    private List<Item> items;

    @Data
    public static class Item {
        private UUID id;
        private UUID productId;
        private String productSku;
        private String productName;
        private BigDecimal unitCost;
        private Integer quantity;
        private BigDecimal subtotal;
        private Boolean createdProduct;

        static Item from(PurchaseBatchItem it) {
            Item i = new Item();
            i.setId(it.getId());
            i.setProductId(it.getProduct() != null ? it.getProduct().getId() : null);
            i.setProductSku(it.getProductSku());
            i.setProductName(it.getProductName());
            i.setUnitCost(it.getUnitCost());
            i.setQuantity(it.getQuantity());
            BigDecimal qty = BigDecimal.valueOf(it.getQuantity() != null ? it.getQuantity() : 0);
            i.setSubtotal(it.getUnitCost() != null ? it.getUnitCost().multiply(qty) : BigDecimal.ZERO);
            i.setCreatedProduct(it.getCreatedProduct());
            return i;
        }
    }

    public static PurchaseBatchResponse from(PurchaseBatch b) {
        PurchaseBatchResponse r = new PurchaseBatchResponse();
        r.setId(b.getId());
        if (b.getSupplier() != null) {
            r.setSupplierId(b.getSupplier().getId());
            r.setSupplierName(b.getSupplier().getName());
        }
        r.setPurchaseDate(b.getPurchaseDate());
        r.setTotalAmount(b.getTotalAmount());
        r.setInstallmentsCount(b.getInstallmentsCount());
        r.setExpenseId(b.getExpense() != null ? b.getExpense().getId() : null);
        r.setNotes(b.getNotes());
        r.setItems(b.getItems().stream().map(Item::from).toList());
        return r;
    }
}
