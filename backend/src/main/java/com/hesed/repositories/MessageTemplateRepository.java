package com.hesed.repositories;

import com.hesed.models.MessageTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageTemplateRepository extends JpaRepository<MessageTemplate, UUID> {
    Optional<MessageTemplate> findByTemplateKey(String templateKey);
    boolean existsByTemplateKey(String templateKey);
    List<MessageTemplate> findAllByOrderByTitleAsc();
}
