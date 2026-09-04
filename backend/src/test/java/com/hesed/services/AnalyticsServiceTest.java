package com.hesed.services;

import com.hesed.dto.StockAnalyticsResponse;
import com.hesed.models.Product;
import com.hesed.models.StockMovement;
import com.hesed.repositories.CatalogEventRepository;
import com.hesed.repositories.OrderItemRepository;
import com.hesed.repositories.OrderRepository;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.StockMovementRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock private OrderItemRepository orderItemRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private CatalogEventRepository catalogEventRepository;
    @Mock private ProductRepository productRepository;
    @Mock private StockMovementRepository stockMovementRepository;
    @Mock private com.hesed.repositories.PromotionRepository promotionRepository;
    @Mock private com.hesed.repositories.ConsignmentRepository consignmentRepository;

    @InjectMocks private AnalyticsService service;

    @Test
    @DisplayName("stock: monta KPIs, status, categorias, críticos e movimentações")
    void stock_buildsPayload() {
        // KPIs: 5 SKUs, 42 unidades, custo 1000, venda 3000
        when(productRepository.stockKpis(any(), any())).thenReturn(List.<Object[]>of(
                new Object[]{5L, 42L, new BigDecimal("1000.00"), new BigDecimal("3000.00")}));
        when(productRepository.stockCountByStatus(any(), any())).thenReturn(List.of(
                new Object[]{"DISPONIVEL", 3L},
                new Object[]{"BAIXO", 1L},
                new Object[]{"ESGOTADO", 1L}));
        when(productRepository.stockByCategory(any(), any())).thenReturn(List.of(
                new Object[]{"Anel", 2L, 20L, new BigDecimal("400.00"), new BigDecimal("1200.00")},
                new Object[]{"Brinco", 3L, 22L, new BigDecimal("600.00"), new BigDecimal("1800.00")}));

        Product low = Product.builder().sku("A1").name("Anel Baixo").category("Anel")
                .costPrice(BigDecimal.TEN).salePrice(new BigDecimal("30"))
                .stockQuantity(1).stockStatus("BAIXO").build();
        Product out = Product.builder().sku("B1").name("Brinco Zerado").category("Brinco")
                .costPrice(BigDecimal.TEN).salePrice(new BigDecimal("30"))
                .stockQuantity(0).stockStatus("ESGOTADO").build();
        when(productRepository.findCriticalStock(any(), any())).thenReturn(List.of(out, low));

        Product prod = Product.builder().sku("A1").name("Anel Baixo").build();
        StockMovement mov = StockMovement.builder()
                .product(prod).type("SAIDA").delta(-2).resultingQuantity(1)
                .reason("Venda pedido HSD-1").createdAt(LocalDateTime.now()).build();
        when(stockMovementRepository.findRecentWithProduct(any(), any(), any())).thenReturn(List.of(mov));

        StockAnalyticsResponse r = service.stock(null, null, null, null);

        assertThat(r.getKpis().getSkus()).isEqualTo(5);
        assertThat(r.getKpis().getUnits()).isEqualTo(42);
        assertThat(r.getKpis().getCostValue()).isEqualByComparingTo("1000.00");
        assertThat(r.getKpis().getSaleValue()).isEqualByComparingTo("3000.00");
        assertThat(r.getKpis().getAvailable()).isEqualTo(3);
        assertThat(r.getKpis().getLow()).isEqualTo(1);
        assertThat(r.getKpis().getOut()).isEqualTo(1);

        assertThat(r.getByCategory()).hasSize(2);
        assertThat(r.getByCategory().get(0).getCategory()).isEqualTo("Anel");

        assertThat(r.getCritical()).hasSize(2);
        assertThat(r.getCritical().get(0).getStockStatus()).isEqualTo("ESGOTADO");

        assertThat(r.getRecentMovements()).hasSize(1);
        assertThat(r.getRecentMovements().get(0).getSku()).isEqualTo("A1");
        assertThat(r.getRecentMovements().get(0).getType()).isEqualTo("SAIDA");
        assertThat(r.getRecentMovements().get(0).getDelta()).isEqualTo(-2);
    }

    @Test
    @DisplayName("stock: sem produtos → KPIs zerados e listas vazias")
    void stock_empty() {
        when(productRepository.stockKpis(any(), any())).thenReturn(List.of());
        when(productRepository.stockCountByStatus(any(), any())).thenReturn(List.of());
        when(productRepository.stockByCategory(any(), any())).thenReturn(List.of());
        when(productRepository.findCriticalStock(any(), any())).thenReturn(List.of());
        when(stockMovementRepository.findRecentWithProduct(any(), any(), any())).thenReturn(List.of());

        StockAnalyticsResponse r = service.stock(null, null, null, null);

        assertThat(r.getKpis().getSkus()).isZero();
        assertThat(r.getKpis().getUnits()).isZero();
        assertThat(r.getKpis().getCostValue()).isEqualByComparingTo("0");
        assertThat(r.getByCategory()).isEmpty();
        assertThat(r.getCritical()).isEmpty();
        assertThat(r.getRecentMovements()).isEmpty();
    }

    @Test
    @DisplayName("stock: repassa filtros de categoria/status (normalizado p/ maiúsculo) e período aos repositórios")
    void stock_passesFilters() {
        when(productRepository.stockKpis(any(), any())).thenReturn(List.of());
        when(productRepository.stockCountByStatus(any(), any())).thenReturn(List.of());
        when(productRepository.stockByCategory(any(), any())).thenReturn(List.of());
        when(productRepository.findCriticalStock(any(), any())).thenReturn(List.of());
        when(stockMovementRepository.findRecentWithProduct(any(), any(), any())).thenReturn(List.of());

        LocalDateTime from = LocalDateTime.of(2026, 1, 1, 0, 0);
        service.stock("Anel", "baixo", from, null);

        org.mockito.ArgumentCaptor<String> cat = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.ArgumentCaptor<String> st = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(productRepository).findCriticalStock(cat.capture(), st.capture());
        assertThat(cat.getValue()).isEqualTo("Anel");
        assertThat(st.getValue()).isEqualTo("BAIXO"); // normalizado para maiúsculo

        org.mockito.ArgumentCaptor<LocalDateTime> mf = org.mockito.ArgumentCaptor.forClass(LocalDateTime.class);
        org.mockito.Mockito.verify(stockMovementRepository).findRecentWithProduct(mf.capture(), any(), any());
        assertThat(mf.getValue()).isEqualTo(from);
    }

    @Test
    @DisplayName("promotions: split, participação %, desconto concedido, ativas/total e top produtos")
    void promotions_buildsPayload() {
        // Split: promo receita 300 (5 itens), cheio 700 (10 itens) -> participacao 30%
        when(orderItemRepository.byPromotion(any(), any(), any(), org.mockito.ArgumentMatchers.eq(true), any()))
                .thenReturn(List.of(
                        new Object[]{Boolean.TRUE, new BigDecimal("300.00"), 5L},
                        new Object[]{Boolean.FALSE, new BigDecimal("700.00"), 10L}));
        when(orderItemRepository.discountGranted(any(), any(), any(), org.mockito.ArgumentMatchers.eq(true), any())).thenReturn(new BigDecimal("120.00"));
        when(orderItemRepository.topProducts(any(), any(), any(), org.mockito.ArgumentMatchers.eq(true), any(),
                org.mockito.ArgumentMatchers.eq(true)))
                .thenReturn(List.<Object[]>of(new Object[]{"A1", "Anel Promo", "Anel", new BigDecimal("300.00"), 5L}));

        // Promoção ativa (com produto, pois PromotionResponse.from usa product)
        com.hesed.models.Product prod = com.hesed.models.Product.builder()
                .id(java.util.UUID.randomUUID()).sku("A1").name("Anel Promo")
                .salePrice(new BigDecimal("60")).build();
        com.hesed.models.Promotion promo = com.hesed.models.Promotion.builder()
                .id(java.util.UUID.randomUUID()).product(prod).title("Promo QA")
                .discountPercent(new BigDecimal("25")).active(true).build();
        when(promotionRepository.findActivePromotions(any())).thenReturn(List.of(promo));
        when(promotionRepository.count()).thenReturn(3L);

        var r = service.promotions(null, null, null);

        assertThat(r.getKpis().getActiveCount()).isEqualTo(1);
        assertThat(r.getKpis().getTotalCount()).isEqualTo(3);
        assertThat(r.getKpis().getPromoRevenue()).isEqualByComparingTo("300.00");
        assertThat(r.getKpis().getPromoItems()).isEqualTo(5);
        assertThat(r.getKpis().getPromoShare()).isEqualByComparingTo("30.00"); // 300/(300+700)
        assertThat(r.getKpis().getDiscountGranted()).isEqualByComparingTo("120.00");

        assertThat(r.getSplit().getRegularRevenue()).isEqualByComparingTo("700.00");
        assertThat(r.getTopPromoProducts()).hasSize(1);
        assertThat(r.getTopPromoProducts().get(0).getSku()).isEqualTo("A1");
        assertThat(r.getActivePromotions()).hasSize(1);
        assertThat(r.getActivePromotions().get(0).getTitle()).isEqualTo("Promo QA");
    }

    @Test
    @DisplayName("promotions: sem vendas → participação 0, listas vazias")
    void promotions_empty() {
        when(orderItemRepository.byPromotion(any(), any(), any(), org.mockito.ArgumentMatchers.eq(true), any()))
                .thenReturn(List.of());
        when(orderItemRepository.discountGranted(any(), any(), any(), org.mockito.ArgumentMatchers.eq(true), any())).thenReturn(BigDecimal.ZERO);
        when(orderItemRepository.topProducts(any(), any(), any(), org.mockito.ArgumentMatchers.eq(true), any(),
                org.mockito.ArgumentMatchers.eq(true))).thenReturn(List.of());
        when(promotionRepository.findActivePromotions(any())).thenReturn(List.of());
        when(promotionRepository.count()).thenReturn(0L);

        var r = service.promotions(null, null, null);

        assertThat(r.getKpis().getPromoShare()).isEqualByComparingTo("0");
        assertThat(r.getKpis().getActiveCount()).isZero();
        assertThat(r.getTopPromoProducts()).isEmpty();
        assertThat(r.getActivePromotions()).isEmpty();
    }

    @Test
    @DisplayName("sales: margem = receita - custo e marginPercent; usa effectivePrice/costPrice do item")
    void sales_computesMargin() {
        // KPIs: receita 1173.34 (venda 586.67 x 2), custo 176.00 (88 x 2), 2 itens, 1 pedido
        when(orderItemRepository.kpis(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(List.<Object[]>of(new Object[]{
                        new BigDecimal("1173.34"), new BigDecimal("176.00"), 2L, 1L}));
        // Demais componentes do payload: vazios (não interferem na margem).
        when(orderItemRepository.timeSeriesByMonth(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(List.of());
        when(orderItemRepository.byCategory(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(List.of());
        when(orderItemRepository.topProducts(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(List.of());
        when(orderItemRepository.byPromotion(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any()))
                .thenReturn(List.of());
        when(orderRepository.countByStatusInRange(any(), any())).thenReturn(List.of());

        var r = service.sales("CONFIRMADO", "month", null, null, null, false);

        assertThat(r.getKpis().getRevenue()).isEqualByComparingTo("1173.34");
        assertThat(r.getKpis().getCost()).isEqualByComparingTo("176.00");
        assertThat(r.getKpis().getMargin()).isEqualByComparingTo("997.34");        // 1173.34 - 176.00
        assertThat(r.getKpis().getMarginPercent()).isEqualByComparingTo("85.00");  // 997.34/1173.34*100 → 85%
        assertThat(r.getKpis().getItems()).isEqualTo(2);
        assertThat(r.getKpis().getOrders()).isEqualTo(1);
        assertThat(r.getKpis().getAverageTicket()).isEqualByComparingTo("1173.34"); // 1 pedido
    }

    @Test
    @DisplayName("sales: sem vendas → tudo zero, sem divisão por zero na margem%")
    void sales_empty() {
        when(orderItemRepository.kpis(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(List.of());
        when(orderItemRepository.timeSeriesByMonth(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(List.of());
        when(orderItemRepository.byCategory(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(List.of());
        when(orderItemRepository.topProducts(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(List.of());
        when(orderItemRepository.byPromotion(any(), any(), any(), org.mockito.ArgumentMatchers.anyBoolean(), any()))
                .thenReturn(List.of());
        when(orderRepository.countByStatusInRange(any(), any())).thenReturn(List.of());

        var r = service.sales("CONFIRMADO", "month", null, null, null, false);

        assertThat(r.getKpis().getRevenue()).isEqualByComparingTo("0");
        assertThat(r.getKpis().getMargin()).isEqualByComparingTo("0");
        assertThat(r.getKpis().getMarginPercent()).isEqualByComparingTo("0");
        assertThat(r.getKpis().getAverageTicket()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("stock: valor a custo e a venda = preço × quantidade (impacto da precificação)")
    void stock_costAndSaleValue() {
        // 1 SKU, 5 unidades, custo 88 → costValue 88; venda 586.67 → saleValue 586.67
        when(productRepository.stockKpis(any(), any())).thenReturn(List.<Object[]>of(
                new Object[]{1L, 5L, new BigDecimal("88.00"), new BigDecimal("586.67")}));
        when(productRepository.stockCountByStatus(any(), any())).thenReturn(List.<Object[]>of(
                new Object[]{"DISPONIVEL", 1L}));
        when(productRepository.stockByCategory(any(), any())).thenReturn(List.<Object[]>of(
                new Object[]{"Anel", 1L, 5L, new BigDecimal("88.00"), new BigDecimal("586.67")}));
        when(productRepository.findCriticalStock(any(), any())).thenReturn(List.of());
        when(stockMovementRepository.findRecentWithProduct(any(), any(), any())).thenReturn(List.of());

        var r = service.stock(null, null, null, null);

        assertThat(r.getKpis().getCostValue()).isEqualByComparingTo("88.00");
        assertThat(r.getKpis().getSaleValue()).isEqualByComparingTo("586.67");
        assertThat(r.getByCategory().get(0).getCostValue()).isEqualByComparingTo("88.00");
        assertThat(r.getByCategory().get(0).getSaleValue()).isEqualByComparingTo("586.67");
    }

    @Test
    @DisplayName("resellers: KPIs (somas, sell-through), ranking mapeado e consignações abertas")
    void resellers_buildsPayload() {
        // KPIs financeiros dos fechados: vendido 600, comissão 240, líquido 360, 2 lotes
        when(consignmentRepository.closedKpis(any(), any())).thenReturn(List.<Object[]>of(
                new Object[]{new BigDecimal("600.00"), new BigDecimal("240.00"), new BigDecimal("360.00"), 2L}));
        // Peças: 10 consignadas, 6 vendidas, 4 devolvidas -> sell-through 60%
        when(consignmentRepository.closedItemPieces(any(), any())).thenReturn(List.<Object[]>of(
                new Object[]{10L, 6L, 4L}));
        when(consignmentRepository.countByStatus("ABERTO")).thenReturn(3L);
        // Ranking: Maria 400/160/240 (1 lote), Ana 200/80/120 (1 lote)
        when(consignmentRepository.rankingByConsignee(any(), any())).thenReturn(List.of(
                new Object[]{"Maria", new BigDecimal("400.00"), new BigDecimal("160.00"), new BigDecimal("240.00"), 1L},
                new Object[]{"Ana", new BigDecimal("200.00"), new BigDecimal("80.00"), new BigDecimal("120.00"), 1L}));
        // Peças por revendedora: Maria 5 consignadas / 4 vendidas (80%), Ana 5 / 2 (40%)
        when(consignmentRepository.rankingPiecesByConsignee(any(), any())).thenReturn(List.of(
                new Object[]{"Maria", 5L, 4L},
                new Object[]{"Ana", 5L, 2L}));
        // Um lote aberto agora
        java.util.UUID openId = java.util.UUID.randomUUID();
        LocalDateTime openedAt = LocalDateTime.of(2026, 8, 1, 10, 0);
        when(consignmentRepository.openConsignments()).thenReturn(List.<Object[]>of(
                new Object[]{openId, "Carla", openedAt, 8L, new BigDecimal("1200.00")}));

        var r = service.resellers(null, null);

        // KPIs
        assertThat(r.getKpis().getTotalSold()).isEqualByComparingTo("600.00");
        assertThat(r.getKpis().getCommissionAmount()).isEqualByComparingTo("240.00");
        assertThat(r.getKpis().getNetAmount()).isEqualByComparingTo("360.00");
        assertThat(r.getKpis().getClosedCount()).isEqualTo(2);
        assertThat(r.getKpis().getOpenCount()).isEqualTo(3);
        assertThat(r.getKpis().getPiecesConsigned()).isEqualTo(10);
        assertThat(r.getKpis().getPiecesSold()).isEqualTo(6);
        assertThat(r.getKpis().getPiecesReturned()).isEqualTo(4);
        assertThat(r.getKpis().getSellThroughRate()).isEqualByComparingTo("60.00"); // 6/10

        // Ranking (ordem vinda do repositório: Maria primeiro)
        assertThat(r.getRanking()).hasSize(2);
        assertThat(r.getRanking().get(0).getName()).isEqualTo("Maria");
        assertThat(r.getRanking().get(0).getTotalSold()).isEqualByComparingTo("400.00");
        assertThat(r.getRanking().get(0).getBatches()).isEqualTo(1);
        assertThat(r.getRanking().get(0).getPiecesConsigned()).isEqualTo(5);
        assertThat(r.getRanking().get(0).getPiecesSold()).isEqualTo(4);
        assertThat(r.getRanking().get(0).getSellThroughRate()).isEqualByComparingTo("80.00"); // 4/5
        assertThat(r.getRanking().get(1).getName()).isEqualTo("Ana");
        assertThat(r.getRanking().get(1).getSellThroughRate()).isEqualByComparingTo("40.00"); // 2/5

        // Consignações abertas
        assertThat(r.getOpenConsignments()).hasSize(1);
        assertThat(r.getOpenConsignments().get(0).getConsigneeName()).isEqualTo("Carla");
        assertThat(r.getOpenConsignments().get(0).getPieces()).isEqualTo(8);
        assertThat(r.getOpenConsignments().get(0).getPotentialValue()).isEqualByComparingTo("1200.00");
    }

    @Test
    @DisplayName("resellers: sem fechados → KPIs zerados, ranking vazio; sell-through 0 sem divisão por zero")
    void resellers_empty() {
        when(consignmentRepository.closedKpis(any(), any())).thenReturn(List.of());
        when(consignmentRepository.closedItemPieces(any(), any())).thenReturn(List.of());
        when(consignmentRepository.countByStatus("ABERTO")).thenReturn(0L);
        when(consignmentRepository.rankingByConsignee(any(), any())).thenReturn(List.of());
        when(consignmentRepository.rankingPiecesByConsignee(any(), any())).thenReturn(List.of());
        when(consignmentRepository.openConsignments()).thenReturn(List.of());

        var r = service.resellers(null, null);

        assertThat(r.getKpis().getTotalSold()).isEqualByComparingTo("0");
        assertThat(r.getKpis().getSellThroughRate()).isEqualByComparingTo("0");
        assertThat(r.getKpis().getClosedCount()).isZero();
        assertThat(r.getRanking()).isEmpty();
        assertThat(r.getOpenConsignments()).isEmpty();
    }
}
