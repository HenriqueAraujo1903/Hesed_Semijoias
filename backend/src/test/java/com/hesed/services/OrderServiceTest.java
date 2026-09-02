package com.hesed.services;

import com.hesed.models.Order;
import com.hesed.repositories.OrderRepository;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.PromotionRepository;
import com.hesed.repositories.StockMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes do OrderService focados na regra de resolução de pedido: nome E
 * telefone do cliente são obrigatórios para CONFIRMAR e CANCELAR (necessários
 * para o aviso automático via WhatsApp).
 *
 * Nota: StockService é uma classe concreta e o Mockito não consegue mocká-la
 * neste JDK (bug Byte Buddy/JDK 26). Por isso usamos um StockService REAL com
 * repositórios mockados — como os pedidos de teste não têm itens, os métodos
 * de baixa/estorno percorrem lista vazia e não tocam os repositórios.
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private ProductRepository productRepository;
    @Mock private PromotionRepository promotionRepository;
    @Mock private StockMovementRepository stockMovementRepository;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        StockService stockService = new StockService(productRepository, stockMovementRepository);
        orderService = new OrderService(orderRepository, productRepository, promotionRepository, stockService);
    }

    private Order pendingOrder(String name, String phone) {
        Order o = Order.builder()
                .id(UUID.randomUUID())
                .orderNumber("HSD-1")
                .status("PENDENTE")
                .customerName(name)
                .customerPhone(phone)
                .build();
        lenient().when(orderRepository.findById(o.getId())).thenReturn(Optional.of(o));
        lenient().when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        return o;
    }

    @Test
    @DisplayName("confirmar sem telefone é bloqueado (mesmo com nome)")
    void confirm_requiresPhone() {
        Order o = pendingOrder("Maria", null);

        assertThatThrownBy(() -> orderService.updateStatus(o.getId(), "CONFIRMADO"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("telefone");

        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("confirmar sem nome é bloqueado")
    void confirm_requiresName() {
        Order o = pendingOrder(null, "51999998888");

        assertThatThrownBy(() -> orderService.updateStatus(o.getId(), "CONFIRMADO"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("nome");

        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("cancelar sem telefone é bloqueado")
    void cancel_requiresPhone() {
        Order o = pendingOrder("Maria", "   ");

        assertThatThrownBy(() -> orderService.updateStatus(o.getId(), "CANCELADO"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("telefone");

        verify(orderRepository, never()).save(any());
    }

    @Test
    @DisplayName("confirmar com nome e telefone: aplica status e resolvedAt")
    void confirm_okWithNameAndPhone() {
        Order o = pendingOrder("Maria", "(51) 99999-8888");

        var resp = orderService.updateStatus(o.getId(), "CONFIRMADO");

        assertThat(o.getStatus()).isEqualTo("CONFIRMADO");
        assertThat(o.getResolvedAt()).isNotNull();
        assertThat(resp.getStatus()).isEqualTo("CONFIRMADO");
    }

    @Test
    @DisplayName("cancelar com nome e telefone: aplica status")
    void cancel_okWithNameAndPhone() {
        Order o = pendingOrder("Maria", "51999998888");

        var resp = orderService.updateStatus(o.getId(), "CANCELADO");

        assertThat(o.getStatus()).isEqualTo("CANCELADO");
        assertThat(o.getResolvedAt()).isNotNull();
        assertThat(resp.getStatus()).isEqualTo("CANCELADO");
    }

    @Test
    @DisplayName("reabrir (PENDENTE) não exige nome/telefone")
    void reopen_doesNotRequireContact() {
        Order o = Order.builder()
                .id(UUID.randomUUID()).orderNumber("HSD-2").status("CONFIRMADO")
                .customerName(null).customerPhone(null).build();
        when(orderRepository.findById(o.getId())).thenReturn(Optional.of(o));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        var resp = orderService.updateStatus(o.getId(), "PENDENTE");

        assertThat(o.getStatus()).isEqualTo("PENDENTE");
        assertThat(o.getResolvedAt()).isNull();
        assertThat(resp.getStatus()).isEqualTo("PENDENTE");
    }

    @Test
    @DisplayName("status inválido é rejeitado")
    void invalidStatus() {
        Order o = pendingOrder("Maria", "51999998888");
        assertThatThrownBy(() -> orderService.updateStatus(o.getId(), "ENTREGUE"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("inválido");
    }
}
