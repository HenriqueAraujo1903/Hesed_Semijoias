package com.hesed.dto;

import com.hesed.models.Category;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class CategoryResponse {
    private UUID id;
    private String name;
    private Boolean active;
    private Integer sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CategoryResponse from(Category c) {
        CategoryResponse r = new CategoryResponse();
        r.setId(c.getId());
        r.setName(c.getName());
        r.setActive(c.getActive());
        r.setSortOrder(c.getSortOrder());
        r.setCreatedAt(c.getCreatedAt());
        r.setUpdatedAt(c.getUpdatedAt());
        return r;
    }
}
