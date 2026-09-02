package com.hesed.services;

import com.hesed.dto.CustomerRequest;
import com.hesed.dto.CustomerResponse;
import com.hesed.models.Customer;
import com.hesed.repositories.CustomerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;

    public CustomerService(CustomerRepository customerRepository) {
        this.customerRepository = customerRepository;
    }

    public List<CustomerResponse> findAll(String search) {
        return customerRepository.findFiltered(search)
                .stream()
                .map(CustomerResponse::from)
                .toList();
    }

    public CustomerResponse findById(UUID id) {
        return CustomerResponse.from(getOrThrow(id));
    }

    @Transactional
    public CustomerResponse create(CustomerRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (email != null && customerRepository.existsByEmail(email)) {
            throw new RuntimeException("Já existe um cliente com este e-mail.");
        }

        Customer customer = Customer.builder()
                .name(request.getName().trim())
                .phone(request.getPhone().trim())
                .email(email)
                .notes(normalizeNotes(request.getNotes()))
                .build();

        return CustomerResponse.from(customerRepository.save(customer));
    }

    @Transactional
    public CustomerResponse update(UUID id, CustomerRequest request) {
        Customer customer = getOrThrow(id);

        String email = normalizeEmail(request.getEmail());
        if (email != null && !email.equalsIgnoreCase(customer.getEmail())
                && customerRepository.existsByEmail(email)) {
            throw new RuntimeException("Já existe um cliente com este e-mail.");
        }

        customer.setName(request.getName().trim());
        customer.setPhone(request.getPhone().trim());
        customer.setEmail(email);
        customer.setNotes(normalizeNotes(request.getNotes()));

        return CustomerResponse.from(customerRepository.save(customer));
    }

    @Transactional
    public void delete(UUID id) {
        if (!customerRepository.existsById(id)) {
            throw new RuntimeException("Cliente não encontrado.");
        }
        customerRepository.deleteById(id);
    }

    private Customer getOrThrow(UUID id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Cliente não encontrado."));
    }

    private String normalizeEmail(String email) {
        return (email != null && !email.isBlank()) ? email.trim().toLowerCase() : null;
    }

    private String normalizeNotes(String notes) {
        return (notes != null && !notes.isBlank()) ? notes.trim() : null;
    }
}
