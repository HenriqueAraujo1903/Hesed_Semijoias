package com.hesed.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataInitializer {

    /**
     * Não há mais seed automático de dados.
     *
     * - Usuários admin são gerenciados diretamente no banco (sem credenciais
     *   padrão inseguras).
     * - O catálogo de produtos é curado pela operadora na própria aplicação;
     *   re-semear produtos reintroduziria itens antigos/de teste que foram
     *   removidos intencionalmente.
     *
     * Mantido como bean vazio para deixar explícita a decisão (em vez de
     * simplesmente apagar a classe).
     */
    @Bean
    CommandLineRunner initData() {
        return args -> {
            System.out.println("🌿 HESED API pronta!");
        };
    }
}
