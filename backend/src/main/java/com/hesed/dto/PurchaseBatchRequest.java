package com.hesed.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Registro de uma entrada de compra em lote. Cada item pode referenciar um
 * produto EXISTENTE (repõe estoque) ou descrever um produto NOVO (cria o SKU).
 * O total é calculado no serviço a partir dos itens; o parcelamento gera a
 * conta a pagar ao fornecedor.
 */
@Data
public class PurchaseBatchRequest {

    @NotNull(message = "Informe o fornecedor.")
    private UUID supplierId;

    @NotNull(message = "Informe a data da compra.")
    private LocalDate purchaseDate;

    @Min(value = 1, message = "O número de parcelas deve ser ao menos 1.")
    private Integer installmentsCount;

    /** Vencimento da 1ª parcela (as demais caem no mesmo dia dos meses seguintes). */
    private LocalDate firstDueDate;

    private String notes;

    @NotEmpty(message = "Adicione ao menos um item à compra.")
    private List<Item> items;

    @Data
    public static class Item {
        /** Se informado, repõe estoque de um produto existente. */
        private UUID productId;

        // Para produto NOVO (quando productId é nulo):
        private String sku;
        private String name;
        private String category;
        /** Preço de venda do produto novo (obrigatório se for novo). */
        private BigDecimal salePrice;

        /** Custo unitário pago ao fornecedor nesta compra (obrigatório). */
        @NotNull(message = "Informe o custo unitário do item.")
        private BigDecimal unitCost;

        @NotNull(message = "Informe a quantidade do item.")
        @Min(value = 1, message = "A quantidade deve ser ao menos 1.")
        private Integer quantity;
    }
}
