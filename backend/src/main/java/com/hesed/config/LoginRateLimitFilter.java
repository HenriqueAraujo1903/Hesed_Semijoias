package com.hesed.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate limiting em memória para o endpoint de login, mitigando brute-force no
 * nível da aplicação (defesa em profundidade — o Nginx também limita, mas isso
 * protege mesmo se o backend for acessado diretamente).
 *
 * Janela fixa por IP: no máximo MAX_ATTEMPTS tentativas por WINDOW_MS.
 * Simples e sem dependências; adequado para uma instância única. Para múltiplas
 * instâncias, o ideal seria um store compartilhado (Redis), mas o deploy atual
 * é single-instance.
 */
@Component
@Order(1) // roda antes do JwtAuthFilter
public class LoginRateLimitFilter extends OncePerRequestFilter {

    // 20 tentativas/min por IP: barra brute-force (inviável quebrar senha nesse
    // ritmo) sem atrapalhar uso legítimo (erros ocasionais de digitação).
    private static final int MAX_ATTEMPTS = 20;
    private static final long WINDOW_MS = 60_000L; // 1 minuto

    private static class Counter {
        volatile long windowStart;
        final AtomicInteger count = new AtomicInteger(0);
    }

    private final Map<String, Counter> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // Aplica apenas ao POST de login
        if (!("POST".equalsIgnoreCase(request.getMethod())
                && request.getRequestURI().endsWith("/api/auth/login"))) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip = clientIp(request);
        long now = System.currentTimeMillis();
        Counter c = buckets.computeIfAbsent(ip, k -> {
            Counter nc = new Counter();
            nc.windowStart = now;
            return nc;
        });

        synchronized (c) {
            if (now - c.windowStart > WINDOW_MS) {
                c.windowStart = now;
                c.count.set(0);
            }
            int attempts = c.count.incrementAndGet();
            if (attempts > MAX_ATTEMPTS) {
                response.setStatus(429); // Too Many Requests
                response.setContentType("application/json");
                long retryAfter = (WINDOW_MS - (now - c.windowStart)) / 1000;
                response.setHeader("Retry-After", String.valueOf(Math.max(1, retryAfter)));
                response.getWriter().write(
                        "{\"error\":\"Muitas tentativas de login. Tente novamente em instantes.\"}");
                return;
            }
        }

        // Oportunisticamente limpa buckets antigos para não crescer indefinidamente
        if (buckets.size() > 10_000) {
            buckets.entrySet().removeIf(e -> now - e.getValue().windowStart > WINDOW_MS * 5);
        }

        filterChain.doFilter(request, response);
    }

    private String clientIp(HttpServletRequest request) {
        // Respeita o proxy (Nginx envia X-Forwarded-For)
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        return request.getRemoteAddr();
    }
}
