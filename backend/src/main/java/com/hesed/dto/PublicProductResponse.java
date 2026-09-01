package com.hesed.dto;

import com.hesed.models.Product;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Visão PÚBLICA do produto (catálogo, sem autenticação).
 *
 * Deliberadamente NÃO expõe dados internos de negócio: preço de custo,
 * preço do fornecedor, quantidade numérica em estoque, limiar, fornecedor
 * ou data de compra. Esses campos são segredo comercial e só aparecem na
 * visão admin (ProductResponse), protegida por autenticação.
 *
 * O stockStatus (DISPONIVEL/BAIXO/ESGOTADO) é mantido pois é útil ao cliente
 * e não revela o número exato de peças.
 */
@Data
public class PublicProductResponse {
    private UUID id;
    private String sku;
    private String name;
    private String description;
    private String category;
    private String imageUrl;
    private List<String> imageUrls;
    private BigDecimal salePrice;
    private String stockStatus;

    public static PublicProductResponse from(Product p) {
        PublicProductResponse r = new PublicProductResponse();
        r.setId(p.getId());
        r.setSku(p.getSku());
        r.setName(p.getName());
        r.setDescription(p.getDescription());
        r.setCategory(p.getCategory());
        r.setImageUrl(p.getImageUrl());
        r.setImageUrls(p.getImageUrls());
        r.setSalePrice(p.getSalePrice());
        r.setStockStatus(p.getStockStatus());
        return r;
    }
}
