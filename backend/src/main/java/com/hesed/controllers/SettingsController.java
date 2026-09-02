package com.hesed.controllers;

import com.hesed.dto.MessageTemplateRequest;
import com.hesed.dto.MessageTemplateResponse;
import com.hesed.services.MessageTemplateService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Configurações do sistema (área admin). Por ora, gestão dos templates de
 * mensagem. Protegido por /api/admin/** (ROLE_ADMIN) no SecurityConfig.
 */
@RestController
@RequestMapping("/api/admin/settings")
public class SettingsController {

    private final MessageTemplateService messageTemplateService;

    public SettingsController(MessageTemplateService messageTemplateService) {
        this.messageTemplateService = messageTemplateService;
    }

    @GetMapping("/messages")
    public ResponseEntity<List<MessageTemplateResponse>> messages() {
        return ResponseEntity.ok(messageTemplateService.findAll());
    }

    @PutMapping("/messages/{key}")
    public ResponseEntity<?> updateMessage(@PathVariable String key,
                                           @Valid @RequestBody MessageTemplateRequest request) {
        try {
            return ResponseEntity.ok(messageTemplateService.update(key, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
