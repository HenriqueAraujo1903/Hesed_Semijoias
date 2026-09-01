package com.hesed.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * Testes unitários do JwtAuthFilter usando uma instância REAL do JwtService
 * (evita problema de instrumentação do Byte Buddy no JDK 26 com classes
 * concretas que usam dependências nativas/finais do jjwt).
 *
 * Cobre: prioridade cookie > header, fallback para header, token inválido,
 * sem token, e header malformado.
 */
class JwtAuthFilterTest {

    // Instância real do JwtService com segredo de teste
    private static final String TEST_SECRET =
            "testsecretkey-hesed-semijoias-unitest-2026-padding-padding-padding";
    private static final long   EXP_MS = 86_400_000L; // 24h

    private JwtService    jwtService;
    private JwtAuthFilter filter;

    private MockHttpServletRequest  request;
    private MockHttpServletResponse response;
    private FilterChain             chain;

    private String validToken;
    private String expiredToken;

    @BeforeEach
    void setUp() throws Exception {
        jwtService = new JwtService(TEST_SECRET, EXP_MS);
        filter     = new JwtAuthFilter(jwtService);

        request  = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
        chain    = mock(FilterChain.class);

        validToken = jwtService.generateToken("user-uuid-1", "admin@test.com", "ROLE_ADMIN");

        // Token expirado: recria o JwtService com expiração de -1ms
        JwtService expiredSvc = new JwtService(TEST_SECRET, -1L);
        expiredToken = expiredSvc.generateToken("user-uuid-1", "admin@test.com", "ROLE_ADMIN");

        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Cookie jwt válido: autentica com userId e role corretos")
    void cookieValid_authenticates() throws Exception {
        request.setCookies(new Cookie(JwtAuthFilter.COOKIE_NAME, validToken));

        filter.doFilterInternal(request, response, chain);

        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getName()).isEqualTo("user-uuid-1");
        assertThat(auth.getAuthorities()).extracting("authority").containsExactly("ROLE_ADMIN");
        verify(chain).doFilter(request, response);
    }

    @Test
    @DisplayName("Fallback: header Authorization válido autentica quando não há cookie")
    void headerFallback_authenticates() throws Exception {
        request.addHeader("Authorization", "Bearer " + validToken);

        filter.doFilterInternal(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    @DisplayName("Cookie tem prioridade sobre o header Authorization")
    void cookiePriorityOverHeader() throws Exception {
        // Cookie com token válido; header com token diferente (também válido, mas não deve ser usado)
        String headerToken = jwtService.generateToken("other-user", "other@test.com", "ROLE_USER");
        request.setCookies(new Cookie(JwtAuthFilter.COOKIE_NAME, validToken));
        request.addHeader("Authorization", "Bearer " + headerToken);

        filter.doFilterInternal(request, response, chain);

        // A autenticação deve ser do userId do COOKIE, não do header
        assertThat(SecurityContextHolder.getContext().getAuthentication().getName())
                .isEqualTo("user-uuid-1");
    }

    @Test
    @DisplayName("Cookie com token expirado: não autentica, chain continua")
    void expiredCookie_doesNotAuthenticate() throws Exception {
        request.setCookies(new Cookie(JwtAuthFilter.COOKIE_NAME, expiredToken));

        filter.doFilterInternal(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    @DisplayName("Header com token expirado: não autentica, chain continua")
    void expiredHeader_doesNotAuthenticate() throws Exception {
        request.addHeader("Authorization", "Bearer " + expiredToken);

        filter.doFilterInternal(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    @DisplayName("Sem cookie e sem header: não autentica, chain continua")
    void noToken_doesNotAuthenticate() throws Exception {
        filter.doFilterInternal(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    @DisplayName("Header Authorization malformado (sem 'Bearer '): não autentica")
    void malformedHeader_doesNotAuthenticate() throws Exception {
        request.addHeader("Authorization", "Token " + validToken);

        filter.doFilterInternal(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    @DisplayName("Token completamente inválido no cookie: não autentica")
    void garbageToken_doesNotAuthenticate() throws Exception {
        request.setCookies(new Cookie(JwtAuthFilter.COOKIE_NAME, "not.a.jwt.at.all"));

        filter.doFilterInternal(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }
}
