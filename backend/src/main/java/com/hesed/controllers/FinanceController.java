package com.hesed.controllers;

import com.hesed.dto.*;
import com.hesed.services.FinanceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Endpoints do módulo financeiro. Todos sob /api/admin/finance/** — herdam a
 * proteção ROLE_ADMIN definida no SecurityConfig.
 */
@RestController
@RequestMapping("/api/admin/finance")
public class FinanceController {

    private final FinanceService financeService;

    public FinanceController(FinanceService financeService) {
        this.financeService = financeService;
    }

    // ---- Categorias de despesa ----

    @GetMapping("/expense-categories")
    public ResponseEntity<List<ExpenseCategoryResponse>> listCategories() {
        return ResponseEntity.ok(financeService.listCategories());
    }

    @PostMapping("/expense-categories")
    public ResponseEntity<?> createCategory(@Valid @RequestBody ExpenseCategoryRequest req) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(financeService.createCategory(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/expense-categories/{id}")
    public ResponseEntity<?> updateCategory(@PathVariable UUID id, @Valid @RequestBody ExpenseCategoryRequest req) {
        try {
            return ResponseEntity.ok(financeService.updateCategory(id, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/expense-categories/{id}")
    public ResponseEntity<?> deleteCategory(@PathVariable UUID id) {
        try {
            financeService.deleteCategory(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ---- Despesas (contas a pagar) ----

    @GetMapping("/expenses")
    public ResponseEntity<List<ExpenseResponse>> listExpenses(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(financeService.listExpenses(status));
    }

    @GetMapping("/expenses/{id}")
    public ResponseEntity<?> getExpense(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(financeService.getExpense(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/expenses")
    public ResponseEntity<?> createExpense(@Valid @RequestBody ExpenseRequest req) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(financeService.createExpense(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/expenses/{id}")
    public ResponseEntity<?> deleteExpense(@PathVariable UUID id) {
        try {
            financeService.deleteExpense(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** Agenda de parcelas com vencimento no período (contas a pagar mês a mês). */
    @GetMapping("/installments")
    public ResponseEntity<List<ExpenseResponse.Installment>> installmentsDue(
            @RequestParam LocalDate from, @RequestParam LocalDate to) {
        return ResponseEntity.ok(financeService.installmentsDue(from, to));
    }

    /** Marca/desmarca uma parcela como paga. Body: { "paid": true, "paidDate": "2026-01-10" } */
    @PatchMapping("/installments/{id}/paid")
    public ResponseEntity<?> setInstallmentPaid(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        try {
            boolean paid = Boolean.TRUE.equals(body.get("paid"));
            LocalDate paidDate = body.get("paidDate") != null
                    ? LocalDate.parse(body.get("paidDate").toString()) : null;
            return ResponseEntity.ok(financeService.setInstallmentPaid(id, paid, paidDate));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ---- Pagamentos de pedidos ----

    @GetMapping("/orders/{orderId}/payments")
    public ResponseEntity<?> orderPayments(@PathVariable UUID orderId) {
        try {
            return ResponseEntity.ok(financeService.orderPaymentSummary(orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/orders/{orderId}/payments")
    public ResponseEntity<?> registerPayment(@PathVariable UUID orderId, @Valid @RequestBody PaymentRequest req) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(financeService.registerPayment(orderId, req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/payments/{id}")
    public ResponseEntity<?> deletePayment(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(financeService.deletePayment(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ---- Lançamentos manuais de caixa ----

    @GetMapping("/cash-entries")
    public ResponseEntity<List<CashEntryResponse>> listCashEntries(
            @RequestParam LocalDate from, @RequestParam LocalDate to) {
        return ResponseEntity.ok(financeService.listCashEntries(from, to));
    }

    @PostMapping("/cash-entries")
    public ResponseEntity<?> createCashEntry(@Valid @RequestBody CashEntryRequest req) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(financeService.createCashEntry(req));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/cash-entries/{id}")
    public ResponseEntity<?> deleteCashEntry(@PathVariable UUID id) {
        try {
            financeService.deleteCashEntry(id);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ---- Fluxo de caixa & DRE ----

    @GetMapping("/cash-flow")
    public ResponseEntity<CashFlowResponse> cashFlow(
            @RequestParam LocalDate from, @RequestParam LocalDate to) {
        return ResponseEntity.ok(financeService.cashFlow(from, to));
    }

    @GetMapping("/income-statement")
    public ResponseEntity<?> incomeStatement(@RequestParam int year, @RequestParam int month) {
        try {
            return ResponseEntity.ok(financeService.incomeStatement(year, month));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
