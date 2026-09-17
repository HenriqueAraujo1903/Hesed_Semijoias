package com.hesed.dto;

import com.hesed.models.Expense;
import com.hesed.models.ExpenseInstallment;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
public class ExpenseResponse {
    private UUID id;
    private String description;
    private UUID categoryId;
    private String categoryName;
    private UUID supplierId;
    private String supplierName;
    private BigDecimal totalAmount;
    private BigDecimal paidAmount;
    private BigDecimal remainingAmount;
    private LocalDate competenceDate;
    private Integer installmentsCount;
    private String status;
    private String notes;
    private List<Installment> installments;

    @Data
    public static class Installment {
        private UUID id;
        private Integer installmentNumber;
        private BigDecimal amount;
        private LocalDate dueDate;
        /** PENDENTE | PAGO | ATRASADO (ATRASADO derivado em tempo de leitura). */
        private String status;
        private LocalDate paidAt;

        public static Installment from(ExpenseInstallment i, LocalDate today) {
            Installment d = new Installment();
            d.setId(i.getId());
            d.setInstallmentNumber(i.getInstallmentNumber());
            d.setAmount(i.getAmount());
            d.setDueDate(i.getDueDate());
            boolean overdue = "PENDENTE".equals(i.getStatus())
                    && i.getDueDate() != null && i.getDueDate().isBefore(today);
            d.setStatus(overdue ? "ATRASADO" : i.getStatus());
            d.setPaidAt(i.getPaidAt());
            return d;
        }
    }

    public static ExpenseResponse from(Expense e) {
        LocalDate today = LocalDate.now();
        ExpenseResponse r = new ExpenseResponse();
        r.setId(e.getId());
        r.setDescription(e.getDescription());
        if (e.getCategory() != null) {
            r.setCategoryId(e.getCategory().getId());
            r.setCategoryName(e.getCategory().getName());
        }
        if (e.getSupplier() != null) {
            r.setSupplierId(e.getSupplier().getId());
            r.setSupplierName(e.getSupplier().getName());
        }
        r.setTotalAmount(e.getTotalAmount());
        r.setCompetenceDate(e.getCompetenceDate());
        r.setInstallmentsCount(e.getInstallmentsCount());
        r.setStatus(e.getStatus());
        r.setNotes(e.getNotes());

        BigDecimal paid = BigDecimal.ZERO;
        List<Installment> items = e.getInstallments().stream()
                .sorted((a, b) -> Integer.compare(
                        a.getInstallmentNumber() != null ? a.getInstallmentNumber() : 0,
                        b.getInstallmentNumber() != null ? b.getInstallmentNumber() : 0))
                .map(i -> Installment.from(i, today))
                .toList();
        for (ExpenseInstallment i : e.getInstallments()) {
            if ("PAGO".equals(i.getStatus()) && i.getAmount() != null) {
                paid = paid.add(i.getAmount());
            }
        }
        r.setInstallments(items);
        r.setPaidAmount(paid);
        BigDecimal total = e.getTotalAmount() != null ? e.getTotalAmount() : BigDecimal.ZERO;
        r.setRemainingAmount(total.subtract(paid));
        return r;
    }
}
