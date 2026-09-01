package com.hesed.controllers;

import com.hesed.config.JwtAuthFilter;
import com.hesed.dto.LoginRequest;
import com.hesed.dto.LoginResponse;
import com.hesed.services.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    /**
     * Tempo de vida do cookie em segundos — sincronizado com o tempo de vida
     * do token JWT configurado em app.jwt.expiration-ms.
     */
    @Value("${app.jwt.expiration-ms:86400000}")
    private long expirationMs;

    @Value("${app.cookie.secure:true}")
    private boolean cookieSecure;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * Login: valida credenciais, devolve os dados do usuário no body e emite
     * o token JWT como cookie HttpOnly para que o JS não consiga lê-lo.
     *
     * O campo "token" é omitido do body (null) — o frontend não deve mais
     * armazená-lo no estado nem no localStorage.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request,
                                   HttpServletResponse response) {
        try {
            LoginResponse lr = authService.login(request);
            attachCookie(response, lr.getToken());

            // Retorna os dados do usuário sem o token (não expor ao JS)
            LoginResponse body = new LoginResponse(
                    null, lr.getId(), lr.getName(), lr.getEmail(), lr.getRole()
            );
            return ResponseEntity.ok(body);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Logout: invalida a sessão limpando o cookie JWT no cliente.
     * Não é necessário estado no servidor — basta sobrescrever o cookie
     * com maxAge=0.
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        clearCookie(response);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /**
     * Verifica se a sessão via cookie ainda é válida (JwtAuthFilter já validou
     * o token antes de chegar aqui). Retorna os dados do usuário logado.
     * Usado pelo frontend na inicialização para confirmar a sessão sem flicker.
     */
    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado."));
        }
        try {
            LoginResponse body = authService.me(auth.getName()); // getName() = userId
            return ResponseEntity.ok(body);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    // ---- helpers ----

    private void attachCookie(HttpServletResponse response, String token) {
        // Emite o Set-Cookie via header direto para ter controle total dos atributos,
        // incluindo SameSite=Strict que a API Cookie do Servlet não suporta nativamente.
        response.addHeader("Set-Cookie",
                String.format("%s=%s; Max-Age=%d; Path=/; HttpOnly; SameSite=Strict%s",
                        JwtAuthFilter.COOKIE_NAME, token,
                        (int) (expirationMs / 1000),
                        cookieSecure ? "; Secure" : ""));
    }

    private void clearCookie(HttpServletResponse response) {
        response.addHeader("Set-Cookie",
                String.format("%s=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict%s",
                        JwtAuthFilter.COOKIE_NAME,
                        cookieSecure ? "; Secure" : ""));
    }
}
