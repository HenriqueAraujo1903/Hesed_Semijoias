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
    CommandLineRunner initData(ProductRepository productRepository,
                               com.hesed.repositories.MessageTemplateRepository messageTemplateRepository,
                               com.hesed.repositories.CategoryRepository categoryRepository,
                               com.hesed.repositories.ExpenseCategoryRepository expenseCategoryRepository,
                               com.hesed.repositories.PaymentRepository paymentRepository) {
        return args -> {
            backfillStockQuantities(productRepository);
            seedMessageTemplates(messageTemplateRepository);
            seedCategories(categoryRepository, productRepository);
            seedExpenseCategories(expenseCategoryRepository);
            backfillOrderPayments(paymentRepository);
            System.out.println("🌿 HESED API pronta!");
        };
    }

    /**
     * MIGRAÇÃO DE DADOS idempotente para o módulo financeiro: pedidos que já
     * estavam CONFIRMADO antes de existir o registro de pagamentos ficaram sem
     * nenhum {@link com.hesed.models.Payment}. Sem Payment não há
     * {@link com.hesed.models.PaymentSettlement}, então essas vendas não
     * apareciam no FLUXO DE CAIXA (que é dirigido pelas liquidações).
     *
     * Este backfill cria, para cada pedido confirmado sem pagamento, um Payment
     * à vista — método DINHEIRO, sem taxa (líquido = total do pedido) — com uma
     * liquidação D+0 na data em que o pedido foi confirmado ({@code resolvedAt},
     * com fallback para {@code orderedAt}). Assim a venda entra no caixa na data
     * correta. O DRE já enxergava essas vendas (lê direto dos pedidos
     * CONFIRMADO), então não é afetado.
     *
     * Idempotente: uma vez que o pedido ganha um Payment (por este backfill ou
     * por registro manual), deixa de ser selecionado. Seguro reexecutar no boot.
     */
    private void backfillOrderPayments(com.hesed.repositories.PaymentRepository paymentRepository) {
        List<com.hesed.models.Order> pending = paymentRepository.findConfirmedOrdersWithoutPayment();
        int migrated = 0;
        for (com.hesed.models.Order order : pending) {
            java.math.BigDecimal total = order.getTotalAmount() != null
                    ? order.getTotalAmount() : java.math.BigDecimal.ZERO;
            // Data de competência/recebimento: quando o pedido foi confirmado.
            java.time.LocalDateTime paidAt = order.getResolvedAt() != null
                    ? order.getResolvedAt()
                    : (order.getOrderedAt() != null ? order.getOrderedAt() : java.time.LocalDateTime.now());

            com.hesed.models.Payment payment = com.hesed.models.Payment.builder()
                    .order(order)
                    .method("DINHEIRO")
                    .grossAmount(total)
                    .feeAmount(java.math.BigDecimal.ZERO)
                    .netAmount(total)
                    .installments(1)
                    .paidAt(paidAt)
                    .notes("Pagamento registrado automaticamente (migração do módulo financeiro).")
                    .build();

            // Liquidação D+0: dinheiro entra no caixa na data da venda.
            payment.getSettlements().add(com.hesed.models.PaymentSettlement.builder()
                    .payment(payment)
                    .installmentNumber(1)
                    .netAmount(total)
                    .expectedDate(paidAt.toLocalDate())
                    .status("PENDENTE")
                    .build());

            paymentRepository.save(payment);
            migrated++;
        }
        if (migrated > 0) {
            System.out.println("💵 Migração financeira: " + migrated
                    + " pedido(s) confirmado(s) sem pagamento receberam pagamento à vista (DINHEIRO, D+0).");
        }
    }

    /**
     * Semeia categorias de despesa padrão do módulo financeiro, apenas se a
     * tabela estiver vazia (idempotente). A operadora pode editar/adicionar
     * pela tela financeira depois.
     */
    private void seedExpenseCategories(com.hesed.repositories.ExpenseCategoryRepository repo) {
        // Categorias operacionais padrão (entram no DRE). Semeadas só na 1ª vez.
        if (repo.count() == 0) {
            List<String> defaults = List.of(
                    "Infraestrutura de sistemas",
                    "Taxa de maquininha",
                    "Embalagens",
                    "Mostruário",
                    "Marketing",
                    "Frete",
                    "Impostos",
                    "Outros");
            int order = 0;
            for (String name : defaults) {
                repo.save(com.hesed.models.ExpenseCategory.builder()
                        .name(name).active(true).operational(true).sortOrder(order++).build());
            }
            System.out.println("💰 Seed financeiro: " + order + " categoria(s) de despesa criada(s).");
        }

        // Categoria de COMPRA DE MERCADORIA (não-operacional): não entra no DRE
        // — o custo já é CMV na venda. Idempotente por nome (criada mesmo em
        // bancos que já tinham as demais categorias).
        if (!repo.existsByNameIgnoreCase(PURCHASE_CATEGORY_NAME)) {
            repo.save(com.hesed.models.ExpenseCategory.builder()
                    .name(PURCHASE_CATEGORY_NAME).active(true).operational(false).sortOrder(100).build());
            System.out.println("📦 Seed financeiro: categoria '" + PURCHASE_CATEGORY_NAME + "' (não-operacional) criada.");
        }
    }

    /** Nome canônico da categoria de compra de mercadoria (usada pelo lote de compra). */
    public static final String PURCHASE_CATEGORY_NAME = "Compra de mercadoria";

    /**
     * Semeia a tabela de categorias a partir das categorias distintas já
     * presentes nos produtos — apenas na primeira vez (se a tabela estiver
     * vazia). Garante que nada some dos seletores/filtros ao introduzir o
     * cadastro de categorias. Idempotente: não roda se já houver categorias.
     */
    private void seedCategories(com.hesed.repositories.CategoryRepository categoryRepository,
                                ProductRepository productRepository) {
        if (categoryRepository.count() > 0) return;
        List<String> distinct = productRepository.findDistinctCategories();
        int order = 0;
        for (String name : distinct) {
            if (name == null || name.isBlank()) continue;
            String trimmed = name.trim();
            if (categoryRepository.existsByNameIgnoreCase(trimmed)) continue;
            categoryRepository.save(com.hesed.models.Category.builder()
                    .name(trimmed)
                    .active(true)
                    .sortOrder(order++)
                    .build());
        }
        if (order > 0) {
            System.out.println("🏷️  Seed de categorias: " + order + " categoria(s) criada(s) a partir dos produtos.");
        }
    }

    /**
     * Semeia os templates de mensagem, apenas se ainda não existirem (idempotente
     * por chave). Os textos são um ponto de partida — a operadora edita pela tela
     * de Configurações. Variáveis suportadas: {cliente} {pedido} {total} {itens}.
     */
    private void seedMessageTemplates(com.hesed.repositories.MessageTemplateRepository repo) {
        seedTemplate(repo, "ORDER_CONFIRMED", "Pedido confirmado",
                "Olá {cliente}! 💛\n\nSeu pedido {pedido} foi confirmado.\n\n{itens}\n\nTotal: {total}\n\nObrigada por comprar na HESED Semijoias! Volte sempre. ✨");
        seedTemplate(repo, "ORDER_CANCELLED", "Pedido cancelado",
                "Olá {cliente}!\n\nSeu pedido {pedido} foi cancelado.\n\nSentiremos sua falta e esperamos você em uma próxima compra na HESED Semijoias. 💛");
        // Mensagem de aniversário — usada a partir do sino de notificações.
        // Só a variável {cliente} faz sentido aqui.
        seedTemplate(repo, "BIRTHDAY", "Aniversário do cliente",
                "Olá {cliente}! 🎉🎂\n\nA HESED Semijoias deseja um feliz aniversário para você! Que seu dia seja tão especial e brilhante quanto as nossas joias. ✨💛\n\nPasse na loja para ganhar um mimo!");
    }

    private void seedTemplate(com.hesed.repositories.MessageTemplateRepository repo,
                              String key, String title, String body) {
        if (!repo.existsByTemplateKey(key)) {
            repo.save(com.hesed.models.MessageTemplate.builder()
                    .templateKey(key)
                    .title(title)
                    .body(body)
                    .active(true)
                    .build());
        }
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
