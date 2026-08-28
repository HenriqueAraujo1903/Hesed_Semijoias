package com.hesed.dto;

import com.hesed.models.Promotion;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class PromotionResponse {
    private UUID id;
    private UUID productId;
    private String productName;
    private String productSku;
    private String productImageUrl;
    private BigDecimal originalPrice;
    private String title;
    private String subtitle;
    private BigDecimal discountPercent;
    private BigDecimal promoPrice;
    private String bannerUrl;
    private Boolean active;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private Integer sortOrder;
    private LocalDateTime createdAt;

    public static PromotionResponse from(Promotion p) {
        PromotionResponse r = new PromotionResponse();
        r.setId(p.getId());
        r.setProductId(p.getProduct().getId());
        r.setProductName(p.getProduct().getName());
        r.setProductSku(p.getProduct().getSku());
        r.setProductImageUrl(p.getProduct().getImageUrl());
        r.setOriginalPrice(p.getProduct().getSalePrice());
        r.setTitle(p.getTitle());
        r.setSubtitle(p.getSubtitle());
        r.setDiscountPercent(p.getDiscountPercent());
        r.setPromoPrice(p.getPromoPrice());
        r.setBannerUrl(p.getBannerUrl());
        r.setActive(p.getActive());
        r.setStartsAt(p.getStartsAt());
        r.setEndsAt(p.getEndsAt());
        r.setSortOrder(p.getSortOrder());
        r.setCreatedAt(p.getCreatedAt());
        return r;
    }
}
