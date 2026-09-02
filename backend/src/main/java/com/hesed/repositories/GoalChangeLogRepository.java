package com.hesed.repositories;

import com.hesed.models.GoalChangeLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface GoalChangeLogRepository extends JpaRepository<GoalChangeLog, UUID> {

    List<GoalChangeLog> findByYearAndMonthOrderByCreatedAtDesc(int year, int month);
}
