package com.hesed.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
public class PromotionRequest {

    @NotNull(message = "Produto obrigatório")
    private UUID productId;

    @NotBlank(message = "Título obrigatório")
    @Size(max = 150, message = "Título deve ter no máximo 150 caracteres")
    private String title;

    @Size(max = 300, message = "Subtítulo deve ter no máximo 300 caracteres")
    private String subtitle;

    @DecimalMin(value = "0", message = "Desconto não pode ser negativo")
    @DecimalMax(value = "100", message = "Desconto não pode ultrapassar 100%")
    private BigDecimal discountPercent;

    @Positive(message = "Preço promocional deve ser positivo")
    private BigDecimal promoPrice;

    private String bannerUrl;

    private Boolean active = true;

    private LocalDateTime startsAt;

    private LocalDateTime endsAt;

    private Integer sortOrder = 0;
}
