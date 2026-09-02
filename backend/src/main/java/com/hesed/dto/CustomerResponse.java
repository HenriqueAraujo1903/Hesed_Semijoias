package com.hesed.dto;

import com.hesed.models.Customer;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class CustomerResponse {
    private UUID id;
    private String name;
    private String phone;
    private String email;
    private String notes;
    private LocalDateTime createdAt;

    public static CustomerResponse from(Customer c) {
        CustomerResponse r = new CustomerResponse();
        r.setId(c.getId());
        r.setName(c.getName());
        r.setPhone(c.getPhone());
        r.setEmail(c.getEmail());
        r.setNotes(c.getNotes());
        r.setCreatedAt(c.getCreatedAt());
        return r;
    }
}
