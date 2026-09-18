package com.hesed.repositories;

import com.hesed.models.NotificationDismissal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface NotificationDismissalRepository extends JpaRepository<NotificationDismissal, UUID> {

    boolean existsByNotificationKey(String notificationKey);

    /** Chaves dispensadas dentre um conjunto (para filtrar a lista calculada de uma vez). */
    List<NotificationDismissal> findByNotificationKeyIn(Collection<String> keys);
}
