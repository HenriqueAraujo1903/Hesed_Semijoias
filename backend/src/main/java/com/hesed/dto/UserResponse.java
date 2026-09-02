package com.hesed.dto;

import com.hesed.models.User;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Representação segura de um usuário para o painel admin. NUNCA expõe o hash
 * da senha.
 */
@Data
public class UserResponse {
    private UUID id;
    private String name;
    private String email;
    private String phone;
    private String role;
    private LocalDateTime createdAt;

    public static UserResponse from(User u) {
        UserResponse r = new UserResponse();
        r.setId(u.getId());
        r.setName(u.getName());
        r.setEmail(u.getEmail());
        r.setPhone(u.getPhone());
        r.setRole(u.getRole());
        r.setCreatedAt(u.getCreatedAt());
        return r;
    }
}
