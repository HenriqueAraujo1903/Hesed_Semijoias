package com.hesed.services;

import com.hesed.dto.ProductRequest;
import com.hesed.dto.ProductResponse;
import com.hesed.dto.PublicProductResponse;
import com.hesed.models.Product;
import com.hesed.models.Promotion;
import com.hesed.models.Supplier;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.PromotionRepository;
import com.hesed.repositories.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final SupplierRepository supplierRepository;
    private final PromotionRepository promotionRepository;

    public ProductService(ProductRepository productRepository,
                          SupplierRepository supplierRepository,
                          PromotionRepository promotionRepository) {
        this.productRepository = productRepository;
        this.supplierRepository = supplierRepository;
        this.promotionRepository = promotionRepository;
    }

    // ---- Visão PÚBLICA (catálogo, sem auth): não expõe custo/estoque/fornecedor ----

    public List<PublicProductResponse> findAllPublic(String category, String stockStatus, String search) {
        Map<UUID, Promotion> promoByProduct = activePromotionsByProduct();
        return productRepository.findFiltered(category, stockStatus, search)
                .stream()
                .map(p -> PublicProductResponse.from(p, promoByProduct.get(p.getId())))
                .toList();
    }

    public List<PublicProductResponse> findForCatalog() {
        Map<UUID, Promotion> promoByProduct = activePromotionsByProduct();
        return productRepository.findAllForCatalog()
                .stream()
                .map(p -> PublicProductResponse.from(p, promoByProduct.get(p.getId())))
                .toList();
    }

    /**
     * Mapa produto → promoção ativa vigente (a primeira, respeitando a ordem
     * sortOrder/createdAt de findActivePromotions). Uma única query evita o
     * N+1 de consultar promoção por produto.
     */
    private Map<UUID, Promotion> activePromotionsByProduct() {
        LocalDateTime now = LocalDateTime.now();
        Map<UUID, Promotion> map = new java.util.HashMap<>();
        for (Promotion promo : promotionRepository.findActivePromotions(now)) {
            if (promo.getProduct() == null) continue;
            // findActivePromotions já vem ordenado; mantém a primeira por produto.
            map.putIfAbsent(promo.getProduct().getId(), promo);
        }
        return map;
    }

    // ---- Visão ADMIN (autenticada): dados completos, incluindo custo/estoque ----

    public List<ProductResponse> findAllAdmin(String category, String stockStatus, String search) {
        return productRepository.findFiltered(category, stockStatus, search)
                .stream()
                .map(ProductResponse::from)
                .toList();
    }

    public ProductResponse findById(UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));
        return ProductResponse.from(product);
    }

    /** Usado internamente pelo import CSV para checar existência por SKU. */
    public boolean existsAnyBySearch(String search) {
        return !productRepository.findFiltered(null, null, search).isEmpty();
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        if (productRepository.existsBySku(request.getSku())) {
            throw new RuntimeException("Já existe um produto com este SKU.");
        }

        Product product = Product.builder()
                .sku(request.getSku())
                .name(request.getName())
                .description(request.getDescription())
                .category(request.getCategory())
                .supplierPrice(request.getSupplierPrice())
                .costPrice(request.getCostPrice())
                .salePrice(request.getSalePrice())
                .build();

        applyImages(product, request);
        applyStockAndWarranty(product, request);

        return ProductResponse.from(productRepository.save(product));
    }

    @Transactional
    public ProductResponse update(UUID id, ProductRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Produto não encontrado."));

        // Check SKU uniqueness if changed
        if (!product.getSku().equals(request.getSku()) && productRepository.existsBySku(request.getSku())) {
            throw new RuntimeException("Já existe um produto com este SKU.");
        }

        product.setSku(request.getSku());
        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setCategory(request.getCategory());
        product.setSupplierPrice(request.getSupplierPrice());
        product.setCostPrice(request.getCostPrice());
        product.setSalePrice(request.getSalePrice());
        applyImages(product, request);
        applyStockAndWarranty(product, request);

        return ProductResponse.from(productRepository.save(product));
    }

    @Transactional
    public void delete(UUID id) {
        if (!productRepository.existsById(id)) {
            throw new RuntimeException("Produto não encontrado.");
        }
        productRepository.deleteById(id);
    }

    @Transactional
    public ProductResponse upsertBySku(ProductRequest request) {
        Product existing = productRepository.findBySku(request.getSku()).orElse(null);

        boolean hasImages = (request.getImageUrls() != null && !request.getImageUrls().isEmpty())
                || (request.getImageUrl() != null && !request.getImageUrl().isBlank());

        if (existing != null) {
            existing.setName(request.getName());
            existing.setCategory(request.getCategory());
            if (request.getSupplierPrice() != null) existing.setSupplierPrice(request.getSupplierPrice());
            existing.setCostPrice(request.getCostPrice());
            existing.setSalePrice(request.getSalePrice());
            if (request.getDescription() != null) existing.setDescription(request.getDescription());
            // Só mexe nas imagens se o request trouxer alguma (evita apagar galeria em reimport sem fotos)
            if (hasImages) applyImages(existing, request);
            // Estoque/garantia: só atualiza o que o request trouxer (import CSV não envia esses campos)
            applyStockAndWarranty(existing, request);
            return ProductResponse.from(productRepository.save(existing));
        }

        Product product = Product.builder()
                .sku(request.getSku())
                .name(request.getName())
                .description(request.getDescription())
                .category(request.getCategory())
                .supplierPrice(request.getSupplierPrice())
                .costPrice(request.getCostPrice())
                .salePrice(request.getSalePrice())
                .build();

        applyImages(product, request);
        applyStockAndWarranty(product, request);

        return ProductResponse.from(productRepository.save(product));
    }

    // ---- helpers ----

    /**
     * Normaliza a galeria de imagens: prioriza imageUrls; se ausente, usa imageUrl
     * (retrocompatibilidade). Remove nulos/duplicados, limita a 5 e mantém a capa
     * (imageUrl) sincronizada com a primeira foto da galeria.
     */
    private void applyImages(Product product, ProductRequest request) {
        java.util.List<String> gallery = new java.util.ArrayList<>();
        if (request.getImageUrls() != null && !request.getImageUrls().isEmpty()) {
            for (String url : request.getImageUrls()) {
                if (url != null && !url.isBlank() && !gallery.contains(url)) gallery.add(url);
            }
        } else if (request.getImageUrl() != null && !request.getImageUrl().isBlank()) {
            gallery.add(request.getImageUrl());
        }

        if (gallery.size() > 5) {
            throw new RuntimeException("Um produto pode ter no máximo 5 fotos.");
        }

        product.setImageUrls(gallery);
        product.setImageUrl(gallery.isEmpty() ? null : gallery.get(0));
    }

    /**
     * Aplica estoque, fornecedor e garantia. Só sobrescreve campos que o request
     * traz preenchidos (import CSV e chamadas antigas não os enviam → preservados).
     *
     * Regra de estoque:
     * - Se o request traz stockQuantity, ela é a fonte da verdade e o stockStatus
     *   é DERIVADO dela.
     * - Se NÃO traz stockQuantity mas traz um stockStatus explícito (import CSV e
     *   chamadas legadas), respeitamos esse status e semeamos uma quantidade
     *   coerente — para não quebrar a retrocompatibilidade (senão tudo viraria
     *   ESGOTADO por causa do default 0).
     */
    private void applyStockAndWarranty(Product product, ProductRequest request) {
        // Sob encomenda (só sobrescreve se o request trouxer o campo).
        if (request.getOnDemand() != null) {
            product.setOnDemand(request.getOnDemand());
        }
        if (request.getLeadTimeDays() != null) {
            product.setLeadTimeDays(Math.max(0, request.getLeadTimeDays()));
        }
        if (request.getLowStockThreshold() != null) {
            product.setLowStockThreshold(Math.max(0, request.getLowStockThreshold()));
        }
        if (request.getWarrantyMonths() != null) {
            product.setWarrantyMonths(Math.max(0, request.getWarrantyMonths()));
        }
        if (request.getPurchaseDate() != null) {
            product.setPurchaseDate(request.getPurchaseDate());
        }
        if (request.getSupplierId() != null) {
            Supplier supplier = supplierRepository.findById(request.getSupplierId())
                    .orElseThrow(() -> new RuntimeException("Fornecedor não encontrado."));
            product.setSupplier(supplier);
        }

        int threshold = product.getLowStockThreshold() != null ? product.getLowStockThreshold() : 3;

        if (request.getStockQuantity() != null) {
            // Quantidade explícita manda; status derivado dela.
            int qty = Math.max(0, request.getStockQuantity());
            product.setStockQuantity(qty);
            product.setStockStatus(deriveStockStatus(qty, threshold));
        } else if (request.getStockStatus() != null && !request.getStockStatus().isBlank()) {
            // Retrocompat: sem quantidade, mas com status explícito (CSV/legado).
            // Semeia uma quantidade coerente com o status informado, sem sobrescrever
            // um estoque já existente que seja compatível.
            String status = request.getStockStatus().trim().toUpperCase();
            int current = product.getStockQuantity() != null ? product.getStockQuantity() : 0;
            if (!deriveStockStatus(current, threshold).equals(status)) {
                product.setStockQuantity(seedQuantityForStatus(status, threshold));
            }
            product.setStockStatus(deriveStockStatus(product.getStockQuantity(), threshold));
        } else {
            // Nada informado: apenas re-deriva do que já existe.
            product.setStockStatus(deriveStockStatus(product.getStockQuantity(), threshold));
        }

        // Sob encomenda é sempre comprável: o status nunca vira ESGOTADO/BAIXO por
        // quantidade — sobrescreve para DISPONIVEL independentemente do estoque.
        if (Boolean.TRUE.equals(product.getOnDemand())) {
            product.setStockStatus("DISPONIVEL");
        }
    }

    /** Quantidade inicial coerente com um status textual (retrocompat CSV/legado). */
    private int seedQuantityForStatus(String status, int threshold) {
        return switch (status) {
            case "ESGOTADO" -> 0;
            case "BAIXO" -> Math.max(1, threshold);
            default -> threshold + 5; // DISPONIVEL ou qualquer outro
        };
    }

    /**
     * Regra de derivação do status de estoque:
     * 0 (ou nulo) = ESGOTADO; até o limiar = BAIXO; acima = DISPONIVEL.
     */
    public static String deriveStockStatus(Integer quantity, Integer threshold) {
        int q = quantity != null ? quantity : 0;
        int t = threshold != null ? threshold : 3;
        if (q <= 0) return "ESGOTADO";
        if (q <= t) return "BAIXO";
        return "DISPONIVEL";
    }
}
