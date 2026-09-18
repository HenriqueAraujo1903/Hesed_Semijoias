package com.hesed.services;

import com.hesed.dto.NotificationResponse;
import com.hesed.models.Customer;
import com.hesed.models.NotificationDismissal;
import com.hesed.repositories.CustomerRepository;
import com.hesed.repositories.NotificationDismissalRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Central de notificações. As notificações são DERIVADAS (calculadas em tempo
 * real) e filtradas pelas dispensas persistidas — não guardamos as notificações
 * em si, só o que foi dispensado.
 *
 * Hoje há um gerador: aniversário de cliente. Regra: da véspera dos 5 dias até
 * o próprio dia do aniversário (inclusive), uma notificação por dia. Some no
 * dia seguinte ao aniversário e reaparece no ano seguinte.
 */
@Service
public class NotificationService {

    /** Antecedência (em dias) com que o aniversário passa a notificar. */
    private static final int BIRTHDAY_WINDOW_DAYS = 5;

    private final CustomerRepository customerRepository;
    private final NotificationDismissalRepository dismissalRepository;

    public NotificationService(CustomerRepository customerRepository,
                               NotificationDismissalRepository dismissalRepository) {
        this.customerRepository = customerRepository;
        this.dismissalRepository = dismissalRepository;
    }

    public List<NotificationResponse> list() {
        LocalDate today = LocalDate.now();
        List<NotificationResponse> all = new ArrayList<>(buildBirthdayNotifications(today));

        // Filtra as dispensadas (uma consulta só).
        if (!all.isEmpty()) {
            Set<String> keys = new HashSet<>();
            for (NotificationResponse n : all) keys.add(n.getKey());
            Set<String> dismissed = new HashSet<>();
            for (NotificationDismissal d : dismissalRepository.findByNotificationKeyIn(keys)) {
                dismissed.add(d.getNotificationKey());
            }
            all.removeIf(n -> dismissed.contains(n.getKey()));
        }

        // Mais próximos primeiro (hoje no topo).
        all.sort((a, b) -> Integer.compare(
                a.getDaysUntil() != null ? a.getDaysUntil() : Integer.MAX_VALUE,
                b.getDaysUntil() != null ? b.getDaysUntil() : Integer.MAX_VALUE));
        return all;
    }

    @Transactional
    public void dismiss(String key, String userId) {
        if (key == null || key.isBlank()) {
            throw new RuntimeException("Chave de notificação inválida.");
        }
        // Idempotente: se já dispensada, não duplica.
        if (dismissalRepository.existsByNotificationKey(key)) {
            return;
        }
        dismissalRepository.save(NotificationDismissal.builder()
                .notificationKey(key)
                .dismissedBy(userId)
                .build());
    }

    // ===========================================================================
    // Gerador: aniversários de cliente
    // ===========================================================================

    private List<NotificationResponse> buildBirthdayNotifications(LocalDate today) {
        List<NotificationResponse> out = new ArrayList<>();
        for (Customer c : customerRepository.findAll()) {
            LocalDate birth = c.getBirthDate();
            if (birth == null) continue;

            Integer daysUntil = daysUntilNextBirthday(birth, today);
            if (daysUntil == null || daysUntil < 0 || daysUntil > BIRTHDAY_WINDOW_DAYS) {
                continue; // fora da janela (0..5 dias)
            }

            // Ano em que cai o próximo aniversário — entra na chave para reaparecer
            // no ano seguinte mesmo depois de dispensado.
            LocalDate nextBday = today.plusDays(daysUntil);
            String key = "BIRTHDAY:" + c.getId() + ":" + nextBday.getYear();

            NotificationResponse n = new NotificationResponse();
            n.setKey(key);
            n.setType("BIRTHDAY");
            n.setTitle("Aniversário de cliente");
            n.setMessage(birthdayMessage(c.getName(), daysUntil));
            n.setDaysUntil(daysUntil);
            n.setCustomerId(c.getId());
            n.setCustomerName(c.getName());
            n.setCustomerPhone(c.getPhone());
            n.setBirthDate(birth);
            out.add(n);
        }
        return out;
    }

    /**
     * Dias até o próximo aniversário considerando apenas dia/mês (ignora o ano de
     * nascimento). 0 = hoje. Trata 29/02 caindo em ano não-bissexto como 28/02.
     */
    static Integer daysUntilNextBirthday(LocalDate birth, LocalDate today) {
        LocalDate thisYear = birthdayInYear(birth, today.getYear());
        if (!thisYear.isBefore(today)) {
            return (int) (thisYear.toEpochDay() - today.toEpochDay());
        }
        // Já passou este ano → próximo é no ano que vem.
        LocalDate nextYear = birthdayInYear(birth, today.getYear() + 1);
        return (int) (nextYear.toEpochDay() - today.toEpochDay());
    }

    /** O aniversário no ano dado, com salvaguarda para 29/02 em ano não-bissexto. */
    private static LocalDate birthdayInYear(LocalDate birth, int year) {
        int month = birth.getMonthValue();
        int day = birth.getDayOfMonth();
        if (month == 2 && day == 29 && !java.time.Year.isLeap(year)) {
            day = 28;
        }
        return LocalDate.of(year, month, day);
    }

    private String birthdayMessage(String name, int daysUntil) {
        String quando = switch (daysUntil) {
            case 0 -> "é hoje 🎉";
            case 1 -> "é amanhã";
            default -> "em " + daysUntil + " dias";
        };
        return "Aniversário de " + name + " " + quando + ".";
    }
}
