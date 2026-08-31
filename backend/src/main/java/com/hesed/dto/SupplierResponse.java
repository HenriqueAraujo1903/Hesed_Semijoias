package com.hesed.dto;

import com.hesed.models.Supplier;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class SupplierResponse {
    private UUID id;
    private String name;
    private String phone;
    private String email;
    private String website;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static SupplierResponse from(Supplier s) {
        SupplierResponse r = new SupplierResponse();
        r.setId(s.getId());
        r.setName(s.getName());
        r.setPhone(s.getPhone());
        r.setEmail(s.getEmail());
        r.setWebsite(s.getWebsite());
        r.setNotes(s.getNotes());
        r.setCreatedAt(s.getCreatedAt());
        r.setUpdatedAt(s.getUpdatedAt());
        return r;
    }
}
