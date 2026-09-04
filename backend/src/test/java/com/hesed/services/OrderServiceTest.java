package com.hesed.services;

import com.hesed.models.Order;
import com.hesed.repositories.CustomerRepository;
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
    @Mock private CustomerRepository customerRepository;

    private OrderService orderService;

    @BeforeEach
    void setUp() {
        StockService stockService = new StockService(productRepository, stockMovementRepository);
        orderService = new OrderService(orderRepository, productRepository, promotionRepository,
                stockService, customerRepository);
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

    @Test
    @DisplayName("venda direta com customerId: vincula cliente e preenche snapshot nome/telefone")
    void createDirect_withCustomerId_fillsSnapshot() {
        UUID cid = UUID.randomUUID();
        com.hesed.models.Customer c = com.hesed.models.Customer.builder()
                .id(cid).name("Maria Cadastrada").phone("51988887777").build();
        when(customerRepository.findById(cid)).thenReturn(Optional.of(c));
        when(orderRepository.existsByOrderNumber(any())).thenReturn(false);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new com.hesed.dto.AdminOrderCreateRequest();
        var item = new com.hesed.dto.AdminOrderCreateRequest.Item();
        item.setProductId(UUID.randomUUID());
        item.setQuantity(1);
        item.setEffectivePrice(java.math.BigDecimal.TEN);
        req.setItems(java.util.List.of(item));
        req.setCustomerId(cid);
        req.setConfirm(false);
        when(productRepository.findById(item.getProductId()))
                .thenReturn(Optional.of(com.hesed.models.Product.builder()
                        .id(item.getProductId()).sku("SKU1").name("Anel")
                        .salePrice(java.math.BigDecimal.TEN).costPrice(java.math.BigDecimal.ONE).build()));
        when(promotionRepository.findActiveByProduct(any(), any())).thenReturn(java.util.List.of());

        var resp = orderService.createDirect(req);

        assertThat(resp.getCustomerId()).isEqualTo(cid);
        assertThat(resp.getCustomerName()).isEqualTo("Maria Cadastrada");
        assertThat(resp.getCustomerPhone()).isEqualTo("51988887777");
    }

    @Test
    @DisplayName("venda direta sem customerId: usa texto solto e não vincula cliente")
    void createDirect_withoutCustomerId_usesFreeText() {
        when(orderRepository.existsByOrderNumber(any())).thenReturn(false);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new com.hesed.dto.AdminOrderCreateRequest();
        var item = new com.hesed.dto.AdminOrderCreateRequest.Item();
        item.setProductId(UUID.randomUUID());
        item.setQuantity(1);
        req.setItems(java.util.List.of(item));
        req.setCustomerName("Cliente Avulso");
        req.setCustomerPhone("5133330000");
        req.setConfirm(false);
        when(productRepository.findById(item.getProductId()))
                .thenReturn(Optional.of(com.hesed.models.Product.builder()
                        .id(item.getProductId()).sku("SKU2").name("Colar")
                        .salePrice(java.math.BigDecimal.TEN).costPrice(java.math.BigDecimal.ONE).build()));
        when(promotionRepository.findActiveByProduct(any(), any())).thenReturn(java.util.List.of());

        var resp = orderService.createDirect(req);

        assertThat(resp.getCustomerId()).isNull();
        assertThat(resp.getCustomerName()).isEqualTo("Cliente Avulso");
        assertThat(resp.getCustomerPhone()).isEqualTo("5133330000");
    }

    // ===========================================================================
    // Snapshot de preço no pedido — impacto financeiro da precificação.
    // O backend grava custo/venda FINAIS que vêm do produto; a mudança de UI
    // (cálculo de custo/venda/% lucro) não altera essas regras. Estes testes
    // travam o comportamento para pegar qualquer regressão.
    // ===========================================================================

    private com.hesed.dto.AdminOrderCreateRequest directReq(UUID productId, int qty, java.math.BigDecimal override) {
        var req = new com.hesed.dto.AdminOrderCreateRequest();
        var item = new com.hesed.dto.AdminOrderCreateRequest.Item();
        item.setProductId(productId);
        item.setQuantity(qty);
        item.setEffectivePrice(override);
        req.setItems(java.util.List.of(item));
        req.setConfirm(false);
        return req;
    }

    @Test
    @DisplayName("snapshot: item copia unitPrice=venda e costPrice=custo do produto (sem promoção)")
    void snapshot_copiesSalePriceAndCost() {
        when(orderRepository.existsByOrderNumber(any())).thenReturn(false);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        UUID pid = UUID.randomUUID();
        // Produto precificado pela nova regra: fornecedor 176 → custo 88 → venda 88/0,15 = 586,67
        when(productRepository.findById(pid)).thenReturn(Optional.of(com.hesed.models.Product.builder()
                .id(pid).sku("AN-1").name("Anel").category("Anel")
                .salePrice(new java.math.BigDecimal("586.67")).costPrice(new java.math.BigDecimal("88.00")).build()));
        when(promotionRepository.findActiveByProduct(any(), any())).thenReturn(java.util.List.of());

        var resp = orderService.createDirect(directReq(pid, 2, null));

        var it = resp.getItems().get(0);
        assertThat(it.getUnitPrice()).isEqualByComparingTo("586.67");     // preço cheio = venda do produto
        assertThat(it.getEffectivePrice()).isEqualByComparingTo("586.67"); // sem promoção = preço cheio
        assertThat(it.getCostPrice()).isEqualByComparingTo("88.00");       // custo do snapshot
        assertThat(it.getWasPromotion()).isFalse();
        // Total = effectivePrice * qty
        assertThat(resp.getTotalAmount()).isEqualByComparingTo("1173.34");
    }

    @Test
    @DisplayName("snapshot: preço negociado (override) vira effectivePrice; custo permanece o do produto")
    void snapshot_overridePrice() {
        when(orderRepository.existsByOrderNumber(any())).thenReturn(false);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        UUID pid = UUID.randomUUID();
        when(productRepository.findById(pid)).thenReturn(Optional.of(com.hesed.models.Product.builder()
                .id(pid).sku("AN-2").name("Brinco").category("Brinco")
                .salePrice(new java.math.BigDecimal("100.00")).costPrice(new java.math.BigDecimal("15.00")).build()));
        when(promotionRepository.findActiveByProduct(any(), any())).thenReturn(java.util.List.of());

        var resp = orderService.createDirect(directReq(pid, 1, new java.math.BigDecimal("90.00")));

        var it = resp.getItems().get(0);
        assertThat(it.getUnitPrice()).isEqualByComparingTo("100.00");     // referência = venda
        assertThat(it.getEffectivePrice()).isEqualByComparingTo("90.00"); // negociado
        assertThat(it.getCostPrice()).isEqualByComparingTo("15.00");      // custo inalterado (margem preservada)
        assertThat(resp.getTotalAmount()).isEqualByComparingTo("90.00");
    }

    @Test
    @DisplayName("venda CONSIGNADO: effectivePrice = preço de venda do lote; unitPrice/custo do produto")
    void consignmentSale_usesLotPrice() {
        when(orderRepository.existsByOrderNumber(any())).thenReturn(false);
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        UUID pid = UUID.randomUUID();
        when(productRepository.findById(pid)).thenReturn(Optional.of(com.hesed.models.Product.builder()
                .id(pid).sku("CG-1").name("Pulseira").category("Pulseira")
                .salePrice(new java.math.BigDecimal("200.00")).costPrice(new java.math.BigDecimal("30.00")).build()));

        // Preço do lote (unitSalePrice) diferente do salePrice atual do produto.
        var saleItem = new OrderService.ConsignmentSaleItem(pid, 3, new java.math.BigDecimal("180.00"));
        Order sale = orderService.createConsignmentSale("Maria Revendedora",
                java.util.List.of(saleItem), java.time.LocalDateTime.now());

        assertThat(sale.getChannel()).isEqualTo("CONSIGNADO");
        assertThat(sale.getStatus()).isEqualTo("CONFIRMADO");
        var it = sale.getItems().get(0);
        assertThat(it.getUnitPrice()).isEqualByComparingTo("200.00");     // referência = venda do produto
        assertThat(it.getEffectivePrice()).isEqualByComparingTo("180.00"); // preço praticado no lote
        assertThat(it.getCostPrice()).isEqualByComparingTo("30.00");       // custo entra na margem do dashboard
        assertThat(sale.getTotalAmount()).isEqualByComparingTo("540.00");  // 180 * 3
    }
}
