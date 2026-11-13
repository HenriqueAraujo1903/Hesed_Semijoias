package com.hesed.repositories;

import com.hesed.models.CashEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface CashEntryRepository extends JpaRepository<CashEntry, UUID> {

    List<CashEntry> findByEntryDateBetweenOrderByEntryDateDesc(LocalDate from, LocalDate to);
}
