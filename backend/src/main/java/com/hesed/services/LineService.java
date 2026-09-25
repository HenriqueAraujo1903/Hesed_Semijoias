package com.hesed.services;

import com.hesed.dto.LineRequest;
import com.hesed.dto.LineResponse;
import com.hesed.models.Line;
import com.hesed.repositories.LineRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * CRUD das linhas de produto (Kids, Pet, Inverno, Verão…), com a flag de luxo.
 * Espelha o CategoryService. Nesta fase é apenas o cadastro — os pontos que
 * consomem a linha (incl. vínculo com o produto) virão em feature seguinte;
 * por isso ainda não há regra de "exclusão bloqueada por produto".
 */
@Service
public class LineService {

    private final LineRepository lineRepository;

    public LineService(LineRepository lineRepository) {
        this.lineRepository = lineRepository;
    }

    /** Todas (admin). */
    public List<LineResponse> findAll() {
        return lineRepository.findAllByOrderBySortOrderAscNameAsc()
                .stream().map(LineResponse::from).toList();
    }

    /** Só as ativas — usada para popular seletores/filtros. */
    public List<String> activeNames() {
        return lineRepository.findByActiveTrueOrderBySortOrderAscNameAsc()
                .stream().map(Line::getName).toList();
    }

    public LineResponse findById(UUID id) {
        Line l = lineRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Linha não encontrada."));
        return LineResponse.from(l);
    }

    @Transactional
    public LineResponse create(LineRequest request) {
        String name = request.getName().trim();
        if (lineRepository.existsByNameIgnoreCase(name)) {
            throw new RuntimeException("Já existe uma linha com este nome.");
        }
        Line l = Line.builder()
                .name(name)
                .active(request.getActive() != null ? request.getActive() : true)
                .luxo(request.getLuxo() != null ? request.getLuxo() : false)
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0)
                .build();
        return LineResponse.from(lineRepository.save(l));
    }

    @Transactional
    public LineResponse update(UUID id, LineRequest request) {
        Line l = lineRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Linha não encontrada."));
        String name = request.getName().trim();
        // Nome único (ignorando a própria linha).
        if (!l.getName().equalsIgnoreCase(name) && lineRepository.existsByNameIgnoreCase(name)) {
            throw new RuntimeException("Já existe uma linha com este nome.");
        }
        l.setName(name);
        if (request.getActive() != null) l.setActive(request.getActive());
        if (request.getLuxo() != null) l.setLuxo(request.getLuxo());
        if (request.getSortOrder() != null) l.setSortOrder(request.getSortOrder());
        return LineResponse.from(lineRepository.save(l));
    }

    @Transactional
    public void delete(UUID id) {
        if (!lineRepository.existsById(id)) {
            throw new RuntimeException("Linha não encontrada.");
        }
        lineRepository.deleteById(id);
    }
}
