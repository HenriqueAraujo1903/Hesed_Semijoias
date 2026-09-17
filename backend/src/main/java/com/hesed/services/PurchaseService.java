package com.hesed.services;

import com.hesed.dto.PurchaseBatchRequest;
import com.hesed.dto.PurchaseBatchResponse;
import com.hesed.models.*;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.PurchaseBatchRepository;
import com.hesed.repositories.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Entrada de compra em lote: dá entrada no estoque (produtos novos ou existentes)
 * e gera UMA conta a pagar parcelável ao fornecedor.
 *
 * Regra de custo (opção A/2): a compra vira estoque (ativo), NÃO despesa
 * operacional. A conta a pagar usa a categoria "Compra de mercadoria"
 * (não-operacional), que é excluída do DRE — o custo só é reconhecido como CMV
 * na venda. Assim não há custo em dobro.
 */
@Service
public class PurchaseService {

    private final PurchaseBatchRepository batchRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;
    private final StockService stockService;
    private final FinanceService financeService;

    public PurchaseService(PurchaseBatchRepository batchRepository,
                           SupplierRepository supplierRepository,
                           ProductRepository productRepository,
                           StockService stockService,
                           FinanceService financeService) {
        this.batchRepository = batchRepository;
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
        this.stockService = stockService;
        this.financeService = financeService;
    }

    public List<PurchaseBatchResponse> listBatches() {
        return batchRepository.findAllWithSupplier().stream()
                .map(b -> PurchaseBatchResponse.from(reload(b.getId())))
                .toList();
    }

    public PurchaseBatchResponse getBatch(UUID id) {
        return PurchaseBatchResponse.from(reload(id));
    }

    private PurchaseBatch reload(UUID id) {
        return batchRepository.findByIdWithItems(id)
                .orElseThrow(() -> new RuntimeException("Compra não encontrada."));
    }

    @Transactional
    public PurchaseBatchResponse createBatch(PurchaseBatchRequest req) {
        if (req.getItems() == null || req.getItems().isEmpty()) {
            throw new RuntimeException("Adicione ao menos um item à compra.");
        }

        Supplier supplier = supplierRepository.findById(req.getSupplierId())
                .orElseThrow(() -> new RuntimeException("Fornecedor não encontrado."));

        LocalDate purchaseDate = req.getPurchaseDate() != null ? req.getPurchaseDate() : LocalDate.now();
        int installments = (req.getInstallmentsCount() == null || req.getInstallmentsCount() < 1)
                ? 1 : req.getInstallmentsCount();

        PurchaseBatch batch = PurchaseBatch.builder()
                .supplier(supplier)
                .purchaseDate(purchaseDate)
                .installmentsCount(installments)
                .notes(trimToNull(req.getNotes()))
                .totalAmount(BigDecimal.ZERO)
                .build();

        BigDecimal total = BigDecimal.ZERO;
        String reason = "Compra em lote - fornecedor " + supplier.getName();

        for (PurchaseBatchRequest.Item reqItem : req.getItems()) {
            if (reqItem.getUnitCost() == null || reqItem.getUnitCost().signum() <= 0) {
                throw new RuntimeException("Informe um custo unitário maior que zero para todos os itens.");
            }
            int qty = reqItem.getQuantity() != null ? reqItem.getQuantity() : 0;
            if (qty < 1) throw new RuntimeException("A quantidade de cada item deve ser ao menos 1.");
            BigDecimal unitCost = scale(reqItem.getUnitCost());

            Product product;
            boolean created = false;

            if (reqItem.getProductId() != null) {
                // Produto existente: repõe estoque e atualiza o custo para o desta compra.
                product = productRepository.findById(reqItem.getProductId())
                        .orElseThrow(() -> new RuntimeException("Produto não encontrado: " + reqItem.getProductId()));
                product.setCostPrice(unitCost);
                product.setSupplier(supplier);
                if (product.getPurchaseDate() == null) product.setPurchaseDate(purchaseDate);
                stockService.applyMovement(product, "ENTRADA", qty, reason, null);
            } else {
                // Produto novo: cria o SKU com custo, venda e quantidade da compra.
                String sku = trimToNull(reqItem.getSku());
                String name = trimToNull(reqItem.getName());
                if (sku == null) throw new RuntimeException("Informe o SKU do produto novo.");
                if (name == null) throw new RuntimeException("Informe o nome do produto novo.");
                if (productRepository.existsBySku(sku)) {
                    throw new RuntimeException("Já existe um produto com o SKU '" + sku + "'. Selecione-o como item existente.");
                }
                if (reqItem.getSalePrice() == null || reqItem.getSalePrice().signum() <= 0) {
                    throw new RuntimeException("Informe o preço de venda do produto novo '" + name + "'.");
                }
                int threshold = 3;
                product = Product.builder()
                        .sku(sku)
                        .name(name)
                        .category(reqItem.getCategory() != null && !reqItem.getCategory().isBlank()
                                ? reqItem.getCategory().trim() : "Outros")
                        .costPrice(unitCost)
                        .salePrice(scale(reqItem.getSalePrice()))
                        .supplier(supplier)
                        .purchaseDate(purchaseDate)
                        .stockQuantity(qty)
                        .lowStockThreshold(threshold)
                        .stockStatus(ProductService.deriveStockStatus(qty, threshold))
                        .build();
                product = productRepository.save(product);
                // Registra o movimento de entrada inicial (auditoria de estoque).
                stockService.applyMovement(product, "ENTRADA", 0, reason + " (cadastro inicial)", null);
                created = true;
            }

            BigDecimal subtotal = unitCost.multiply(BigDecimal.valueOf(qty));
            total = total.add(subtotal);

            batch.getItems().add(PurchaseBatchItem.builder()
                    .batch(batch)
                    .product(product)
                    .productSku(product.getSku())
                    .productName(product.getName())
                    .unitCost(unitCost)
                    .quantity(qty)
                    .createdProduct(created)
                    .build());
        }

        total = scale(total);
        batch.setTotalAmount(total);

        // Gera a conta a pagar (categoria não-operacional "Compra de mercadoria").
        ExpenseCategory category = financeService.purchaseCategory();
        String desc = "Compra " + supplier.getName() + " — " + batch.getItems().size()
                + (batch.getItems().size() == 1 ? " item" : " itens");
        Expense expense = financeService.createExpenseInternal(
                desc, category, supplier, total, purchaseDate,
                installments, req.getFirstDueDate(), req.getNotes());
        batch.setExpense(expense);

        PurchaseBatch saved = batchRepository.save(batch);
        return PurchaseBatchResponse.from(reload(saved.getId()));
    }

    // ---- helpers ----

    private BigDecimal scale(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
