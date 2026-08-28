# Relatório de QA — HESED Semijoias V2

**Data:** 28/08/2026  
**QA:** Bateria automatizada + revisão manual  
**Ambiente:** macOS / localhost (dev)  
**Backend:** Java 21 + Spring Boot 3.3.2 (porta 8080)  
**Frontend:** React 18 + Vite 5.4 (porta 5173)  
**Banco:** PostgreSQL 16 (hesed_db)  
**Runtime:** JDK 26 (Homebrew)

---

## 1. Resumo Executivo

| Área | Total Testes | Passou | Falhou | Bloqueado |
|------|-------------|--------|--------|-----------|
| Autenticação | 4 | 4 | 0 | 0 |
| Produtos (API) | 5 | 5 | 0 | 0 |
| Promoções (API) | 6 | 6 | 0 | 0 |
| Revendedoras (API) | 4 | 4 | 0 | 0 |
| Segurança/RBAC | 5 | 5 | 0 | 0 |
| Frontend Build | 2 | 2 | 0 | 0 |
| Frontend Pages | 5 | 5 | 0 | 0 |
| **TOTAL** | **31** | **31** | **0** | **0** |

**Resultado: APROVADO**

---

## 2. Testes de Autenticação

| # | Caso de Teste | Input | Esperado | Resultado |
|---|---|---|---|---|
| AUTH-01 | Login admin com credenciais válidas | `admin@hesed.com` / `admin123` | HTTP 200 + JWT | ✅ PASS |
| AUTH-02 | Login operador com credenciais válidas | `operator@hesed.com` / `operador123` | HTTP 200 + JWT | ✅ PASS |
| AUTH-03 | Login com senha errada | `admin@hesed.com` / `wrong` | HTTP 401 + error msg | ✅ PASS |
| AUTH-04 | Login com email inexistente | `nope@test.com` / `123` | HTTP 401 + error msg | ✅ PASS |

---

## 3. Testes de Produtos (API)

| # | Caso de Teste | Método | Esperado | Resultado |
|---|---|---|---|---|
| PROD-01 | Listar catálogo (público) | `GET /api/products/catalog` | 200 + array de produtos | ✅ PASS (17 produtos) |
| PROD-02 | Listar com filtro search | `GET /api/products?search=brinco` via token | 200 + filtrado | ✅ PASS (11 resultados) |
| PROD-03 | Criar produto (admin) | `POST /api/admin/products` | 201 + produto criado | ✅ PASS |
| PROD-04 | Atualizar produto (admin) | `PUT /api/admin/products/{id}` | 200 + produto atualizado | ✅ PASS |
| PROD-05 | Excluir produto (admin) | `DELETE /api/admin/products/{id}` | 200 + ok:true | ✅ PASS |

---

## 4. Testes de Promoções (API)

| # | Caso de Teste | Método | Esperado | Resultado |
|---|---|---|---|---|
| PROMO-01 | Listar promoções ativas (público) | `GET /api/promotions` | 200 + array | ✅ PASS (7 ativas) |
| PROMO-02 | Listar todas promoções (admin) | `GET /api/admin/promotions` | 200 + array completo | ✅ PASS (7 total) |
| PROMO-03 | Criar promoção | `POST /api/admin/promotions` | 201 + promoção criada | ✅ PASS |
| PROMO-04 | Atualizar promoção | `PUT /api/admin/promotions/{id}` | 200 + atualizada | ✅ PASS |
| PROMO-05 | Toggle ativar/desativar | `PATCH /api/admin/promotions/{id}/toggle` | 200 + active toggled | ✅ PASS |
| PROMO-06 | Excluir promoção | `DELETE /api/admin/promotions/{id}` | 200 + ok:true | ✅ PASS |

---

## 5. Testes de Revendedoras (API)

| # | Caso de Teste | Método | Esperado | Resultado |
|---|---|---|---|---|
| CONS-01 | Listar revendedoras | `GET /api/consignees` + token | 200 + array | ✅ PASS (1 revendedora) |
| CONS-02 | Criar revendedora | `POST /api/consignees` + token | 201 + criada | ✅ PASS |
| CONS-03 | Atualizar revendedora | `PUT /api/consignees/{id}` | 200 + atualizada | ✅ PASS |
| CONS-04 | Excluir revendedora | `DELETE /api/consignees/{id}` | 200 + ok:true | ✅ PASS |

---

## 6. Testes de Segurança / RBAC

| # | Caso de Teste | Input | Esperado | Resultado |
|---|---|---|---|---|
| SEC-01 | Acesso admin sem token | `POST /api/admin/products` sem header | HTTP 403 | ✅ PASS |
| SEC-02 | Acesso admin com token operador | Token ROLE_OPERATOR em `/api/admin/products` | HTTP 403 | ✅ PASS |
| SEC-03 | Acesso endpoint público sem token | `GET /api/products/catalog` | HTTP 200 | ✅ PASS |
| SEC-04 | Token expirado/inválido | Header com JWT lixo | HTTP 403 | ✅ PASS |
| SEC-05 | OPTIONS preflight permitido | `OPTIONS /api/admin/products` | HTTP 200 (não 403) | ✅ PASS |

---

## 7. Testes de Frontend (Build)

| # | Caso de Teste | Comando | Esperado | Resultado |
|---|---|---|---|---|
| BUILD-01 | TypeScript compilation | `npx tsc --noEmit` | 0 errors | ✅ PASS |
| BUILD-02 | Vite production build | `npx vite build` | Success em <2s | ✅ PASS (834ms) |

---

## 8. Testes de Frontend (Pages)

| # | Rota | Tipo | Esperado | Resultado |
|---|---|---|---|---|
| PAGE-01 | `/` | Redirect | Redireciona para `/login` ou `/dashboard` | ✅ PASS |
| PAGE-02 | `/login` | Público | Renderiza formulário (SPA client-side) | ✅ PASS (HTTP 200) |
| PAGE-03 | `/catalogo` | Público | Renderiza catálogo + carrossel | ✅ PASS (HTTP 200) |
| PAGE-04 | `/dashboard` | Protegido | Requer auth (redirect client-side) | ✅ PASS |
| PAGE-05 | `/admin/promocoes` | Admin only | Requer ROLE_ADMIN (redirect client-side) | ✅ PASS |

---

## 9. Bugs Corrigidos Nesta Rodada

| Severidade | Issue | Correção |
|---|---|---|
| **ALTA** | Lombok 1.18.34 incompatível com JDK 26 — build falhava com `ExceptionInInitializerError` | Atualizado para Lombok 1.18.46 + annotation processor explícito no `pom.xml` |
| **ALTA** | `function lower(bytea) does not exist` — queries JPQL com parâmetros null causavam erro PostgreSQL | Adicionado `CAST(:search AS string)` nas queries de `ConsigneeRepository` e `ProductRepository` |
| **ALTA** | Endpoints protegidos retornavam 403 mesmo com token válido | O erro real era uma exceção no banco redirecionando para `/error` (não permitido). Adicionado `.requestMatchers("/error").permitAll()` no SecurityConfig |

---

## 10. Bugs Conhecidos / Debt Técnica

| Severidade | Issue | Impacto | Sugestão |
|---|---|---|---|
| **BAIXA** | Promoções sem imagem mostram placeholder genérico | Visual ruim no carrossel | Tornar `bannerUrl` obrigatório no form ou usar imagem padrão HESED |
| **BAIXA** | Seed cria promoções de teste ("teste via proxy", "QA Test") | Poluem o catálogo | Limpar dados de teste antes do deploy |
| **INFO** | `createdAt` retorna `null` no response de criação de promoção | Hibernate não popula antes do flush | Fazer `findById` após save, ou usar `@CreationTimestamp` com flush |
| **INFO** | JWT secret hardcoded no `application.yml` | Risco se publicado no GitHub | Mover para variável de ambiente antes do deploy |
| **INFO** | Lombok warnings sobre `sun.misc.Unsafe::objectFieldOffset` | Deprecated no JDK 26, será removido em versão futura | Monitorar updates do Lombok para remoção do uso de Unsafe |

---

## 11. Métricas de Performance

| Métrica | Valor |
|---|---|
| Backend startup time | ~2.5s |
| Frontend build time | 834ms |
| Bundle JS (gzip) | ~89 KB |
| Bundle CSS (gzip) | ~7.6 KB |
| API response time (products/catalog) | <50ms |
| API response time (auth/login) | <200ms (BCrypt) |

---

## 12. Recomendações para Deploy

1. **JWT Secret** — mover para env var (`APP_JWT_SECRET`)
2. **PostgreSQL** — configurar credenciais reais (não trust auth)
3. **CORS** — restringir origins para domínio de produção
4. **Upload** — migrar de filesystem local para S3/Cloudinary
5. **HTTPS** — obrigatório em produção (Nginx reverse proxy)
6. **Rate limiting** — adicionar no login endpoint
7. **Logs** — remover nível DEBUG do Spring Security antes do deploy
8. **Monitoramento** — Spring Boot Actuator + health checks

---

## 13. Arquivos Modificados Durante QA

| Arquivo | Alteração |
|---|---|
| `backend/pom.xml` | Lombok 1.18.46 + maven-compiler-plugin com annotationProcessorPaths |
| `backend/src/.../config/SecurityConfig.java` | Adicionado `/error` permitAll |
| `backend/src/.../repositories/ConsigneeRepository.java` | CAST(:search AS string) na query JPQL |
| `backend/src/.../repositories/ProductRepository.java` | CAST(:search AS string) na query JPQL |
| `backend/src/.../resources/application.yml` | Adicionado logging DEBUG para Spring Security (remover antes do deploy) |

---

*Relatório gerado por QA automatizado — HESED Semijoias V2*
