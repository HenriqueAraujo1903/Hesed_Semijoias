package com.hesed.dto;

import com.hesed.models.CashEntry;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
public class CashEntryResponse {
    private UUID id;
    private String type;
    private String description;
    private BigDecimal amount;
    private LocalDate entryDate;
    private String notes;

    public static CashEntryResponse from(CashEntry e) {
        CashEntryResponse r = new CashEntryResponse();
        r.setId(e.getId());
        r.setType(e.getType());
        r.setDescription(e.getDescription());
        r.setAmount(e.getAmount());
        r.setEntryDate(e.getEntryDate());
        r.setNotes(e.getNotes());
        return r;
    }
}
