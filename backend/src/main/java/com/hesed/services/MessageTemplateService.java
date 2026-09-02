package com.hesed.services;

import com.hesed.dto.MessageTemplateRequest;
import com.hesed.dto.MessageTemplateResponse;
import com.hesed.models.MessageTemplate;
import com.hesed.repositories.MessageTemplateRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Gestão dos templates de mensagem configuráveis. A renderização (substituição
 * de variáveis) fica aqui para ser reaproveitada tanto pelo envio semi-automático
 * atual (link wa.me montado no frontend) quanto por um futuro envio via API.
 */
@Service
public class MessageTemplateService {

    private final MessageTemplateRepository repository;

    public MessageTemplateService(MessageTemplateRepository repository) {
        this.repository = repository;
    }

    public List<MessageTemplateResponse> findAll() {
        return repository.findAllByOrderByTitleAsc().stream()
                .map(MessageTemplateResponse::from)
                .toList();
    }

    public MessageTemplateResponse findByKey(String key) {
        return MessageTemplateResponse.from(getOrThrow(key));
    }

    @Transactional
    public MessageTemplateResponse update(String key, MessageTemplateRequest request) {
        MessageTemplate t = getOrThrow(key);
        t.setBody(request.getBody().trim());
        t.setActive(Boolean.TRUE.equals(request.getActive()));
        // Imagem opcional: string vazia/espacos viram null (sem imagem).
        String img = request.getImageUrl() == null ? null : request.getImageUrl().trim();
        t.setImageUrl(img == null || img.isEmpty() ? null : img);
        return MessageTemplateResponse.from(repository.save(t));
    }

    /**
     * Substitui as variáveis {chave} no texto pelos valores fornecidos.
     * Variáveis sem valor viram string vazia. Não falha se o template não existir
     * — retorna null para o chamador decidir (ex.: não enviar).
     */
    public String render(String key, Map<String, String> vars) {
        return repository.findByTemplateKey(key)
                .filter(t -> Boolean.TRUE.equals(t.getActive()))
                .map(t -> appendImage(applyVars(t.getBody(), vars), t.getImageUrl()))
                .orElse(null);
    }

    /**
     * Anexa o link da imagem ao final do texto, em linha própria (o WhatsApp gera
     * o preview). Sem imagem, retorna o texto inalterado.
     */
    static String appendImage(String text, String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return text;
        }
        return text + "\n\n" + imageUrl.trim();
    }

    static String applyVars(String body, Map<String, String> vars) {
        String result = body;
        for (Map.Entry<String, String> e : vars.entrySet()) {
            String value = e.getValue() == null ? "" : e.getValue();
            result = result.replace("{" + e.getKey() + "}", value);
        }
        return result;
    }

    private MessageTemplate getOrThrow(String key) {
        return repository.findByTemplateKey(key)
                .orElseThrow(() -> new RuntimeException("Template de mensagem não encontrado: " + key));
    }
}
