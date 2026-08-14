package com.hesed.repositories;

import com.hesed.models.Consignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ConsignmentRepository extends JpaRepository<Consignment, UUID> {
    List<Consignment> findByStatusOrderByOpenedAtDesc(String status);
    List<Consignment> findAllByOrderByOpenedAtDesc();
}
