package com.hesed.services;

import com.hesed.dto.*;
import com.hesed.models.*;
import com.hesed.repositories.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Serviço do módulo financeiro: despesas (contas a pagar com parcelamento),
 * pagamentos de pedidos (com taxa/líquido), lançamentos manuais de caixa,
 * fluxo de caixa consolidado e DRE mensal.
 *
 * Regra de custo consignado (opção A acordada): a compra de produto NÃO gera
 * lançamento financeiro; o custo do fornecedor entra como CMV uma única vez,
 * no momento da venda (via costPrice do OrderItem). A comissão da revendedora
 * é dedução de venda separada, não um segundo custo do produto.
 */
@Service
public class FinanceService {

    private static final List<String> PAYMENT_METHODS = List.of(
            "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "DINHEIRO", "BOLETO", "TRANSFERENCIA");

    private final ExpenseRepository expenseRepository;
    private final ExpenseCategoryRepository expenseCategoryRepository;
    private final ExpenseInstallmentRepository installmentRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentSettlementRepository settlementRepository;
    private final CashEntryRepository cashEntryRepository;
    private final OrderRepository orderRepository;
    private final SupplierRepository supplierRepository;
    private final ConsignmentRepository consignmentRepository;
    private final AnalyticsService analyticsService;

    public FinanceService(ExpenseRepository expenseRepository,
                          ExpenseCategoryRepository expenseCategoryRepository,
                          ExpenseInstallmentRepository installmentRepository,
                          PaymentRepository paymentRepository,
                          PaymentSettlementRepository settlementRepository,
                          CashEntryRepository cashEntryRepository,
                          OrderRepository orderRepository,
                          SupplierRepository supplierRepository,
                          ConsignmentRepository consignmentRepository,
                          AnalyticsService analyticsService) {
        this.expenseRepository = expenseRepository;
        this.expenseCategoryRepository = expenseCategoryRepository;
        this.installmentRepository = installmentRepository;
        this.paymentRepository = paymentRepository;
        this.settlementRepository = settlementRepository;
        this.cashEntryRepository = cashEntryRepository;
        this.orderRepository = orderRepository;
        this.supplierRepository = supplierRepository;
        this.consignmentRepository = consignmentRepository;
        this.analyticsService = analyticsService;
    }

    // ===========================================================================
    // Categorias de despesa
    // ===========================================================================

    public List<ExpenseCategoryResponse> listCategories() {
        return expenseCategoryRepository.findAllByOrderBySortOrderAscNameAsc()
                .stream().map(ExpenseCategoryResponse::from).toList();
    }

    @Transactional
    public ExpenseCategoryResponse createCategory(ExpenseCategoryRequest req) {
        String name = req.getName() == null ? "" : req.getName().trim();
        if (name.isEmpty()) throw new RuntimeException("Informe o nome da categoria.");
        if (expenseCategoryRepository.existsByNameIgnoreCase(name)) {
            throw new RuntimeException("Já existe uma categoria com esse nome.");
        }
        ExpenseCategory c = ExpenseCategory.builder()
                .name(name)
                .active(req.getActive() == null ? true : req.getActive())
                .sortOrder(req.getSortOrder() == null ? 0 : req.getSortOrder())
                .build();
        return ExpenseCategoryResponse.from(expenseCategoryRepository.save(c));
    }

    @Transactional
    public ExpenseCategoryResponse updateCategory(UUID id, ExpenseCategoryRequest req) {
        ExpenseCategory c = expenseCategoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Categoria não encontrada."));
        if (req.getName() != null && !req.getName().isBlank()) c.setName(req.getName().trim());
        if (req.getActive() != null) c.setActive(req.getActive());
        if (req.getSortOrder() != null) c.setSortOrder(req.getSortOrder());
        return ExpenseCategoryResponse.from(expenseCategoryRepository.save(c));
    }

    @Transactional
    public void deleteCategory(UUID id) {
        if (expenseRepository.countByCategoryId(id) > 0) {
            throw new RuntimeException("Não é possível excluir: há despesas usando esta categoria. Desative-a.");
        }
        expenseCategoryRepository.deleteById(id);
    }

    // ===========================================================================
    // Despesas (contas a pagar) + parcelas
    // ===========================================================================

    public List<ExpenseResponse> listExpenses(String status) {
        String st = (status == null || status.isBlank()) ? null : status.trim().toUpperCase();
        return expenseRepository.findFiltered(st).stream()
                .map(e -> ExpenseResponse.from(reload(e.getId())))
                .toList();
    }

    private Expense reload(UUID id) {
        return expenseRepository.findByIdWithInstallments(id)
                .orElseThrow(() -> new RuntimeException("Despesa não encontrada."));
    }

    public ExpenseResponse getExpense(UUID id) {
        return ExpenseResponse.from(reload(id));
    }

    @Transactional
    public ExpenseResponse createExpense(ExpenseRequest req) {
        ExpenseCategory category = expenseCategoryRepository.findById(req.getCategoryId())
                .orElseThrow(() -> new RuntimeException("Categoria não encontrada."));

        int count = (req.getInstallmentsCount() == null || req.getInstallmentsCount() < 1)
                ? 1 : req.getInstallmentsCount();

        Expense expense = Expense.builder()
                .description(req.getDescription().trim())
                .category(category)
                .totalAmount(scale(req.getTotalAmount()))
                .competenceDate(req.getCompetenceDate())
                .installmentsCount(count)
                .notes(trimToNull(req.getNotes()))
                .status("PENDENTE")
                .build();

        if (req.getSupplierId() != null) {
            Supplier s = supplierRepository.findById(req.getSupplierId())
                    .orElseThrow(() -> new RuntimeException("Fornecedor não encontrado."));
            expense.setSupplier(s);
        }

        LocalDate firstDue = req.getFirstDueDate() != null ? req.getFirstDueDate() : req.getCompetenceDate();
        buildInstallments(expense, count, scale(req.getTotalAmount()), firstDue);

        Expense saved = expenseRepository.save(expense);
        return ExpenseResponse.from(reload(saved.getId()));
    }

    /**
     * Cria e persiste uma conta a pagar (Expense) parcelada, usada por outros
     * serviços (ex.: entrada de compra em lote). Recebe as entidades já
     * resolvidas e devolve a Expense salva com as parcelas geradas.
     */
    @Transactional
    public Expense createExpenseInternal(String description, ExpenseCategory category, Supplier supplier,
                                         BigDecimal totalAmount, LocalDate competenceDate,
                                         int installmentsCount, LocalDate firstDueDate, String notes) {
        int count = installmentsCount < 1 ? 1 : installmentsCount;
        BigDecimal total = scale(totalAmount);
        Expense expense = Expense.builder()
                .description(description)
                .category(category)
                .supplier(supplier)
                .totalAmount(total)
                .competenceDate(competenceDate)
                .installmentsCount(count)
                .notes(trimToNull(notes))
                .status("PENDENTE")
                .build();
        LocalDate firstDue = firstDueDate != null ? firstDueDate : competenceDate;
        buildInstallments(expense, count, total, firstDue);
        return expenseRepository.save(expense);
    }

    /** Categoria de compra de mercadoria (não-operacional), criando-a se ainda não existir. */
    @Transactional
    public ExpenseCategory purchaseCategory() {
        return expenseCategoryRepository.findFirstByNameIgnoreCase(
                        com.hesed.config.DataInitializer.PURCHASE_CATEGORY_NAME)
                .orElseGet(() -> expenseCategoryRepository.save(ExpenseCategory.builder()
                        .name(com.hesed.config.DataInitializer.PURCHASE_CATEGORY_NAME)
                        .active(true).operational(false).sortOrder(100).build()));
    }

    /**
     * Gera N parcelas mensais a partir de firstDue. Divide o total igualmente
     * com arredondamento HALF_UP e joga a diferença de centavos na última
     * parcela, garantindo que a soma bata exatamente com o total.
     */
    private void buildInstallments(Expense expense, int count, BigDecimal total, LocalDate firstDue) {
        BigDecimal base = total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        BigDecimal accumulated = BigDecimal.ZERO;
        for (int n = 1; n <= count; n++) {
            BigDecimal amount = (n == count) ? total.subtract(accumulated) : base;
            accumulated = accumulated.add(amount);
            ExpenseInstallment inst = ExpenseInstallment.builder()
                    .expense(expense)
                    .installmentNumber(n)
                    .amount(amount)
                    .dueDate(firstDue.plusMonths(n - 1))
                    .status("PENDENTE")
                    .build();
            expense.getInstallments().add(inst);
        }
    }

    @Transactional
    public void deleteExpense(UUID id) {
        Expense e = expenseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Despesa não encontrada."));
        expenseRepository.delete(e);
    }

    /** Marca uma parcela como PAGA (ou reabre para PENDENTE) e recalcula o status da despesa. */
    @Transactional
    public ExpenseResponse setInstallmentPaid(UUID installmentId, boolean paid, LocalDate paidDate) {
        ExpenseInstallment inst = installmentRepository.findById(installmentId)
                .orElseThrow(() -> new RuntimeException("Parcela não encontrada."));
        if (paid) {
            inst.setStatus("PAGO");
            inst.setPaidAt(paidDate != null ? paidDate : LocalDate.now());
        } else {
            inst.setStatus("PENDENTE");
            inst.setPaidAt(null);
        }
        installmentRepository.save(inst);

        Expense expense = reload(inst.getExpense().getId());
        recalcExpenseStatus(expense);
        expenseRepository.save(expense);
        return ExpenseResponse.from(reload(expense.getId()));
    }

    /** Status da despesa derivado das parcelas: PAGO (todas), PENDENTE (nenhuma), PARCIAL (algumas). */
    private void recalcExpenseStatus(Expense expense) {
        List<ExpenseInstallment> insts = expense.getInstallments();
        long paid = insts.stream().filter(i -> "PAGO".equals(i.getStatus())).count();
        if (paid == 0) expense.setStatus("PENDENTE");
        else if (paid == insts.size()) expense.setStatus("PAGO");
        else expense.setStatus("PARCIAL");
    }

    /** Agenda de parcelas com vencimento no período (contas a pagar mês a mês). */
    public List<ExpenseResponse.Installment> installmentsDue(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now();
        return installmentRepository.findDueBetween(from, to).stream()
                .map(i -> ExpenseResponse.Installment.from(i, today))
                .toList();
    }

    // ===========================================================================
    // Pagamentos de pedidos (contas a receber concretizadas)
    // ===========================================================================

    public OrderPaymentSummaryResponse orderPaymentSummary(UUID orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Pedido não encontrado."));
        return buildOrderPaymentSummary(order);
    }

    private OrderPaymentSummaryResponse buildOrderPaymentSummary(Order order) {
        List<Payment> payments = paymentRepository.findByOrderIdOrderByPaidAtAsc(order.getId());
        BigDecimal total = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal paidGross = payments.stream()
                .map(p -> p.getGrossAmount() != null ? p.getGrossAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        OrderPaymentSummaryResponse r = new OrderPaymentSummaryResponse();
        r.setOrderId(order.getId());
        r.setOrderNumber(order.getOrderNumber());
        r.setCustomerName(order.getCustomerName());
        r.setOrderTotal(scale(total));
        r.setPaidGross(scale(paidGross));
        r.setRemaining(scale(total.subtract(paidGross)));
        r.setPaymentStatus(derivePaymentStatus(total, paidGross));
        r.setPayments(payments.stream().map(PaymentResponse::from).toList());
        return r;
    }

    private String derivePaymentStatus(BigDecimal total, BigDecimal paidGross) {
        if (paidGross.signum() <= 0) return "PENDENTE";
        if (paidGross.compareTo(total) >= 0) return "PAGO";
        return "PARCIAL";
    }

    @Transactional
    public OrderPaymentSummaryResponse registerPayment(UUID orderId, PaymentRequest req) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Pedido não encontrado."));

        String method = req.getMethod() == null ? "" : req.getMethod().trim().toUpperCase();
        if (!PAYMENT_METHODS.contains(method)) {
            throw new RuntimeException("Forma de pagamento inválida: " + req.getMethod());
        }
        BigDecimal gross = scale(req.getGrossAmount());
        if (gross.signum() <= 0) throw new RuntimeException("O valor recebido deve ser maior que zero.");

        BigDecimal fee = req.getFeeAmount() != null ? scale(req.getFeeAmount()) : BigDecimal.ZERO;
        if (fee.signum() < 0) throw new RuntimeException("A taxa não pode ser negativa.");
        if (fee.compareTo(gross) > 0) throw new RuntimeException("A taxa não pode ser maior que o valor recebido.");

        // Parcelas só fazem sentido no cartão de crédito; nos demais é sempre 1.
        int installments = 1;
        if ("CARTAO_CREDITO".equals(method) && req.getInstallments() != null && req.getInstallments() >= 1) {
            installments = req.getInstallments();
        }

        BigDecimal net = gross.subtract(fee);
        LocalDateTime paidAt = req.getPaidAt() != null ? req.getPaidAt() : LocalDateTime.now();

        Payment payment = Payment.builder()
                .order(order)
                .method(method)
                .grossAmount(gross)
                .feeAmount(fee)
                .netAmount(net)
                .installments(installments)
                .paidAt(paidAt)
                .notes(trimToNull(req.getNotes()))
                .build();

        buildSettlements(payment, method, installments, net, paidAt.toLocalDate());
        paymentRepository.save(payment);

        return buildOrderPaymentSummary(order);
    }

    /**
     * Gera as liquidações (recebíveis) conforme a regra de repasse da adquirente:
     *  - Crédito Nx: N liquidações a cada 30 dias, começando em D+30.
     *  - Crédito 1x: 1 liquidação em D+30.
     *  - Débito:     1 liquidação em D+1 dia útil (pula fim de semana).
     *  - Demais:     1 liquidação em D+0 (o dinheiro entra na hora).
     * O valor líquido é dividido igualmente entre as parcelas, com a diferença
     * de centavos ajustada na última.
     */
    private void buildSettlements(Payment payment, String method, int installments,
                                  BigDecimal net, LocalDate saleDate) {
        if ("CARTAO_CREDITO".equals(method)) {
            BigDecimal base = net.divide(BigDecimal.valueOf(installments), 2, RoundingMode.HALF_UP);
            BigDecimal accumulated = BigDecimal.ZERO;
            for (int n = 1; n <= installments; n++) {
                BigDecimal amount = (n == installments) ? net.subtract(accumulated) : base;
                accumulated = accumulated.add(amount);
                payment.getSettlements().add(PaymentSettlement.builder()
                        .payment(payment)
                        .installmentNumber(n)
                        .netAmount(amount)
                        .expectedDate(saleDate.plusDays(30L * n))  // D+30, D+60, ...
                        .status("PENDENTE")
                        .build());
            }
        } else {
            LocalDate expected;
            if ("CARTAO_DEBITO".equals(method)) {
                expected = nextBusinessDay(saleDate);   // D+1 dia útil
            } else {
                expected = saleDate;                    // Pix/dinheiro/boleto/transferência: D+0
            }
            payment.getSettlements().add(PaymentSettlement.builder()
                    .payment(payment)
                    .installmentNumber(1)
                    .netAmount(net)
                    .expectedDate(expected)
                    .status("PENDENTE")
                    .build());
        }
    }

    /** Próximo dia útil após a data (pula sábado e domingo; feriados não considerados). */
    private LocalDate nextBusinessDay(LocalDate from) {
        LocalDate d = from.plusDays(1);
        while (d.getDayOfWeek() == java.time.DayOfWeek.SATURDAY
                || d.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
            d = d.plusDays(1);
        }
        return d;
    }

    @Transactional
    public OrderPaymentSummaryResponse deletePayment(UUID paymentId) {
        Payment p = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new RuntimeException("Pagamento não encontrado."));
        Order order = p.getOrder();
        paymentRepository.delete(p);
        return buildOrderPaymentSummary(order);
    }

    // ===========================================================================
    // Lançamentos manuais de caixa
    // ===========================================================================

    public List<CashEntryResponse> listCashEntries(LocalDate from, LocalDate to) {
        return cashEntryRepository.findByEntryDateBetweenOrderByEntryDateDesc(from, to)
                .stream().map(CashEntryResponse::from).toList();
    }

    @Transactional
    public CashEntryResponse createCashEntry(CashEntryRequest req) {
        String type = req.getType() == null ? "" : req.getType().trim().toUpperCase();
        if (!List.of("ENTRADA", "SAIDA").contains(type)) {
            throw new RuntimeException("Tipo inválido (use ENTRADA ou SAIDA).");
        }
        CashEntry e = CashEntry.builder()
                .type(type)
                .description(req.getDescription().trim())
                .amount(scale(req.getAmount()))
                .entryDate(req.getEntryDate())
                .notes(trimToNull(req.getNotes()))
                .build();
        return CashEntryResponse.from(cashEntryRepository.save(e));
    }

    @Transactional
    public void deleteCashEntry(UUID id) {
        if (!cashEntryRepository.existsById(id)) {
            throw new RuntimeException("Lançamento não encontrado.");
        }
        cashEntryRepository.deleteById(id);
    }

    // ===========================================================================
    // Fluxo de caixa consolidado
    // ===========================================================================

    public CashFlowResponse cashFlow(LocalDate from, LocalDate to) {
        LocalDateTime fromDt = from.atStartOfDay();
        LocalDateTime toDt = to.plusDays(1).atStartOfDay().minusNanos(1);

        List<CashFlowResponse.Movement> movements = new ArrayList<>();
        BigDecimal inflow = BigDecimal.ZERO;
        BigDecimal outflow = BigDecimal.ZERO;

        // (+) Liquidações previstas no período: o líquido entra no caixa na DATA
        // DE REPASSE (expectedDate), não na data da venda. Para cartão parcelado,
        // cada parcela entra no seu mês. Para débito, D+1 dia útil; Pix/dinheiro, D+0.
        for (PaymentSettlement s : settlementRepository.findExpectedBetween(from, to)) {
            BigDecimal net = s.getNetAmount() != null ? s.getNetAmount() : BigDecimal.ZERO;
            inflow = inflow.add(net);
            Payment p = s.getPayment();
            String orderNum = p.getOrder() != null ? p.getOrder().getOrderNumber() : "";
            String parcela = (p.getInstallments() != null && p.getInstallments() > 1)
                    ? " " + s.getInstallmentNumber() + "/" + p.getInstallments() : "";
            movements.add(movement(s.getExpectedDate().toString(), "ENTRADA", "PAGAMENTO",
                    "Recebimento pedido " + orderNum + " (" + p.getMethod() + parcela + ")", scale(net)));
        }

        // (-) Taxas de pagamento: saem do caixa na DATA DA VENDA (a adquirente já
        // desconta a taxa; o repasse vem líquido). Considera pagamentos do período.
        for (Payment p : paymentsInRange(fromDt, toDt)) {
            if (p.getFeeAmount() != null && p.getFeeAmount().signum() > 0) {
                outflow = outflow.add(p.getFeeAmount());
                movements.add(movement(p.getPaidAt().toLocalDate().toString(), "SAIDA", "TAXA",
                        "Taxa " + p.getMethod() + " (pedido "
                                + (p.getOrder() != null ? p.getOrder().getOrderNumber() : "") + ")",
                        scale(p.getFeeAmount())));
            }
        }

        // (-) Parcelas de despesa pagas no período
        for (ExpenseInstallment i : installmentRepository.findDueBetween(LocalDate.of(2000, 1, 1), LocalDate.of(2100, 1, 1))) {
            if ("PAGO".equals(i.getStatus()) && i.getPaidAt() != null
                    && !i.getPaidAt().isBefore(from) && !i.getPaidAt().isAfter(to)) {
                BigDecimal amt = i.getAmount() != null ? i.getAmount() : BigDecimal.ZERO;
                outflow = outflow.add(amt);
                String desc = i.getExpense().getDescription()
                        + " (parcela " + i.getInstallmentNumber() + "/" + i.getExpense().getInstallmentsCount() + ")";
                movements.add(movement(i.getPaidAt().toString(), "SAIDA", "DESPESA", desc, scale(amt)));
            }
        }

        // (±) Lançamentos manuais
        for (CashEntry e : cashEntryRepository.findByEntryDateBetweenOrderByEntryDateDesc(from, to)) {
            BigDecimal amt = e.getAmount() != null ? e.getAmount() : BigDecimal.ZERO;
            if ("ENTRADA".equals(e.getType())) inflow = inflow.add(amt);
            else outflow = outflow.add(amt);
            movements.add(movement(e.getEntryDate().toString(), e.getType(), "MANUAL", e.getDescription(), scale(amt)));
        }

        movements.sort((a, b) -> b.getDate().compareTo(a.getDate()));

        CashFlowResponse resp = new CashFlowResponse();
        resp.setTotalInflow(scale(inflow));
        resp.setTotalOutflow(scale(outflow));
        resp.setNet(scale(inflow.subtract(outflow)));
        resp.setMovements(movements);
        return resp;
    }

    private List<Payment> paymentsInRange(LocalDateTime from, LocalDateTime to) {
        return paymentRepository.findAll().stream()
                .filter(p -> p.getPaidAt() != null
                        && !p.getPaidAt().isBefore(from) && !p.getPaidAt().isAfter(to))
                .toList();
    }

    private CashFlowResponse.Movement movement(String date, String type, String source,
                                               String description, BigDecimal amount) {
        CashFlowResponse.Movement m = new CashFlowResponse.Movement();
        m.setDate(date);
        m.setType(type);
        m.setSource(source);
        m.setDescription(description);
        m.setAmount(amount);
        return m;
    }

    // ===========================================================================
    // DRE mensal
    // ===========================================================================

    public IncomeStatementResponse incomeStatement(int year, int month) {
        if (month < 1 || month > 12) throw new RuntimeException("Mês inválido: " + month);

        LocalDate monthStart = LocalDate.of(year, month, 1);
        LocalDate monthEnd = monthStart.plusMonths(1).minusDays(1);
        LocalDateTime fromDt = monthStart.atStartOfDay();
        LocalDateTime toDt = monthStart.plusMonths(1).atStartOfDay().minusNanos(1);

        // Receita + CMV a partir da análise de vendas confirmadas (inclui consignados).
        // O CMV já contém o costPrice dos itens; a compra do produto não é despesa (opção A).
        SalesAnalyticsResponse sales = analyticsService.sales(
                "CONFIRMADO", "month", fromDt, toDt, null, false);
        BigDecimal revenue = nz(sales.getKpis().getRevenue());
        BigDecimal cogs = nz(sales.getKpis().getCost());
        BigDecimal grossMargin = revenue.subtract(cogs);

        // Comissões de consignação (lotes FECHADO com closedAt no mês) — dedução de venda.
        BigDecimal commissions = BigDecimal.ZERO;
        List<Object[]> ck = consignmentRepository.closedKpis(fromDt, toDt);
        if (!ck.isEmpty() && ck.get(0) != null && ck.get(0)[1] != null) {
            commissions = new BigDecimal(ck.get(0)[1].toString());
        }

        // Taxas de pagamento recebidas no mês (custo financeiro).
        BigDecimal fees = BigDecimal.ZERO;
        List<Object[]> pt = paymentRepository.totalsInRange(fromDt, toDt);
        if (!pt.isEmpty() && pt.get(0) != null && pt.get(0)[1] != null) {
            fees = new BigDecimal(pt.get(0)[1].toString());
        }

        // Despesas operacionais por competência no mês, agrupadas por categoria.
        List<IncomeStatementResponse.ExpenseCategoryTotal> byCat = new ArrayList<>();
        BigDecimal opex = BigDecimal.ZERO;
        for (Object[] row : expenseRepository.totalByCategoryInRange(monthStart, monthEnd)) {
            IncomeStatementResponse.ExpenseCategoryTotal t = new IncomeStatementResponse.ExpenseCategoryTotal();
            t.setCategory((String) row[0]);
            BigDecimal total = new BigDecimal(row[1].toString());
            t.setTotal(scale(total));
            opex = opex.add(total);
            byCat.add(t);
        }

        BigDecimal netResult = grossMargin.subtract(commissions).subtract(fees).subtract(opex);

        IncomeStatementResponse r = new IncomeStatementResponse();
        r.setYear(year);
        r.setMonth(month);
        r.setRevenue(scale(revenue));
        r.setCogs(scale(cogs));
        r.setGrossMargin(scale(grossMargin));
        r.setGrossMarginPercent(percent(grossMargin, revenue));
        r.setConsignmentCommissions(scale(commissions));
        r.setPaymentFees(scale(fees));
        r.setOperatingExpenses(scale(opex));
        r.setNetResult(scale(netResult));
        r.setNetResultPercent(percent(netResult, revenue));
        r.setExpensesByCategory(byCat);
        return r;
    }

    // ===========================================================================
    // Helpers
    // ===========================================================================

    private BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private BigDecimal scale(BigDecimal v) {
        return (v != null ? v : BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal percent(BigDecimal part, BigDecimal whole) {
        if (whole == null || whole.signum() == 0) return BigDecimal.ZERO;
        return part.multiply(BigDecimal.valueOf(100)).divide(whole, 2, RoundingMode.HALF_UP);
    }

    private String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
