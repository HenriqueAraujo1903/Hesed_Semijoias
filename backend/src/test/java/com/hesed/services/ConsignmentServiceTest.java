package com.hesed.services;

import com.hesed.dto.ConsignmentRequest;
import com.hesed.dto.ConsignmentResponse;
import com.hesed.dto.ConsignmentSettleRequest;
import com.hesed.models.Consignee;
import com.hesed.models.Consignment;
import com.hesed.models.ConsignmentItem;
import com.hesed.models.Order;
import com.hesed.models.Product;
import com.hesed.repositories.ConsigneeRepository;
import com.hesed.repositories.ConsignmentRepository;
import com.hesed.repositories.CustomerRepository;
import com.hesed.repositories.OrderRepository;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.PromotionRepository;
import com.hesed.repositories.StockMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
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
 * Testes unitários do ConsignmentService: abertura reserva estoque; fechamento
 * baixa vendidos, devolve o restante, gera venda CONSIGNADO e apura a comissão
 * por lote; acerto valida quantidade.
 *
 * Nota: StockService e OrderService são classes concretas e o Mockito não
 * consegue mocká-las neste JDK (bug Byte Buddy). Usamos instâncias REAIS com
 * repositórios mockados e verificamos o efeito (estado do produto, Order salvo).
 */
@ExtendWith(MockitoExtension.class)
class ConsignmentServiceTest {

    @Mock private ConsignmentRepository consignmentRepository;
    @Mock private ConsigneeRepository consigneeRepository;
    @Mock private ProductRepository productRepository;
    @Mock private StockMovementRepository stockMovementRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private PromotionRepository promotionRepository;
    @Mock private CustomerRepository customerRepository;

    private ConsignmentService service;

    private Consignee consignee;
    private Product product;

    @BeforeEach
    void setUp() {
        StockService stockService = new StockService(productRepository, stockMovementRepository);
        OrderService orderService = new OrderService(orderRepository, productRepository,
                promotionRepository, stockService, customerRepository);
        service = new ConsignmentService(consignmentRepository, consigneeRepository,
                productRepository, stockService, orderService);

        consignee = Consignee.builder()
                .id(UUID.randomUUID())
                .name("Maria")
                .commissionRate(new BigDecimal("0.30"))
                .build();
        product = Product.builder()
                .id(UUID.randomUUID())
                .sku("SKU-1").name("Anel")
                .category("Anel")
                .salePrice(new BigDecimal("50.00"))
                .stockQuantity(10).reservedQuantity(0).lowStockThreshold(3)
                .build();

        lenient().when(productRepository.findById(product.getId())).thenReturn(Optional.of(product));
        lenient().when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(orderRepository.existsByOrderNumber(any())).thenReturn(false);
    }

    private ConsignmentRequest openRequest(int qty, BigDecimal commission) {
        ConsignmentRequest req = new ConsignmentRequest();
        req.setConsigneeId(consignee.getId());
        req.setCommissionRate(commission);
        ConsignmentRequest.Item it = new ConsignmentRequest.Item();
        it.setProductId(product.getId());
        it.setQuantity(qty);
        req.setItems(List.of(it));
        return req;
    }

    @Test
    @DisplayName("open reserva o estoque (disponível->reservado) e usa comissão do request")
    void open_reservesStock() {
        when(consigneeRepository.findById(consignee.getId())).thenReturn(Optional.of(consignee));
        when(consignmentRepository.save(any(Consignment.class))).thenAnswer(inv -> {
            Consignment c = inv.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });
        stubFindByIdWithItems();

        ConsignmentResponse resp = service.open(openRequest(5, new BigDecimal("0.25")));

        assertThat(resp.getStatus()).isEqualTo("ABERTO");
        // reserva efetivada: 5 saíram do disponível para o reservado
        assertThat(product.getStockQuantity()).isEqualTo(5);
        assertThat(product.getReservedQuantity()).isEqualTo(5);

        ArgumentCaptor<Consignment> captor = ArgumentCaptor.forClass(Consignment.class);
        verify(consignmentRepository).save(captor.capture());
        assertThat(captor.getValue().getCommissionRate()).isEqualByComparingTo("0.25");
    }

    @Test
    @DisplayName("open sem comissão no request usa a taxa da revendedora")
    void open_defaultsCommissionFromConsignee() {
        when(consigneeRepository.findById(consignee.getId())).thenReturn(Optional.of(consignee));
        when(consignmentRepository.save(any(Consignment.class))).thenAnswer(inv -> {
            Consignment c = inv.getArgument(0);
            if (c.getId() == null) c.setId(UUID.randomUUID());
            return c;
        });
        stubFindByIdWithItems();

        service.open(openRequest(2, null));

        ArgumentCaptor<Consignment> captor = ArgumentCaptor.forClass(Consignment.class);
        verify(consignmentRepository).save(captor.capture());
        assertThat(captor.getValue().getCommissionRate()).isEqualByComparingTo("0.30");
    }

    @Test
    @DisplayName("settle rejeita vendido > levado")
    void settle_rejectsSoldGreaterThanTaken() {
        Consignment c = consignmentWithItem(5, 0);
        when(consignmentRepository.findByIdWithItems(c.getId())).thenReturn(Optional.of(c));
        UUID itemId = c.getItems().get(0).getId();

        ConsignmentSettleRequest req = settleRequest(itemId, 9);
        assertThatThrownBy(() -> service.settle(c.getId(), req))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("inválida");
    }

    @Test
    @DisplayName("close: baixa vendidos, devolve o resto, gera venda CONSIGNADO e apura comissão do lote")
    void close_consumesSoldReleasesRestApportionsCommission() {
        // 5 levados (reservados), 3 vendidos; comissão 0.30; preço 50 → total=150, comissão=45, líquido=105
        product.setStockQuantity(5);
        product.setReservedQuantity(5);
        Consignment c = consignmentWithItem(5, 3);
        c.setCommissionRate(new BigDecimal("0.30"));
        when(consignmentRepository.findByIdWithItems(c.getId())).thenReturn(Optional.of(c));
        when(consignmentRepository.save(any(Consignment.class))).thenAnswer(inv -> inv.getArgument(0));

        ConsignmentResponse resp = service.close(c.getId(), null);

        // 3 consumidos do reservado (venda), 2 devolvidos ao disponível
        assertThat(product.getReservedQuantity()).isEqualTo(0);
        assertThat(product.getStockQuantity()).isEqualTo(7); // 5 + 2 devolvidos
        // venda consignada gerada (canal CONSIGNADO)
        ArgumentCaptor<Order> orderCaptor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(orderCaptor.capture());
        Order sale = orderCaptor.getValue();
        assertThat(sale.getChannel()).isEqualTo("CONSIGNADO");
        assertThat(sale.getStatus()).isEqualTo("CONFIRMADO");
        assertThat(sale.getTotalAmount()).isEqualByComparingTo("150.00");

        assertThat(resp.getStatus()).isEqualTo("FECHADO");
        assertThat(resp.getTotalSold()).isEqualByComparingTo("150.00");
        assertThat(resp.getCommissionAmount()).isEqualByComparingTo("45.00");
        assertThat(resp.getNetAmount()).isEqualByComparingTo("105.00");
    }

    @Test
    @DisplayName("close sem vendas não gera venda; devolve tudo ao estoque")
    void close_noSales_noOrder() {
        product.setStockQuantity(6);
        product.setReservedQuantity(4);
        Consignment c = consignmentWithItem(4, 0);
        c.setCommissionRate(new BigDecimal("0.30"));
        when(consignmentRepository.findByIdWithItems(c.getId())).thenReturn(Optional.of(c));
        when(consignmentRepository.save(any(Consignment.class))).thenAnswer(inv -> inv.getArgument(0));

        ConsignmentResponse resp = service.close(c.getId(), null);

        assertThat(product.getReservedQuantity()).isEqualTo(0);
        assertThat(product.getStockQuantity()).isEqualTo(10); // 6 + 4 devolvidos
        verify(orderRepository, never()).save(any(Order.class));
        assertThat(resp.getTotalSold()).isEqualByComparingTo("0.00");
        assertThat(resp.getCommissionAmount()).isEqualByComparingTo("0.00");
    }

    @Test
    @DisplayName("close num lote já fechado falha")
    void close_alreadyClosed_fails() {
        Consignment c = consignmentWithItem(4, 0);
        c.setStatus("FECHADO");
        when(consignmentRepository.findByIdWithItems(c.getId())).thenReturn(Optional.of(c));
        assertThatThrownBy(() -> service.close(c.getId(), null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("já foi fechado");
    }

    @Test
    @DisplayName("cancel libera todo o estoque reservado e marca CANCELADO")
    void cancel_releasesAll() {
        product.setStockQuantity(4);
        product.setReservedQuantity(6);
        Consignment c = consignmentWithItem(6, 0);
        when(consignmentRepository.findByIdWithItems(c.getId())).thenReturn(Optional.of(c));
        when(consignmentRepository.save(any(Consignment.class))).thenAnswer(inv -> inv.getArgument(0));

        ConsignmentResponse resp = service.cancel(c.getId());

        assertThat(product.getReservedQuantity()).isEqualTo(0);
        assertThat(product.getStockQuantity()).isEqualTo(10); // 4 + 6 liberados
        verify(orderRepository, never()).save(any(Order.class));
        assertThat(resp.getStatus()).isEqualTo("CANCELADO");
    }

    // ---- helpers ----

    private void stubFindByIdWithItems() {
        lenient().when(consignmentRepository.findByIdWithItems(any())).thenAnswer(inv -> {
            Consignment c = Consignment.builder()
                    .id(inv.getArgument(0)).consignee(consignee)
                    .status("ABERTO").commissionRate(new BigDecimal("0.25"))
                    .build();
            ConsignmentItem ci = ConsignmentItem.builder()
                    .id(UUID.randomUUID()).product(product)
                    .productSku("SKU-1").productName("Anel")
                    .quantity(5).soldQuantity(0).returnedQuantity(0)
                    .unitSalePrice(new BigDecimal("50.00")).build();
            c.getItems().add(ci);
            return Optional.of(c);
        });
    }

    private Consignment consignmentWithItem(int qty, int sold) {
        Consignment c = Consignment.builder()
                .id(UUID.randomUUID()).consignee(consignee)
                .status("ABERTO").commissionRate(new BigDecimal("0.30"))
                .build();
        ConsignmentItem ci = ConsignmentItem.builder()
                .id(UUID.randomUUID()).consignment(c).product(product)
                .productSku("SKU-1").productName("Anel")
                .quantity(qty).soldQuantity(sold).returnedQuantity(0)
                .unitSalePrice(new BigDecimal("50.00")).build();
        c.getItems().add(ci);
        return c;
    }

    private ConsignmentSettleRequest settleRequest(UUID itemId, int sold) {
        ConsignmentSettleRequest req = new ConsignmentSettleRequest();
        ConsignmentSettleRequest.Item it = new ConsignmentSettleRequest.Item();
        it.setItemId(itemId);
        it.setSoldQuantity(sold);
        req.setItems(List.of(it));
        return req;
    }
}
