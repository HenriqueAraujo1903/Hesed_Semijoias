package com.hesed.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * Extrai o token JWT de duas fontes, com ordem de prioridade:
 *
 * 1. Cookie HttpOnly chamado "jwt" (caminho preferido — token inacessível ao JS).
 * 2. Header "Authorization: Bearer <token>" (retrocompatibilidade para scripts
 *    de QA/API que ainda usam header diretamente).
 *
 * A dupla leitura garante que a migração não quebra testes automatizados nem
 * integrações externas enquanto elas forem atualizadas gradualmente.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    public static final String COOKIE_NAME = "jwt";

    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String token = extractToken(request);

        if (token != null && jwtService.isValid(token)) {
            String userId = jwtService.getUserId(token);
            String role   = jwtService.getRole(token);

            var auth = new UsernamePasswordAuthenticationToken(
                    userId,
                    null,
                    List.of(new SimpleGrantedAuthority(role))
            );
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Tenta extrair o token JWT primeiro do cookie HttpOnly, depois do header.
     * Retorna null se nenhum estiver presente.
     */
    private String extractToken(HttpServletRequest request) {
        // 1. Cookie HttpOnly (caminho preferido pós-migração)
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            return Arrays.stream(cookies)
                    .filter(c -> COOKIE_NAME.equals(c.getName()))
                    .map(Cookie::getValue)
                    .findFirst()
                    .orElse(null);
        }
        // 2. Header Authorization (retrocompat QA/scripts)
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
