package com.hesed.repositories;

import com.hesed.models.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {

    @Query("SELECT s FROM Supplier s WHERE " +
           "(:search IS NULL OR LOWER(s.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))) " +
           "ORDER BY s.name ASC")
    List<Supplier> findFiltered(@Param("search") String search);

    boolean existsByNameIgnoreCase(String name);
}
