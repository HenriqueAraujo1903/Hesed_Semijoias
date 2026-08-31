package com.hesed.config;

import com.hesed.models.Product;
import com.hesed.repositories.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class DataInitializer {

    /**
     * Não há seed automático de catálogo/usuários (decisão explícita).
     *
     * Contém apenas uma MIGRAÇÃO DE DADOS idempotente para a introdução do
     * estoque numérico: produtos que existiam antes da feature têm
     * stockQuantity=0 (default da coluna nova), mas seu stockStatus reflete a
     * curadoria manual anterior (DISPONIVEL/BAIXO/ESGOTADO). Sem alinhar isso,
     * um produto "DISPONIVEL" apareceria como esgotado no controle numérico.
     *
     * A migração dá uma quantidade inicial coerente com o status atual, apenas
     * uma vez: só toca produtos com quantidade 0 cujo status NÃO é ESGOTADO —
     * uma combinação impossível de acontecer depois da feature (a quantidade 0
     * sempre deriva ESGOTADO). Assim é seguro reexecutar no startup.
     */
    @Bean
    CommandLineRunner initData(ProductRepository productRepository) {
        return args -> {
            backfillStockQuantities(productRepository);
            System.out.println("🌿 HESED API pronta!");
        };
    }

    private void backfillStockQuantities(ProductRepository productRepository) {
        List<Product> all = productRepository.findAll();
        int migrated = 0;
        for (Product p : all) {
            int qty = p.getStockQuantity() != null ? p.getStockQuantity() : 0;
            String status = p.getStockStatus();
            // Só backfill de itens pré-migração: quantidade 0 mas marcados como
            // disponível/baixo (inconsistência que só existe em dados antigos).
            if (qty == 0 && status != null && !status.equalsIgnoreCase("ESGOTADO")) {
                int threshold = p.getLowStockThreshold() != null ? p.getLowStockThreshold() : 3;
                if (status.equalsIgnoreCase("BAIXO")) {
                    p.setStockQuantity(Math.max(1, threshold));      // dentro da faixa "baixo"
                } else { // DISPONIVEL (ou qualquer outro não-esgotado)
                    p.setStockQuantity(threshold + 5);               // acima do limiar
                }
                productRepository.save(p);
                migrated++;
            }
        }
        if (migrated > 0) {
            System.out.println("📦 Migração de estoque: " + migrated + " produto(s) receberam quantidade inicial.");
        }
    }
}
