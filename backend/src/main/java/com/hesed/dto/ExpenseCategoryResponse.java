package com.hesed.dto;

import com.hesed.models.ExpenseCategory;
import lombok.Data;

import java.util.UUID;

@Data
public class ExpenseCategoryResponse {
    private UUID id;
    private String name;
    private Boolean active;
    private Boolean operational;
    private Integer sortOrder;

    public static ExpenseCategoryResponse from(ExpenseCategory c) {
        ExpenseCategoryResponse r = new ExpenseCategoryResponse();
        r.setId(c.getId());
        r.setName(c.getName());
        r.setActive(c.getActive());
        r.setOperational(c.getOperational());
        r.setSortOrder(c.getSortOrder());
        return r;
    }
}
