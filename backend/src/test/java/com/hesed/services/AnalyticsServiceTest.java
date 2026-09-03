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
        when(stockMovementRepository.findRecentWithProduct(any(), any())).thenReturn(List.of(mov));

        StockAnalyticsResponse r = service.stock(null, null, null);

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
        when(stockMovementRepository.findRecentWithProduct(any(), any())).thenReturn(List.of());

        StockAnalyticsResponse r = service.stock(null, null, null);

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
        when(stockMovementRepository.findRecentWithProduct(any(), any())).thenReturn(List.of());

        LocalDateTime from = LocalDateTime.of(2026, 1, 1, 0, 0);
        service.stock("Anel", "baixo", from);

        org.mockito.ArgumentCaptor<String> cat = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.ArgumentCaptor<String> st = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(productRepository).findCriticalStock(cat.capture(), st.capture());
        assertThat(cat.getValue()).isEqualTo("Anel");
        assertThat(st.getValue()).isEqualTo("BAIXO"); // normalizado para maiúsculo

        org.mockito.ArgumentCaptor<LocalDateTime> mf = org.mockito.ArgumentCaptor.forClass(LocalDateTime.class);
        org.mockito.Mockito.verify(stockMovementRepository).findRecentWithProduct(mf.capture(), any());
        assertThat(mf.getValue()).isEqualTo(from);
    }
}
