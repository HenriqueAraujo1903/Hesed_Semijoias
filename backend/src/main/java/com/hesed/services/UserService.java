package com.hesed.services;

import com.hesed.dto.UserRequest;
import com.hesed.dto.UserResponse;
import com.hesed.models.User;
import com.hesed.repositories.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Gestão de usuários do painel (CRUD admin). Concentra as regras de segurança:
 * e-mail único, senha sempre com BCrypt, papéis válidos, e proteções para o
 * admin não se trancar para fora (autoexclusão / autorrebaixamento / remoção
 * do último admin). A senha nunca sai daqui — as respostas usam UserResponse.
 */
@Service
public class UserService {

    private static final String ROLE_ADMIN = "ROLE_ADMIN";
    private static final String ROLE_OPERATOR = "ROLE_OPERATOR";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<UserResponse> findAll(String search) {
        String q = search == null ? "" : search.trim().toLowerCase();
        return userRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(u -> q.isEmpty()
                        || u.getName().toLowerCase().contains(q)
                        || u.getEmail().toLowerCase().contains(q))
                .map(UserResponse::from)
                .toList();
    }

    public UserResponse findById(UUID id) {
        return UserResponse.from(getOrThrow(id));
    }

    @Transactional
    public UserResponse create(UserRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Já existe um usuário com este e-mail.");
        }
        String password = trimToNull(request.getPassword());
        if (password == null) {
            throw new RuntimeException("Senha obrigatória para criar um usuário.");
        }
        validateRole(request.getRole());

        User user = User.builder()
                .name(request.getName().trim())
                .email(email)
                .phone(trimToNull(request.getPhone()))
                .password(passwordEncoder.encode(password))
                .role(request.getRole())
                .build();

        return UserResponse.from(userRepository.save(user));
    }

    /**
     * @param currentUserId id do admin autenticado (para regras de autoproteção)
     */
    @Transactional
    public UserResponse update(UUID id, UserRequest request, UUID currentUserId) {
        User user = getOrThrow(id);
        validateRole(request.getRole());

        // E-mail único (se mudou)
        String email = normalizeEmail(request.getEmail());
        if (!email.equals(user.getEmail()) && userRepository.existsByEmail(email)) {
            throw new RuntimeException("Já existe um usuário com este e-mail.");
        }

        // Proteção: o admin logado não pode rebaixar o próprio papel (evita
        // ficar sem acesso admin acidentalmente) e não pode rebaixar o último admin.
        boolean isSelf = user.getId().equals(currentUserId);
        boolean demotingFromAdmin = ROLE_ADMIN.equals(user.getRole()) && !ROLE_ADMIN.equals(request.getRole());
        if (demotingFromAdmin) {
            if (isSelf) {
                throw new RuntimeException("Você não pode rebaixar o seu próprio papel de administrador.");
            }
            if (userRepository.countByRole(ROLE_ADMIN) <= 1) {
                throw new RuntimeException("Não é possível rebaixar o último administrador do sistema.");
            }
        }

        user.setName(request.getName().trim());
        user.setEmail(email);
        user.setPhone(trimToNull(request.getPhone()));
        user.setRole(request.getRole());

        // Senha: só troca se veio preenchida (em branco = mantém a atual).
        String password = trimToNull(request.getPassword());
        if (password != null) {
            user.setPassword(passwordEncoder.encode(password));
        }

        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public void delete(UUID id, UUID currentUserId) {
        User user = getOrThrow(id);

        if (user.getId().equals(currentUserId)) {
            throw new RuntimeException("Você não pode excluir a sua própria conta.");
        }
        if (ROLE_ADMIN.equals(user.getRole()) && userRepository.countByRole(ROLE_ADMIN) <= 1) {
            throw new RuntimeException("Não é possível excluir o último administrador do sistema.");
        }

        userRepository.delete(user);
    }

    // ---- helpers ----

    private User getOrThrow(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado."));
    }

    private void validateRole(String role) {
        if (!ROLE_ADMIN.equals(role) && !ROLE_OPERATOR.equals(role)) {
            throw new RuntimeException("Papel inválido.");
        }
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
