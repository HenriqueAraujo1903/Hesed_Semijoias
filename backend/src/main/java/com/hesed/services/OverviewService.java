package com.hesed.services;

import com.hesed.dto.GoalResponse;
import com.hesed.dto.OverviewResponse;
import com.hesed.dto.SalesAnalyticsResponse;
import com.hesed.models.MonthlyGoal;
import com.hesed.models.Product;
import com.hesed.repositories.ConsigneeRepository;
import com.hesed.repositories.ProductRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class OverviewService {

    private static final int WARRANTY_ALERT_DAYS = 60;

    private final AnalyticsService analyticsService;
    private final GoalService goalService;
    private final OrderService orderService;
    private final ProductRepository productRepository;
    private final ConsigneeRepository consigneeRepository;

    public OverviewService(AnalyticsService analyticsService,
                           GoalService goalService,
                           OrderService orderService,
                           ProductRepository productRepository,
                           ConsigneeRepository consigneeRepository) {
        this.analyticsService = analyticsService;
        this.goalService = goalService;
        this.orderService = orderService;
        this.productRepository = productRepository;
        this.consigneeRepository = consigneeRepository;
    }

    public OverviewResponse build() {
        LocalDate today = LocalDate.now();
        int year = today.getYear();
        int month = today.getMonthValue();

        OverviewResponse resp = new OverviewResponse();
        resp.setYear(year);
        resp.setMonth(month);

        // ── KPIs do mês vigente (vendas confirmadas) ──
        LocalDateTime monthStart = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime monthEnd = today.withDayOfMonth(1).plusMonths(1).atStartOfDay();
        SalesAnalyticsResponse monthSales = analyticsService.sales(
                "CONFIRMADO", "month", monthStart, monthEnd, null, false);
        SalesAnalyticsResponse.Kpis k = monthSales.getKpis();

        OverviewResponse.MonthKpis mk = new OverviewResponse.MonthKpis();
        mk.setRevenue(k.getRevenue());
        mk.setOrders(k.getOrders());
        mk.setItems(k.getItems());
        mk.setAverageTicket(k.getAverageTicket());
        mk.setMargin(k.getMargin());
        mk.setMarginPercent(k.getMarginPercent());
        resp.setMonth_kpis(mk);

        // ── Meta resolvida (com herança) ──
        GoalResponse goal = goalService.resolveEffective(year, month);
        resp.setGoal(goal);

        // ── Progresso vs meta ──
        OverviewResponse.Progress progress = new OverviewResponse.Progress();
        MonthlyGoal effective = goalService.effectiveEntity(year, month);
        if (effective != null) {
            if (effective.getRevenueTarget() != null && effective.getRevenueTarget().signum() > 0) {
                progress.setRevenuePercent(percent(k.getRevenue(), effective.getRevenueTarget()));
            }
            if (effective.getOrdersTarget() != null && effective.getOrdersTarget() > 0) {
                progress.setOrdersPercent(percent(
                        BigDecimal.valueOf(k.getOrders()),
                        BigDecimal.valueOf(effective.getOrdersTarget())));
            }
        }
        resp.setProgress(progress);

        // ── Resumo de pedidos por status (todos os tempos) ──
        OverviewResponse.OrdersSummary orders = new OverviewResponse.OrdersSummary();
        orders.setPendente(orderService.countByStatus("PENDENTE"));
        orders.setConfirmado(orderService.countByStatus("CONFIRMADO"));
        orders.setCancelado(orderService.countByStatus("CANCELADO"));
        resp.setOrders(orders);

        // ── Contagens ──
        OverviewResponse.Counts counts = new OverviewResponse.Counts();
        counts.setProducts(productRepository.count());
        counts.setConsignees(consigneeRepository.count());
        resp.setCounts(counts);

        // ── Alertas: estoque baixo + garantia ──
        OverviewResponse.Alerts alerts = new OverviewResponse.Alerts();
        alerts.setLowStock(productRepository.findLowStock().size());
        long expired = 0, expiring = 0;
        LocalDate limit = today.plusDays(WARRANTY_ALERT_DAYS);
        for (Product p : productRepository.findWithPurchaseDate()) {
            if (p.getWarrantyMonths() == null || p.getPurchaseDate() == null) continue;
            LocalDate expiresAt = p.getPurchaseDate().plusMonths(p.getWarrantyMonths());
            if (expiresAt.isBefore(today)) {
                expired++;
            } else if (!expiresAt.isAfter(limit)) {
                expiring++;
            }
        }
        alerts.setWarrantyExpired(expired);
        alerts.setWarrantyExpiring(expiring);
        resp.setAlerts(alerts);

        // ── Receita dos últimos 6 meses (série mensal) ──
        LocalDate sixMonthsAgo = today.withDayOfMonth(1).minusMonths(5);
        LocalDateTime seriesFrom = sixMonthsAgo.atStartOfDay();
        SalesAnalyticsResponse series = analyticsService.sales(
                "CONFIRMADO", "month", seriesFrom, monthEnd, null, false);

        // Indexa os pontos existentes por período (yyyy-MM) e preenche os 6 meses,
        // garantindo zeros para meses sem venda.
        java.util.Map<String, SalesAnalyticsResponse.TimePoint> byPeriod = new java.util.HashMap<>();
        if (series.getTimeSeries() != null) {
            for (SalesAnalyticsResponse.TimePoint tp : series.getTimeSeries()) {
                byPeriod.put(tp.getPeriod(), tp);
            }
        }
        List<OverviewResponse.RevenuePoint> revenue6m = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            LocalDate m = sixMonthsAgo.plusMonths(i);
            String period = String.format("%04d-%02d", m.getYear(), m.getMonthValue());
            OverviewResponse.RevenuePoint rp = new OverviewResponse.RevenuePoint();
            rp.setPeriod(period);
            SalesAnalyticsResponse.TimePoint tp = byPeriod.get(period);
            rp.setRevenue(tp != null ? tp.getRevenue() : BigDecimal.ZERO);
            rp.setOrders(tp != null ? tp.getOrders() : 0);
            revenue6m.add(rp);
        }
        resp.setRevenue6m(revenue6m);

        return resp;
    }

    /** Percentual de value sobre target, arredondado a 1 casa. */
    private static BigDecimal percent(BigDecimal value, BigDecimal target) {
        if (target == null || target.signum() == 0) return null;
        BigDecimal v = value != null ? value : BigDecimal.ZERO;
        return v.multiply(BigDecimal.valueOf(100)).divide(target, 1, RoundingMode.HALF_UP);
    }
}
