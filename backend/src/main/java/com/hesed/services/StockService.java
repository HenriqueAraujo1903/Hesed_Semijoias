package com.hesed.services;

import com.hesed.models.Order;
import com.hesed.models.OrderItem;
import com.hesed.models.Product;
import com.hesed.models.StockMovement;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.StockMovementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Centraliza toda alteração de quantidade em estoque. Toda mudança passa por
 * aqui para: (1) aplicar o delta com piso em zero, (2) re-derivar o stockStatus
 * a partir da nova quantidade, e (3) registrar um StockMovement (auditoria).
 */
@Service
public class StockService {

    private final ProductRepository productRepository;
    private final StockMovementRepository movementRepository;

    public StockService(ProductRepository productRepository,
                        StockMovementRepository movementRepository) {
        this.productRepository = productRepository;
        this.movementRepository = movementRepository;
    }

    /**
     * Aplica uma variação de estoque a um produto e registra o movimento.
     * O estoque nunca fica negativo (piso em 0). Retorna o produto salvo.
     */
    @Transactional
    public Product applyMovement(Product product, String type, int delta, String reason, UUID orderId) {
        int current = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
        int next = current + delta;
        if (next < 0) next = 0;

        product.setStockQuantity(next);
        product.setStockStatus(ProductService.deriveStockStatus(next, product.getLowStockThreshold()));
        Product saved = productRepository.save(product);

        StockMovement mov = StockMovement.builder()
                .product(saved)
                .type(type)
                .delta(delta)
                .resultingQuantity(next)
                .reason(reason)
                .orderId(orderId)
                .build();
        movementRepository.save(mov);

        return saved;
    }

    /** Ajuste manual: define o estoque para um valor absoluto (correção de inventário). */
    @Transactional
    public Product setAbsolute(UUID productId, int newQuantity, String reason) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));
        int current = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
        int qty = Math.max(0, newQuantity);
        int delta = qty - current;
        return applyMovement(product, "AJUSTE",
                delta, reason != null && !reason.isBlank() ? reason : "Ajuste manual de estoque", null);
    }

    /** Entrada de estoque (compra do fornecedor, reposição). */
    @Transactional
    public Product addStock(UUID productId, int quantity, String reason) {
        if (quantity <= 0) throw new RuntimeException("A quantidade de entrada deve ser positiva.");
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));
        return applyMovement(product, "ENTRADA", quantity,
                reason != null && !reason.isBlank() ? reason : "Entrada de estoque", null);
    }

    /**
     * Dá baixa no estoque dos itens de um pedido (chamado ao CONFIRMAR).
     * Ignora itens cujo produto foi excluído (product == null). Idempotência é
     * responsabilidade do chamador (só chamar na transição PENDENTE→CONFIRMADO).
     */
    @Transactional
    public void consumeForOrder(Order order) {
        for (OrderItem item : order.getItems()) {
            Product product = item.getProduct();
            if (product == null) continue;
            // Sob encomenda não tem estoque próprio: não dá baixa nem gera movimento.
            if (Boolean.TRUE.equals(product.getOnDemand())) continue;
            int qty = item.getQuantity() != null ? item.getQuantity() : 1;
            applyMovement(product, "SAIDA", -qty,
                    "Venda pedido " + order.getOrderNumber(), order.getId());
        }
    }

    /**
     * Estorna o estoque dos itens de um pedido (ao CANCELAR um pedido que estava
     * CONFIRMADO — a peça volta para o estoque).
     */
    @Transactional
    public void restockForOrder(Order order) {
        for (OrderItem item : order.getItems()) {
            Product product = item.getProduct();
            if (product == null) continue;
            // Sob encomenda não tem estoque próprio: não há o que estornar.
            if (Boolean.TRUE.equals(product.getOnDemand())) continue;
            int qty = item.getQuantity() != null ? item.getQuantity() : 1;
            applyMovement(product, "ESTORNO", qty,
                    "Estorno pedido " + order.getOrderNumber(), order.getId());
        }
    }

    // ===========================================================================
    // Reserva (consignação): move entre "disponível" (stockQuantity) e
    // "reservado" (reservedQuantity). A reserva NÃO é venda — a peça continua
    // nossa, só está fisicamente fora (com a revendedora).
    // ===========================================================================

    /**
     * Reserva `qty` unidades: disponível → reservado. Não pode reservar mais do
     * que há disponível. Registra movimento RESERVA (delta negativo no disponível).
     */
    @Transactional
    public Product reserve(UUID productId, int qty, String reason) {
        if (qty <= 0) throw new RuntimeException("A quantidade a reservar deve ser positiva.");
        Product p = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));
        int available = p.getStockQuantity() != null ? p.getStockQuantity() : 0;
        if (qty > available) {
            throw new RuntimeException("Estoque insuficiente para reservar " + qty
                    + " de " + p.getName() + " (disponível: " + available + ").");
        }
        int reserved = p.getReservedQuantity() != null ? p.getReservedQuantity() : 0;
        p.setStockQuantity(available - qty);
        p.setReservedQuantity(reserved + qty);
        p.setStockStatus(ProductService.deriveStockStatus(p.getStockQuantity(), p.getLowStockThreshold()));
        Product saved = productRepository.save(p);
        recordMovement(saved, "RESERVA", -qty, saved.getStockQuantity(), reason);
        return saved;
    }

    /**
     * Libera `qty` unidades reservadas de volta ao disponível: reservado → disponível.
     * Usado quando a peça consignada é devolvida. Registra movimento LIBERACAO.
     */
    @Transactional
    public Product releaseReservation(UUID productId, int qty, String reason) {
        if (qty <= 0) return productRepository.findById(productId).orElse(null);
        Product p = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));
        int reserved = p.getReservedQuantity() != null ? p.getReservedQuantity() : 0;
        int toRelease = Math.min(qty, reserved); // não libera mais do que está reservado
        int available = p.getStockQuantity() != null ? p.getStockQuantity() : 0;
        p.setReservedQuantity(reserved - toRelease);
        p.setStockQuantity(available + toRelease);
        p.setStockStatus(ProductService.deriveStockStatus(p.getStockQuantity(), p.getLowStockThreshold()));
        Product saved = productRepository.save(p);
        recordMovement(saved, "LIBERACAO", toRelease, saved.getStockQuantity(), reason);
        return saved;
    }

    /**
     * Consome `qty` unidades reservadas (venda consignada efetivada): sai da
     * reserva de vez — não volta ao disponível. Registra movimento SAIDA.
     */
    @Transactional
    public Product consumeReserved(UUID productId, int qty, String reason, UUID orderId) {
        if (qty <= 0) return productRepository.findById(productId).orElse(null);
        Product p = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));
        int reserved = p.getReservedQuantity() != null ? p.getReservedQuantity() : 0;
        int toConsume = Math.min(qty, reserved);
        p.setReservedQuantity(reserved - toConsume);
        Product saved = productRepository.save(p);
        StockMovement mov = StockMovement.builder()
                .product(saved).type("SAIDA").delta(-toConsume)
                .resultingQuantity(saved.getStockQuantity() != null ? saved.getStockQuantity() : 0)
                .reason(reason).orderId(orderId).build();
        movementRepository.save(mov);
        return saved;
    }

    /** Registra um StockMovement sem alterar quantidade (o chamador já ajustou). */
    private void recordMovement(Product product, String type, int delta, int resulting, String reason) {
        StockMovement mov = StockMovement.builder()
                .product(product).type(type).delta(delta)
                .resultingQuantity(resulting).reason(reason).build();
        movementRepository.save(mov);
    }
}
