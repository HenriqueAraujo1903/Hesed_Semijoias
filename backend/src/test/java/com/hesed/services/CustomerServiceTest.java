package com.hesed.services;

import com.hesed.dto.CustomerRequest;
import com.hesed.dto.CustomerResponse;
import com.hesed.models.Customer;
import com.hesed.repositories.CustomerRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerServiceTest {

    @Mock private CustomerRepository repository;
    @InjectMocks private CustomerService service;

    private CustomerRequest req(String name, String phone, String email, String notes) {
        CustomerRequest r = new CustomerRequest();
        r.setName(name);
        r.setPhone(phone);
        r.setEmail(email);
        r.setNotes(notes);
        return r;
    }

    @Test
    @DisplayName("create: cria cliente e normaliza (trim, e-mail/notes vazio -> null)")
    void create_ok() {
        when(repository.save(any(Customer.class))).thenAnswer(inv -> inv.getArgument(0));

        CustomerResponse r = service.create(req("  Maria Silva ", " (51) 99999-8888 ", "  ", "  "));

        assertThat(r.getName()).isEqualTo("Maria Silva");
        assertThat(r.getPhone()).isEqualTo("(51) 99999-8888");
        assertThat(r.getEmail()).isNull();
        assertThat(r.getNotes()).isNull();
    }

    @Test
    @DisplayName("create: e-mail duplicado é rejeitado")
    void create_duplicateEmail() {
        when(repository.existsByEmail("maria@ex.com")).thenReturn(true);

        assertThatThrownBy(() -> service.create(req("Maria", "51999998888", "maria@ex.com", null)))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("e-mail");
    }

    @Test
    @DisplayName("update: altera dados do cliente existente")
    void update_ok() {
        UUID id = UUID.randomUUID();
        Customer existing = Customer.builder().id(id).name("Antiga").phone("5133330000").email("a@ex.com").build();
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.save(any(Customer.class))).thenAnswer(inv -> inv.getArgument(0));

        CustomerResponse r = service.update(id, req("Nova", "51988887777", "a@ex.com", "vip"));

        assertThat(r.getName()).isEqualTo("Nova");
        assertThat(r.getPhone()).isEqualTo("51988887777");
        assertThat(r.getNotes()).isEqualTo("vip");
    }

    @Test
    @DisplayName("update: e-mail de OUTRO cliente é rejeitado")
    void update_duplicateEmailOfAnother() {
        UUID id = UUID.randomUUID();
        Customer existing = Customer.builder().id(id).name("X").phone("5133330000").email("meu@ex.com").build();
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.existsByEmail("outro@ex.com")).thenReturn(true);

        assertThatThrownBy(() -> service.update(id, req("X", "5133330000", "outro@ex.com", null)))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("e-mail");
    }

    @Test
    @DisplayName("update: manter o mesmo e-mail do próprio cliente é permitido")
    void update_sameEmailAllowed() {
        UUID id = UUID.randomUUID();
        Customer existing = Customer.builder().id(id).name("X").phone("5133330000").email("meu@ex.com").build();
        when(repository.findById(id)).thenReturn(Optional.of(existing));
        when(repository.save(any(Customer.class))).thenAnswer(inv -> inv.getArgument(0));

        CustomerResponse r = service.update(id, req("X2", "5133330000", "MEU@ex.com", null));

        assertThat(r.getName()).isEqualTo("X2");
    }

    @Test
    @DisplayName("findById / delete: cliente inexistente lança erro")
    void notFound() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.findById(id))
                .isInstanceOf(RuntimeException.class).hasMessageContaining("não encontrado");

        when(repository.existsById(id)).thenReturn(false);
        assertThatThrownBy(() -> service.delete(id))
                .isInstanceOf(RuntimeException.class).hasMessageContaining("não encontrado");
    }
}
