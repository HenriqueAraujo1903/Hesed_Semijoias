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
            int qty = item.getQuantity() != null ? item.getQuantity() : 1;
            applyMovement(product, "ESTORNO", qty,
                    "Estorno pedido " + order.getOrderNumber(), order.getId());
        }
    }
}
