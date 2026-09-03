package com.hesed.repositories;

import com.hesed.models.Consignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ConsignmentRepository extends JpaRepository<Consignment, UUID> {
    List<Consignment> findByStatusOrderByOpenedAtDesc(String status);
    List<Consignment> findAllByOrderByOpenedAtDesc();

    @org.springframework.data.jpa.repository.Query(
        "SELECT DISTINCT c FROM Consignment c LEFT JOIN FETCH c.consignee " +
        "WHERE (:status IS NULL OR c.status = :status) ORDER BY c.openedAt DESC")
    List<Consignment> findFiltered(@org.springframework.data.repository.query.Param("status") String status);

    @org.springframework.data.jpa.repository.Query(
        "SELECT c FROM Consignment c LEFT JOIN FETCH c.items i LEFT JOIN FETCH i.product " +
        "LEFT JOIN FETCH c.consignee WHERE c.id = :id")
    java.util.Optional<Consignment> findByIdWithItems(@org.springframework.data.repository.query.Param("id") UUID id);
}
