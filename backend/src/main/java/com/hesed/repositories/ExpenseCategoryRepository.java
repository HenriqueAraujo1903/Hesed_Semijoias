package com.hesed.repositories;

import com.hesed.models.ExpenseCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExpenseCategoryRepository extends JpaRepository<ExpenseCategory, UUID> {
    List<ExpenseCategory> findAllByOrderBySortOrderAscNameAsc();
    boolean existsByNameIgnoreCase(String name);
    java.util.Optional<ExpenseCategory> findFirstByNameIgnoreCase(String name);
}
