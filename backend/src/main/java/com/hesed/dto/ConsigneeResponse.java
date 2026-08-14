package com.hesed.dto;

import com.hesed.models.Consignee;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class ConsigneeResponse {
    private UUID id;
    private String name;
    private String phone;
    private String email;
    private BigDecimal commissionRate;
    private LocalDateTime createdAt;

    public static ConsigneeResponse from(Consignee c) {
        ConsigneeResponse r = new ConsigneeResponse();
        r.setId(c.getId());
        r.setName(c.getName());
        r.setPhone(c.getPhone());
        r.setEmail(c.getEmail());
        r.setCommissionRate(c.getCommissionRate());
        r.setCreatedAt(c.getCreatedAt());
        return r;
    }
}
