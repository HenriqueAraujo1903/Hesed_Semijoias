package com.hesed.services;

import com.hesed.dto.SalesAnalyticsResponse;
import com.hesed.dto.SalesAnalyticsResponse.*;
import com.hesed.repositories.OrderItemRepository;
import com.hesed.repositories.OrderRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AnalyticsService {

    private final OrderItemRepository orderItemRepository;
    private final OrderRepository orderRepository;

    public AnalyticsService(OrderItemRepository orderItemRepository,
                            OrderRepository orderRepository) {
        this.orderItemRepository = orderItemRepository;
        this.orderRepository = orderRepository;
    }

    public SalesAnalyticsResponse sales(String status,
                                        String granularity,
                                        LocalDateTime from,
                                        LocalDateTime to,
                                        String category,
                                        boolean promoOnly) {
        String st = (status == null || status.isBlank()) ? "CONFIRMADO" : status.trim().toUpperCase();
        String gran = (granularity == null || granularity.isBlank()) ? "month" : granularity.trim().toLowerCase();

        // Normaliza para evitar parâmetros null (PostgreSQL não infere tipo de null).
        LocalDateTime fromDt = from != null ? from : LocalDateTime.of(2000, 1, 1, 0, 0);
        LocalDateTime toDt = to != null ? to : LocalDateTime.now().plusYears(1);

        boolean allCategories = (category == null || category.isBlank());
        String cat = allCategories ? "" : category;

        SalesAnalyticsResponse resp = new SalesAnalyticsResponse();
        resp.setKpis(buildKpis(st, fromDt, toDt, allCategories, cat, promoOnly));
        resp.setTimeSeries(buildTimeSeries(gran, st, fromDt, toDt, allCategories, cat, promoOnly));
        resp.setByCategory(buildByCategory(st, fromDt, toDt, allCategories, cat, promoOnly));
        resp.setTopProducts(buildTopProducts(st, fromDt, toDt, allCategories, cat, promoOnly));
        resp.setPromotionSplit(buildPromotionSplit(st, fromDt, toDt, allCategories, cat));
        resp.setConversion(buildConversion(fromDt, toDt));
        return resp;
    }

    // ---- KPIs ----
    private Kpis buildKpis(String status, LocalDateTime from, LocalDateTime to,
                           boolean allCategories, String category, boolean promoOnly) {
        List<Object[]> rows = orderItemRepository.kpis(status, from, to, allCategories, category, promoOnly);
        Object[] r = rows.isEmpty()
                ? new Object[]{BigDecimal.ZERO, BigDecimal.ZERO, 0L, 0L}
                : rows.get(0);

        BigDecimal revenue = toBigDecimal(r[0]);
        BigDecimal cost = toBigDecimal(r[1]);
        long items = toLong(r[2]);
        long orders = toLong(r[3]);

        BigDecimal margin = revenue.subtract(cost);
        BigDecimal marginPercent = revenue.signum() == 0 ? BigDecimal.ZERO
                : margin.multiply(BigDecimal.valueOf(100)).divide(revenue, 2, RoundingMode.HALF_UP);
        BigDecimal averageTicket = orders == 0 ? BigDecimal.ZERO
                : revenue.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP);

        Kpis k = new Kpis();
        k.setRevenue(scale(revenue));
        k.setCost(scale(cost));
        k.setMargin(scale(margin));
        k.setMarginPercent(marginPercent);
        k.setItems(items);
        k.setOrders(orders);
        k.setAverageTicket(averageTicket);
        return k;
    }

    // ---- Série temporal ----
    private List<TimePoint> buildTimeSeries(String gran, String status, LocalDateTime from, LocalDateTime to,
                                            boolean allCategories, String category, boolean promoOnly) {
        List<Object[]> rows = switch (gran) {
            case "day" -> orderItemRepository.timeSeriesByDay(status, from, to, allCategories, category, promoOnly);
            case "year" -> orderItemRepository.timeSeriesByYear(status, from, to, allCategories, category, promoOnly);
            default -> orderItemRepository.timeSeriesByMonth(status, from, to, allCategories, category, promoOnly);
        };
        return rows.stream().map(r -> {
            TimePoint tp = new TimePoint();
            tp.setPeriod((String) r[0]);
            tp.setRevenue(scale(toBigDecimal(r[1])));
            tp.setItems(toLong(r[2]));
            tp.setOrders(toLong(r[3]));
            return tp;
        }).toList();
    }

    // ---- Por categoria ----
    private List<CategorySlice> buildByCategory(String status, LocalDateTime from, LocalDateTime to,
                                                boolean allCategories, String category, boolean promoOnly) {
        return orderItemRepository.byCategory(status, from, to, allCategories, category, promoOnly).stream().map(r -> {
            CategorySlice c = new CategorySlice();
            c.setCategory((String) r[0]);
            c.setRevenue(scale(toBigDecimal(r[1])));
            c.setItems(toLong(r[2]));
            return c;
        }).toList();
    }

    // ---- Top produtos ----
    private List<ProductRow> buildTopProducts(String status, LocalDateTime from, LocalDateTime to,
                                              boolean allCategories, String category, boolean promoOnly) {
        return orderItemRepository.topProducts(status, from, to, allCategories, category, promoOnly).stream().map(r -> {
            ProductRow p = new ProductRow();
            p.setSku((String) r[0]);
            p.setName((String) r[1]);
            p.setCategory((String) r[2]);
            p.setRevenue(scale(toBigDecimal(r[3])));
            p.setItems(toLong(r[4]));
            return p;
        }).toList();
    }

    // ---- Split promoção ----
    private PromotionSplit buildPromotionSplit(String status, LocalDateTime from, LocalDateTime to,
                                               boolean allCategories, String category) {
        PromotionSplit split = new PromotionSplit();
        split.setPromoRevenue(BigDecimal.ZERO);
        split.setRegularRevenue(BigDecimal.ZERO);
        for (Object[] r : orderItemRepository.byPromotion(status, from, to, allCategories, category)) {
            boolean wasPromo = Boolean.TRUE.equals(r[0]);
            BigDecimal receita = scale(toBigDecimal(r[1]));
            long itens = toLong(r[2]);
            if (wasPromo) {
                split.setPromoRevenue(receita);
                split.setPromoItems(itens);
            } else {
                split.setRegularRevenue(receita);
                split.setRegularItems(itens);
            }
        }
        return split;
    }

    // ---- Conversão ----
    private Conversion buildConversion(LocalDateTime from, LocalDateTime to) {
        Conversion c = new Conversion();
        long total = 0, confirmed = 0, pending = 0, cancelled = 0;
        for (Object[] r : orderRepository.countByStatusInRange(from, to)) {
            String status = (String) r[0];
            long count = toLong(r[1]);
            total += count;
            switch (status) {
                case "CONFIRMADO" -> confirmed = count;
                case "PENDENTE" -> pending = count;
                case "CANCELADO" -> cancelled = count;
                default -> { }
            }
        }
        c.setTotalOrders(total);
        c.setConfirmedOrders(confirmed);
        c.setPendingOrders(pending);
        c.setCancelledOrders(cancelled);
        c.setConversionRate(total == 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(confirmed).multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP));
        return c;
    }

    // ---- helpers de conversão de tipo ----
    private static BigDecimal toBigDecimal(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal bd) return bd;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(o.toString());
    }

    private static long toLong(Object o) {
        if (o == null) return 0L;
        if (o instanceof Number n) return n.longValue();
        return Long.parseLong(o.toString());
    }

    private static BigDecimal scale(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v.setScale(2, RoundingMode.HALF_UP);
    }
}
