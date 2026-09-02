package com.hesed.dto;

import com.hesed.models.MessageTemplate;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class MessageTemplateResponse {
    private UUID id;
    private String templateKey;
    private String title;
    private String body;
    private boolean active;
    private LocalDateTime updatedAt;

    public static MessageTemplateResponse from(MessageTemplate t) {
        MessageTemplateResponse r = new MessageTemplateResponse();
        r.setId(t.getId());
        r.setTemplateKey(t.getTemplateKey());
        r.setTitle(t.getTitle());
        r.setBody(t.getBody());
        r.setActive(Boolean.TRUE.equals(t.getActive()));
        r.setUpdatedAt(t.getUpdatedAt());
        return r;
    }
}
