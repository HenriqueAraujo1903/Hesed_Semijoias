package com.hesed.services;

import com.hesed.dto.ConsigneeRequest;
import com.hesed.dto.ConsigneeResponse;
import com.hesed.models.Consignee;
import com.hesed.repositories.ConsigneeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ConsigneeService {

    private final ConsigneeRepository consigneeRepository;

    public ConsigneeService(ConsigneeRepository consigneeRepository) {
        this.consigneeRepository = consigneeRepository;
    }

    public List<ConsigneeResponse> findAll(String search) {
        return consigneeRepository.findFiltered(search)
                .stream()
                .map(ConsigneeResponse::from)
                .toList();
    }

    public ConsigneeResponse findById(UUID id) {
        Consignee c = consigneeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Revendedora não encontrada."));
        return ConsigneeResponse.from(c);
    }

    @Transactional
    public ConsigneeResponse create(ConsigneeRequest request) {
        if (request.getEmail() != null && !request.getEmail().isBlank()
                && consigneeRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Já existe uma revendedora com este e-mail.");
        }

        Consignee consignee = Consignee.builder()
                .name(request.getName())
                .phone(request.getPhone())
                .email(request.getEmail() != null && !request.getEmail().isBlank() ? request.getEmail() : null)
                .commissionRate(request.getCommissionRate())
                .build();

        return ConsigneeResponse.from(consigneeRepository.save(consignee));
    }

    @Transactional
    public ConsigneeResponse update(UUID id, ConsigneeRequest request) {
        Consignee consignee = consigneeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Revendedora não encontrada."));

        consignee.setName(request.getName());
        consignee.setPhone(request.getPhone());
        consignee.setEmail(request.getEmail() != null && !request.getEmail().isBlank() ? request.getEmail() : null);
        consignee.setCommissionRate(request.getCommissionRate());

        return ConsigneeResponse.from(consigneeRepository.save(consignee));
    }

    @Transactional
    public void delete(UUID id) {
        if (!consigneeRepository.existsById(id)) {
            throw new RuntimeException("Revendedora não encontrada.");
        }
        consigneeRepository.deleteById(id);
    }
}
