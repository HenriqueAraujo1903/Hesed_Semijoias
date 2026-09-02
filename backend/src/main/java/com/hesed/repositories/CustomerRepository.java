package com.hesed.repositories;

import com.hesed.models.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    boolean existsByEmail(String email);

    /** Busca por nome ou telefone (contém), ordenada por nome. */
    @Query("SELECT c FROM Customer c WHERE " +
           "(:search IS NULL " +
           " OR LOWER(c.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')) " +
           " OR c.phone LIKE CONCAT('%', CAST(:search AS string), '%')) " +
           "ORDER BY c.name ASC")
    List<Customer> findFiltered(@Param("search") String search);
}
