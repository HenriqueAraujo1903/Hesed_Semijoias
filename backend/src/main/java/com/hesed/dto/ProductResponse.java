package com.hesed.dto;

import com.hesed.models.Product;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class ProductResponse {
    private UUID id;
    private String sku;
    private String name;
    private String description;
    private String category;
    private String imageUrl;
    private BigDecimal costPrice;
    private BigDecimal salePrice;
    private String status;
    private String stockStatus;
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
        r.setCostPrice(p.getCostPrice());
        r.setSalePrice(p.getSalePrice());
        r.setStatus(p.getStatus());
        r.setStockStatus(p.getStockStatus());
        r.setCreatedAt(p.getCreatedAt());
        r.setUpdatedAt(p.getUpdatedAt());
        return r;
    }
}
