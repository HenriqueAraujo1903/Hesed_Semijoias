package com.hesed.dto;

import com.hesed.models.Product;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class ProductResponse {
    private UUID id;
    private String sku;
    private String name;
    private String description;
    private String category;
    private String imageUrl;
    private List<String> imageUrls;
    private BigDecimal supplierPrice;
    private BigDecimal costPrice;
    private BigDecimal salePrice;
    private String status;
    private String stockStatus;
    private Integer stockQuantity;
    private Integer reservedQuantity;
    private Integer lowStockThreshold;
    private UUID supplierId;
    private String supplierName;
    private LocalDate purchaseDate;
    private Integer warrantyMonths;
    /** Data de expiração da garantia = purchaseDate + warrantyMonths (calculada). */
    private LocalDate warrantyExpiresAt;
    private Boolean onDemand;
    private Integer leadTimeDays;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ProductResponse from(Product p) {
        ProductResponse r = new ProductResponse();
        r.setId(p.getId());
        r.setSku(p.getSku());
        r.setName(p.getName());
        r.setDescription(p.getDescription());
        r.setCategory(p.getCategory());
        r.setImageUrl(p.getImageUrl());
        r.setImageUrls(p.getImageUrls());
        r.setSupplierPrice(p.getSupplierPrice());
        r.setCostPrice(p.getCostPrice());
        r.setSalePrice(p.getSalePrice());
        r.setStatus(p.getStatus());
        r.setStockStatus(p.getStockStatus());
        r.setStockQuantity(p.getStockQuantity());
        r.setReservedQuantity(p.getReservedQuantity());
        r.setLowStockThreshold(p.getLowStockThreshold());
        if (p.getSupplier() != null) {
            r.setSupplierId(p.getSupplier().getId());
            r.setSupplierName(p.getSupplier().getName());
        }
        r.setPurchaseDate(p.getPurchaseDate());
        r.setWarrantyMonths(p.getWarrantyMonths());
        if (p.getPurchaseDate() != null && p.getWarrantyMonths() != null) {
            r.setWarrantyExpiresAt(p.getPurchaseDate().plusMonths(p.getWarrantyMonths()));
        }
        r.setOnDemand(Boolean.TRUE.equals(p.getOnDemand()));
        r.setLeadTimeDays(p.getLeadTimeDays());
        r.setCreatedAt(p.getCreatedAt());
        r.setUpdatedAt(p.getUpdatedAt());
        return r;
    }
}
