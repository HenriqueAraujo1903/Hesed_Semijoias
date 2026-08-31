package com.hesed.services;

import com.hesed.models.Order;
import com.hesed.models.OrderItem;
import com.hesed.models.Product;
import com.hesed.models.StockMovement;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.StockMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes unitários do StockService: aplicação de movimentos com piso em zero,
 * re-derivação do status, e baixa/estorno de pedidos. Repositórios mockados —
 * não sobem contexto Spring nem exigem banco.
 */
@ExtendWith(MockitoExtension.class)
class StockServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private StockMovementRepository movementRepository;

    @InjectMocks
    private StockService stockService;

    private Product product;

    @BeforeEach
    void setUp() {
        product = Product.builder()
                .id(UUID.randomUUID())
                .sku("SKU-1")
                .name("Peça")
                .category("Anel")
                .costPrice(new BigDecimal("10"))
                .salePrice(new BigDecimal("25"))
                .stockQuantity(10)
                .lowStockThreshold(3)
                .build();
        // lenient: nem todos os testes exercem o save (ex.: validação que falha antes).
        org.mockito.Mockito.lenient()
                .when(productRepository.save(any(Product.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("applyMovement soma o delta e re-deriva o status")
    void applyMovement_updatesQuantityAndStatus() {
        Product r = stockService.applyMovement(product, "SAIDA", -8, "venda", null);
        assertThat(r.getStockQuantity()).isEqualTo(2);
        assertThat(r.getStockStatus()).isEqualTo("BAIXO");
        verify(movementRepository).save(any(StockMovement.class));
    }

    @Test
    @DisplayName("estoque nunca fica negativo (piso em zero)")
    void applyMovement_flooredAtZero() {
        Product r = stockService.applyMovement(product, "SAIDA", -50, "venda grande", null);
        assertThat(r.getStockQuantity()).isEqualTo(0);
        assertThat(r.getStockStatus()).isEqualTo("ESGOTADO");
    }

    @Test
    @DisplayName("registra o movimento com quantidade resultante correta")
    void applyMovement_recordsMovement() {
        stockService.applyMovement(product, "ENTRADA", 5, "compra", null);
        ArgumentCaptor<StockMovement> captor = ArgumentCaptor.forClass(StockMovement.class);
        verify(movementRepository).save(captor.capture());
        assertThat(captor.getValue().getResultingQuantity()).isEqualTo(15);
        assertThat(captor.getValue().getDelta()).isEqualTo(5);
        assertThat(captor.getValue().getType()).isEqualTo("ENTRADA");
    }

    @Test
    @DisplayName("addStock rejeita quantidade não positiva (falha antes de tocar o repositório)")
    void addStock_rejectsNonPositive() {
        assertThatThrownBy(() -> stockService.addStock(product.getId(), 0, "x"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("positiva");
    }

    @Test
    @DisplayName("setAbsolute define o total e calcula o delta")
    void setAbsolute_setsTotal() {
        when(productRepository.findById(product.getId())).thenReturn(java.util.Optional.of(product));
        Product r = stockService.setAbsolute(product.getId(), 4, "inventário");
        assertThat(r.getStockQuantity()).isEqualTo(4);
        assertThat(r.getStockStatus()).isEqualTo("DISPONIVEL");
    }

    @Test
    @DisplayName("consumeForOrder dá baixa de cada item; ignora produto nulo")
    void consumeForOrder_decrementsEach() {
        Order order = Order.builder().orderNumber("HSD-1").build();
        OrderItem i1 = OrderItem.builder().product(product).quantity(2).build();
        OrderItem i2 = OrderItem.builder().product(null).quantity(1).build(); // produto excluído
        order.getItems().addAll(List.of(i1, i2));

        stockService.consumeForOrder(order);

        assertThat(product.getStockQuantity()).isEqualTo(8);
        // só um item tinha produto → um save de produto + um movimento
        verify(movementRepository, times(1)).save(any(StockMovement.class));
    }

    @Test
    @DisplayName("restockForOrder devolve a quantidade ao estoque")
    void restockForOrder_incrementsEach() {
        Order order = Order.builder().orderNumber("HSD-2").build();
        OrderItem i1 = OrderItem.builder().product(product).quantity(3).build();
        order.getItems().add(i1);

        stockService.restockForOrder(order);

        assertThat(product.getStockQuantity()).isEqualTo(13);
    }
}
