package com.hesed.config;

import com.hesed.models.Product;
import com.hesed.repositories.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.util.List;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner initData(ProductRepository productRepository) {
        return args -> {
            // Os usuários admin são gerenciados diretamente no banco de dados.
            // Não recriamos usuários seed padrão para evitar reintroduzir
            // credenciais padrão inseguras em produção.

            // Seed products
            List<ProductSeed> seeds = List.of(
                new ProductSeed("BRI5806-P", "Trio de Brincos Argolas Largas 5 Filetes de Zircônias Folheado Ouro 18k", "Brinco / Trio", 68.70, 458.00, "BAIXO"),
                new ProductSeed("BRI6137", "Brinco Redondo com Pedra Central Cravejado Zircônias Folheado Ouro 18k", "Brinco", 29.70, 198.00, "BAIXO"),
                new ProductSeed("BRI6310", "Trio de Brincos Pequenos Pérolas com Zircônias Folheado Ouro 18k", "Brinco / Trio", 23.70, 158.00, "BAIXO"),
                new ProductSeed("BRI6370", "Brinco Pequeno Oval com Zircônias Folheado Ouro 18k", "Brinco", 16.50, 110.00, "BAIXO"),
                new ProductSeed("BRI6424", "Brinco Médio Base Folhas Cravejada Zircônias e Pendente Pérola Folheado Ouro 18K", "Brinco", 25.20, 168.00, "ESGOTADO"),
                new ProductSeed("BRI6459", "Brinco Pequeno Coruja com Zircônia Folheado Ouro 18k", "Brinco", 20.70, 138.00, "BAIXO"),
                new ProductSeed("BRI6462", "Brinco Argola Retangular 2 Filetes de Zircônias Folheado Ouro 18k", "Brinco", 20.70, 138.00, "BAIXO"),
                new ProductSeed("BRI6465", "Brinco Pendente Coração Pedra Olho de Gato Resina Folheado Ouro 18k", "Brinco", 19.20, 128.00, "BAIXO"),
                new ProductSeed("BRI3183", "Brinco Argola Média Trabalhada em X Folheado Prata 1000", "Brinco", 18.60, 124.00, "BAIXO"),
                new ProductSeed("CON617", "Conjunto Redondo Ponto Luz Zircônia Folheado Ouro 18K + Caixa", "Conjunto", 19.80, 132.00, "BAIXO"),
                new ProductSeed("CON564", "Conjunto Gota Zircônias Folheado Ouro 18K + Caixa", "Conjunto", 19.80, 132.00, "BAIXO"),
                new ProductSeed("CON964", "Conjunto Cacho de Uva Cravejado com Zircônias Folheado Ouro 18K", "Conjunto", 38.70, 258.00, "BAIXO"),
                new ProductSeed("CON967", "Conjunto Pérola com Gota Lisa e Zircônia Folheado Ouro 18K", "Conjunto", 40.20, 268.00, "ESGOTADO"),
                new ProductSeed("COR263", "Corrente Feminina Elo Alongado 1,9mm 45cm Folheado Ouro 18k", "Corrente", 20.70, 138.00, "BAIXO"),
                new ProductSeed("GAR2114", "Gargantilha Coração Pequeno com Zircônias Folheado Ouro 18K", "Gargantilha", 23.70, 158.00, "BAIXO"),
                new ProductSeed("BRI6452", "Trio de Brincos Pequenos Borboletas com Zircônias Folheado Ouro 18k", "Brinco / Trio", 29.70, 198.00, "BAIXO")
            );

            int created = 0;
            for (ProductSeed s : seeds) {
                if (!productRepository.existsBySku(s.sku)) {
                    productRepository.save(Product.builder()
                            .sku(s.sku)
                            .name(s.name)
                            .category(s.category)
                            .costPrice(BigDecimal.valueOf(s.costPrice))
                            .salePrice(BigDecimal.valueOf(s.salePrice))
                            .stockStatus(s.stockStatus)
                            .build());
                    created++;
                }
            }

            if (created > 0) {
                System.out.println("✅ " + created + " produto(s) de exemplo criado(s).");
            }

            System.out.println("\n🌿 HESED API pronta!");
            System.out.println("   Login: POST /api/auth/login");
        };
    }

    private record ProductSeed(String sku, String name, String category, double costPrice, double salePrice, String stockStatus) {}
}
