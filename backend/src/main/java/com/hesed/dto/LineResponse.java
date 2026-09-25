package com.hesed.dto;

import com.hesed.models.Line;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class LineResponse {
    private UUID id;
    private String name;
    private Boolean active;
    private Boolean luxo;
    private Integer sortOrder;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static LineResponse from(Line l) {
        LineResponse r = new LineResponse();
        r.setId(l.getId());
        r.setName(l.getName());
        r.setActive(l.getActive());
        r.setLuxo(l.getLuxo());
        r.setSortOrder(l.getSortOrder());
        r.setCreatedAt(l.getCreatedAt());
        r.setUpdatedAt(l.getUpdatedAt());
        return r;
    }
}
