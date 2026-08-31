package com.hesed.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class ProductRequest {

    @NotBlank(message = "SKU obrigatório")
    @Size(max = 50, message = "SKU deve ter no máximo 50 caracteres")
    @Pattern(regexp = "^[A-Za-z0-9_\\-]+$", message = "SKU deve conter apenas letras, números, _ e -")
    private String sku;

    @NotBlank(message = "Nome obrigatório")
    @Size(min = 3, max = 120, message = "Nome deve ter entre 3 e 120 caracteres")
    private String name;

    @Size(max = 500, message = "Descrição deve ter no máximo 500 caracteres")
    private String description;

    private String category = "Brinco";

    /** Foto principal (capa). Opcional se imageUrls for informado. */
    private String imageUrl;

    /** Galeria de fotos (até 5). A primeira é a capa. */
    @Size(max = 5, message = "Um produto pode ter no máximo 5 fotos")
    private List<String> imageUrls;

    @NotNull(message = "Preço de custo obrigatório")
    @Positive(message = "Preço de custo deve ser maior que zero")
    private BigDecimal costPrice;

    @NotNull(message = "Preço de venda obrigatório")
    @Positive(message = "Preço de venda deve ser maior que zero")
    private BigDecimal salePrice;

    private String stockStatus = "DISPONIVEL";
}
