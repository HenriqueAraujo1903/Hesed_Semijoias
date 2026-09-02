package com.hesed.services;

import com.hesed.dto.MessageTemplateRequest;
import com.hesed.dto.MessageTemplateResponse;
import com.hesed.models.MessageTemplate;
import com.hesed.repositories.MessageTemplateRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageTemplateServiceTest {

    @Mock
    private MessageTemplateRepository repository;

    @InjectMocks
    private MessageTemplateService service;

    private MessageTemplate template(String key, String body, boolean active) {
        return MessageTemplate.builder()
                .templateKey(key).title("T").body(body).active(active).build();
    }

    @Test
    @DisplayName("update: altera corpo e estado do template existente")
    void update_changesBodyAndActive() {
        MessageTemplate t = template("ORDER_CONFIRMED", "texto antigo", true);
        when(repository.findByTemplateKey("ORDER_CONFIRMED")).thenReturn(Optional.of(t));
        when(repository.save(any(MessageTemplate.class))).thenAnswer(inv -> inv.getArgument(0));

        MessageTemplateRequest req = new MessageTemplateRequest();
        req.setBody("  Olá {cliente}!  ");
        req.setActive(false);

        MessageTemplateResponse r = service.update("ORDER_CONFIRMED", req);

        assertThat(t.getBody()).isEqualTo("Olá {cliente}!"); // trim aplicado
        assertThat(t.getActive()).isFalse();
        assertThat(r.getBody()).isEqualTo("Olá {cliente}!");
        assertThat(r.isActive()).isFalse();
    }

    @Test
    @DisplayName("update: falha se o template não existir")
    void update_notFound() {
        when(repository.findByTemplateKey("INEXISTENTE")).thenReturn(Optional.empty());
        MessageTemplateRequest req = new MessageTemplateRequest();
        req.setBody("x");
        req.setActive(true);

        assertThatThrownBy(() -> service.update("INEXISTENTE", req))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("não encontrado");
    }

    @Test
    @DisplayName("render: substitui variáveis quando o template está ativo")
    void render_substitutesVars() {
        MessageTemplate t = template("ORDER_CONFIRMED",
                "Olá {cliente}! Pedido {pedido} — {total}", true);
        when(repository.findByTemplateKey("ORDER_CONFIRMED")).thenReturn(Optional.of(t));

        String out = service.render("ORDER_CONFIRMED", Map.of(
                "cliente", "Maria", "pedido", "HSD-1", "total", "R$ 100,00"));

        assertThat(out).isEqualTo("Olá Maria! Pedido HSD-1 — R$ 100,00");
    }

    @Test
    @DisplayName("render: retorna null quando o template está inativo")
    void render_nullWhenInactive() {
        MessageTemplate t = template("ORDER_CANCELLED", "qualquer", false);
        when(repository.findByTemplateKey("ORDER_CANCELLED")).thenReturn(Optional.of(t));

        assertThat(service.render("ORDER_CANCELLED", Map.of())).isNull();
    }

    @Test
    @DisplayName("render: retorna null quando o template não existe")
    void render_nullWhenMissing() {
        when(repository.findByTemplateKey("X")).thenReturn(Optional.empty());
        assertThat(service.render("X", Map.of())).isNull();
    }

    @Test
    @DisplayName("applyVars: variável sem valor vira string vazia; texto sem variável é preservado")
    void applyVars_edgeCases() {
        assertThat(MessageTemplateService.applyVars("Olá {cliente}!", Map.of("cliente", "")))
                .isEqualTo("Olá !");
        assertThat(MessageTemplateService.applyVars("Sem variaveis", Map.of("cliente", "Ana")))
                .isEqualTo("Sem variaveis");
    }
}
