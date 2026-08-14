package com.hesed.repositories;

import com.hesed.models.Consignee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ConsigneeRepository extends JpaRepository<Consignee, UUID> {

    boolean existsByEmail(String email);

    @Query("SELECT c FROM Consignee c WHERE " +
           "(:search IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "ORDER BY c.name ASC")
    List<Consignee> findFiltered(@Param("search") String search);
}
