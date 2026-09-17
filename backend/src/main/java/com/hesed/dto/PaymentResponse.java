package com.hesed.dto;

import com.hesed.models.Payment;
import com.hesed.models.PaymentSettlement;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class PaymentResponse {
    private UUID id;
    private UUID orderId;
    private String method;
    private BigDecimal grossAmount;
    private BigDecimal feeAmount;
    private BigDecimal netAmount;
    private Integer installments;
    private LocalDateTime paidAt;
    private String notes;
    private List<Settlement> settlements;

    @Data
    public static class Settlement {
        private UUID id;
        private Integer installmentNumber;
        private BigDecimal netAmount;
        private LocalDate expectedDate;
        private String status;   // PENDENTE | RECEBIDO
        private LocalDate receivedAt;

        static Settlement from(PaymentSettlement s) {
            Settlement d = new Settlement();
            d.setId(s.getId());
            d.setInstallmentNumber(s.getInstallmentNumber());
            d.setNetAmount(s.getNetAmount());
            d.setExpectedDate(s.getExpectedDate());
            d.setStatus(s.getStatus());
            d.setReceivedAt(s.getReceivedAt());
            return d;
        }
    }

    public static PaymentResponse from(Payment p) {
        PaymentResponse r = new PaymentResponse();
        r.setId(p.getId());
        r.setOrderId(p.getOrder() != null ? p.getOrder().getId() : null);
        r.setMethod(p.getMethod());
        r.setGrossAmount(p.getGrossAmount());
        r.setFeeAmount(p.getFeeAmount());
        r.setNetAmount(p.getNetAmount());
        r.setInstallments(p.getInstallments());
        r.setPaidAt(p.getPaidAt());
        r.setNotes(p.getNotes());
        r.setSettlements(p.getSettlements().stream()
                .sorted((a, b) -> Integer.compare(
                        a.getInstallmentNumber() != null ? a.getInstallmentNumber() : 0,
                        b.getInstallmentNumber() != null ? b.getInstallmentNumber() : 0))
                .map(Settlement::from)
                .toList());
        return r;
    }
}
