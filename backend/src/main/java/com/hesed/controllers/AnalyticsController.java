package com.hesed.controllers;

import com.hesed.dto.EngagementAnalyticsResponse;
import com.hesed.dto.SalesAnalyticsResponse;
import com.hesed.dto.StockAnalyticsResponse;
import com.hesed.services.AnalyticsService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@RestController
@RequestMapping("/api/admin/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    /**
     * Dados analíticos de vendas.
     *
     * @param status       status considerado (default CONFIRMADO = vendas reais)
     * @param granularity  day | month | year (série temporal; default month)
     * @param from         data inicial (yyyy-MM-dd, inclusiva)
     * @param to           data final (yyyy-MM-dd, inclusiva até o fim do dia)
     * @param category     filtra por categoria
     * @param promoOnly    se true, considera apenas itens que estavam em promoção
     */
    @GetMapping("/sales")
    public ResponseEntity<SalesAnalyticsResponse> sales(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String granularity,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String category,
            @RequestParam(required = false, defaultValue = "false") boolean promoOnly) {

        LocalDateTime fromDt = from != null ? from.atStartOfDay() : null;
        LocalDateTime toDt = to != null ? to.atTime(LocalTime.MAX) : null;
        String cat = (category != null && !category.isBlank()) ? category : null;

        return ResponseEntity.ok(
                analyticsService.sales(status, granularity, fromDt, toDt, cat, promoOnly));
    }

    /**
     * Engajamento do catálogo: visitas, seleções, produtos mais desejados e funil.
     */
    @GetMapping("/engagement")
    public ResponseEntity<EngagementAnalyticsResponse> engagement(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        LocalDateTime fromDt = from != null ? from.atStartOfDay() : null;
        LocalDateTime toDt = to != null ? to.atTime(LocalTime.MAX) : null;

        return ResponseEntity.ok(analyticsService.engagement(fromDt, toDt));
    }

    /**
     * Dashboard de estoque: KPIs (SKUs, unidades, valor a custo/venda, baixo/esgotado),
     * distribuição por categoria, itens críticos e movimentações recentes.
     * Considera apenas o estoque próprio (produtos sob encomenda ficam de fora).
     */
    @GetMapping("/stock")
    public ResponseEntity<StockAnalyticsResponse> stock(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate movementsFrom) {

        String cat = (category != null && !category.isBlank()) ? category : null;
        LocalDateTime movFrom = movementsFrom != null ? movementsFrom.atStartOfDay() : null;
        return ResponseEntity.ok(analyticsService.stock(cat, status, movFrom));
    }
}
