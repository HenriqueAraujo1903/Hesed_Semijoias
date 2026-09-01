package com.hesed.services;

import com.hesed.config.JwtService;
import com.hesed.dto.LoginRequest;
import com.hesed.dto.LoginResponse;
import com.hesed.models.User;
import com.hesed.repositories.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    /**
     * Valida as credenciais e retorna o LoginResponse com o token e os dados
     * do usuário. O controller é responsável por mover o token para um cookie
     * HttpOnly em vez de expô-lo no body.
     */
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Credenciais inválidas."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Credenciais inválidas.");
        }

        String token = jwtService.generateToken(
                user.getId().toString(),
                user.getEmail(),
                user.getRole()
        );

        return new LoginResponse(token, user.getId().toString(), user.getName(), user.getEmail(), user.getRole());
    }

    /**
     * Retorna os dados do usuário a partir do userId extraído do token (já
     * validado pelo JwtAuthFilter). Usado pelo endpoint /api/auth/me para
     * confirmar que a sessão via cookie ainda é válida.
     */
    public LoginResponse me(String userId) {
        User user = userRepository.findById(UUID.fromString(userId))
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado."));
        return new LoginResponse(null, user.getId().toString(), user.getName(), user.getEmail(), user.getRole());
    }
}
