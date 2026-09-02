package com.hesed.controllers;

import com.hesed.dto.OverviewResponse;
import com.hesed.services.OverviewService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Resumo executivo da tela Visão Geral. Agrega, em uma única chamada, os KPIs
 * do mês vigente, a meta resolvida, o progresso vs meta, contagens, alertas e a
 * série de receita dos últimos 6 meses.
 */
@RestController
@RequestMapping("/api/admin/overview")
public class OverviewController {

    private final OverviewService overviewService;

    public OverviewController(OverviewService overviewService) {
        this.overviewService = overviewService;
    }

    @GetMapping
    public ResponseEntity<OverviewResponse> overview() {
        return ResponseEntity.ok(overviewService.build());
    }
}
