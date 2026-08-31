package com.hesed.services;

import com.hesed.dto.SupplierRequest;
import com.hesed.dto.SupplierResponse;
import com.hesed.models.Supplier;
import com.hesed.repositories.ProductRepository;
import com.hesed.repositories.SupplierRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;

    public SupplierService(SupplierRepository supplierRepository,
                           ProductRepository productRepository) {
        this.supplierRepository = supplierRepository;
        this.productRepository = productRepository;
    }

    public List<SupplierResponse> findAll(String search) {
        String s = (search != null && !search.isBlank()) ? search.trim() : null;
        return supplierRepository.findFiltered(s)
                .stream()
                .map(SupplierResponse::from)
                .toList();
    }

    public SupplierResponse findById(UUID id) {
        Supplier s = supplierRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Fornecedor não encontrado."));
        return SupplierResponse.from(s);
    }

    @Transactional
    public SupplierResponse create(SupplierRequest request) {
        if (supplierRepository.existsByNameIgnoreCase(request.getName().trim())) {
            throw new RuntimeException("Já existe um fornecedor com este nome.");
        }
        Supplier s = Supplier.builder()
                .name(request.getName().trim())
                .phone(trimToNull(request.getPhone()))
                .email(trimToNull(request.getEmail()))
                .website(trimToNull(request.getWebsite()))
                .notes(trimToNull(request.getNotes()))
                .build();
        return SupplierResponse.from(supplierRepository.save(s));
    }

    @Transactional
    public SupplierResponse update(UUID id, SupplierRequest request) {
        Supplier s = supplierRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Fornecedor não encontrado."));
        s.setName(request.getName().trim());
        s.setPhone(trimToNull(request.getPhone()));
        s.setEmail(trimToNull(request.getEmail()));
        s.setWebsite(trimToNull(request.getWebsite()));
        s.setNotes(trimToNull(request.getNotes()));
        return SupplierResponse.from(supplierRepository.save(s));
    }

    @Transactional
    public void delete(UUID id) {
        if (!supplierRepository.existsById(id)) {
            throw new RuntimeException("Fornecedor não encontrado.");
        }
        if (productRepository.existsBySupplierId(id)) {
            throw new RuntimeException("Não é possível excluir: há produtos vinculados a este fornecedor.");
        }
        supplierRepository.deleteById(id);
    }

    private String trimToNull(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }
}
