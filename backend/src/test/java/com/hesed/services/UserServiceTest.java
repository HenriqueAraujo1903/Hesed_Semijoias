package com.hesed.services;

import com.hesed.dto.UserRequest;
import com.hesed.dto.UserResponse;
import com.hesed.models.User;
import com.hesed.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Testes unitários do UserService: regras de e-mail único, senha (obrigatória
 * no create, opcional no update, sempre com BCrypt), papel válido e proteções
 * de autoexclusão / autorrebaixamento / último admin. Repositório e encoder
 * mockados — não sobe Spring.
 */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    @BeforeEach
    void setUp() {
        lenient().when(passwordEncoder.encode(anyString())).thenAnswer(inv -> "hashed:" + inv.getArgument(0));
        lenient().when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) u.setId(UUID.randomUUID());
            return u;
        });
    }

    private User user(String name, String email, String role) {
        return User.builder()
                .id(UUID.randomUUID())
                .name(name)
                .email(email)
                .password("hashed:old")
                .role(role)
                .build();
    }

    private UserRequest req(String name, String email, String phone, String password, String role) {
        UserRequest r = new UserRequest();
        r.setName(name);
        r.setEmail(email);
        r.setPhone(phone);
        r.setPassword(password);
        r.setRole(role);
        return r;
    }

    // ---- create ----

    @Test
    @DisplayName("create: aplica BCrypt, normaliza e-mail e nunca expõe a senha")
    void create_hashesPassword_normalizesEmail_noPasswordLeak() {
        when(userRepository.existsByEmail("novo@hesed.com")).thenReturn(false);

        UserResponse r = userService.create(
                req("Nova Pessoa", "  Novo@Hesed.com ", "(51) 98888-7777", "segredo123", "ROLE_OPERATOR"));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.getEmail()).isEqualTo("novo@hesed.com");           // normalizado (trim + lower)
        assertThat(saved.getPassword()).isEqualTo("hashed:segredo123");     // BCrypt aplicado
        assertThat(saved.getRole()).isEqualTo("ROLE_OPERATOR");
        // UserResponse não tem getter de senha — garantia em tempo de compilação.
        assertThat(r.getEmail()).isEqualTo("novo@hesed.com");
        assertThat(r.getPhone()).isEqualTo("(51) 98888-7777");
    }

    @Test
    @DisplayName("create: rejeita e-mail já existente")
    void create_rejectsDuplicateEmail() {
        when(userRepository.existsByEmail("dup@hesed.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.create(
                req("Dup", "dup@hesed.com", null, "segredo123", "ROLE_OPERATOR")))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("e-mail");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: senha é obrigatória")
    void create_requiresPassword() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);

        assertThatThrownBy(() -> userService.create(
                req("Sem Senha", "semsenha@hesed.com", null, "   ", "ROLE_OPERATOR")))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Senha obrigatória");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("create: rejeita papel inválido")
    void create_rejectsInvalidRole() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);

        assertThatThrownBy(() -> userService.create(
                req("Papel Errado", "papel@hesed.com", null, "segredo123", "ROLE_SUPERUSER")))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Papel inválido");
    }

    // ---- update ----

    @Test
    @DisplayName("update: senha em branco mantém a senha atual; preenchida re-hasheia")
    void update_passwordOptional() {
        User existing = user("Alguém", "alguem@hesed.com", "ROLE_OPERATOR");
        when(userRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        // senha em branco → mantém
        userService.update(existing.getId(),
                req("Alguém Editado", "alguem@hesed.com", null, "  ", "ROLE_OPERATOR"), UUID.randomUUID());
        assertThat(existing.getPassword()).isEqualTo("hashed:old");
        assertThat(existing.getName()).isEqualTo("Alguém Editado");

        // senha preenchida → re-hasheia
        userService.update(existing.getId(),
                req("Alguém Editado", "alguem@hesed.com", null, "novaSenha1", "ROLE_OPERATOR"), UUID.randomUUID());
        assertThat(existing.getPassword()).isEqualTo("hashed:novaSenha1");
    }

    @Test
    @DisplayName("update: não permite rebaixar o próprio papel de admin")
    void update_cannotDemoteSelf() {
        User self = user("Admin Eu", "eu@hesed.com", "ROLE_ADMIN");
        when(userRepository.findById(self.getId())).thenReturn(Optional.of(self));

        assertThatThrownBy(() -> userService.update(self.getId(),
                req("Admin Eu", "eu@hesed.com", null, null, "ROLE_OPERATOR"), self.getId()))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("próprio papel");
    }

    @Test
    @DisplayName("update: não permite rebaixar o último admin")
    void update_cannotDemoteLastAdmin() {
        User other = user("Outro Admin", "outro@hesed.com", "ROLE_ADMIN");
        when(userRepository.findById(other.getId())).thenReturn(Optional.of(other));
        when(userRepository.countByRole("ROLE_ADMIN")).thenReturn(1L);

        assertThatThrownBy(() -> userService.update(other.getId(),
                req("Outro Admin", "outro@hesed.com", null, null, "ROLE_OPERATOR"), UUID.randomUUID()))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("último administrador");
    }

    @Test
    @DisplayName("update: permite rebaixar admin quando há outros admins")
    void update_canDemoteWhenOtherAdminsExist() {
        User other = user("Outro Admin", "outro@hesed.com", "ROLE_ADMIN");
        when(userRepository.findById(other.getId())).thenReturn(Optional.of(other));
        when(userRepository.countByRole("ROLE_ADMIN")).thenReturn(2L);

        UserResponse r = userService.update(other.getId(),
                req("Outro Admin", "outro@hesed.com", null, null, "ROLE_OPERATOR"), UUID.randomUUID());

        assertThat(r.getRole()).isEqualTo("ROLE_OPERATOR");
    }

    @Test
    @DisplayName("update: rejeita e-mail já usado por outro usuário")
    void update_rejectsDuplicateEmailFromOther() {
        User existing = user("Alguém", "alguem@hesed.com", "ROLE_OPERATOR");
        when(userRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(userRepository.existsByEmail("jaexiste@hesed.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.update(existing.getId(),
                req("Alguém", "jaexiste@hesed.com", null, null, "ROLE_OPERATOR"), UUID.randomUUID()))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("e-mail");
    }

    // ---- delete ----

    @Test
    @DisplayName("delete: não permite excluir a própria conta")
    void delete_cannotDeleteSelf() {
        User self = user("Admin Eu", "eu@hesed.com", "ROLE_ADMIN");
        when(userRepository.findById(self.getId())).thenReturn(Optional.of(self));

        assertThatThrownBy(() -> userService.delete(self.getId(), self.getId()))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("própria conta");

        verify(userRepository, never()).delete(any());
    }

    @Test
    @DisplayName("delete: não permite excluir o último admin")
    void delete_cannotDeleteLastAdmin() {
        User lastAdmin = user("Último Admin", "last@hesed.com", "ROLE_ADMIN");
        when(userRepository.findById(lastAdmin.getId())).thenReturn(Optional.of(lastAdmin));
        when(userRepository.countByRole("ROLE_ADMIN")).thenReturn(1L);

        assertThatThrownBy(() -> userService.delete(lastAdmin.getId(), UUID.randomUUID()))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("último administrador");

        verify(userRepository, never()).delete(any());
    }

    @Test
    @DisplayName("delete: remove operador normalmente")
    void delete_removesOperator() {
        User op = user("Operador", "op@hesed.com", "ROLE_OPERATOR");
        when(userRepository.findById(op.getId())).thenReturn(Optional.of(op));

        userService.delete(op.getId(), UUID.randomUUID());

        verify(userRepository).delete(op);
    }

    @Test
    @DisplayName("findAll: filtra por nome/e-mail (case-insensitive)")
    void findAll_filters() {
        when(userRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(
                user("Maria Silva", "maria@hesed.com", "ROLE_ADMIN"),
                user("João Souza", "joao@hesed.com", "ROLE_OPERATOR")));

        assertThat(userService.findAll("maria")).hasSize(1);
        assertThat(userService.findAll("HESED")).hasSize(2);
        assertThat(userService.findAll(null)).hasSize(2);
        assertThat(userService.findAll("inexistente")).isEmpty();
    }
}
