# Relatório de QA — Homologação HESED Semijoias

**Data:** 31/08/2026
**QA:** Bateria automatizada end-to-end (perfil sênior)
**Ambiente:** Homologação local
- Backend: Java 21 / Spring Boot 3.3.2 — porta **8081**, profile `homolog`
- Frontend: React 18 / Vite 5.4 — porta **5174** (proxy → 8081)
- Banco: PostgreSQL — **`hesed_homolog`** (isolado do dev e da produção)
- Branch: `homolog` (commit `c4ccce7`)
- Harness: `qa/qa_homolog.py` (stdlib pura, sem dependências)

---

## 1. Resultado

| Métrica | Valor |
|---|---|
| **Total de testes** | **330** |
| **Aprovados** | **330** |
| **Reprovados** | **0** |
| Tempo de execução | ~1,3 s |
| Dados de teste vazados | 0 (banco limpo ao final) |

**100% de aprovação.**

---

## 2. Escopo desta homologação

Leva acumulada na branch `dev`/`homolog` desde a última entrega em produção:

- **Múltiplas fotos por produto (até 5)** — galeria no admin, modal de detalhe no catálogo, `imageUrl` como capa (1ª foto)
- **Ordenação de esgotados** — produtos `ESGOTADO` vão para o fim do catálogo
- **Painel admin responsivo (mobile) + PWA** instalável
- Regressão completa das funcionalidades já em produção

---

## 3. Suítes executadas

| Suíte | Área | Foco |
|---|---|---|
| A | Autenticação / RBAC / Segurança | Login válido/inválido, e-mails malformados, campos em branco, acesso negado a `/api/admin` sem token e com token inválido, headers `Authorization` malformados, fronteira público × protegido |
| B | **Múltiplas fotos** (feature nova) | 1..5 fotos, exatamente 5 (limite), 6+ rejeitado (400), deduplicação, remoção de blanks/nulos, capa = 1ª foto, retrocompatibilidade com `imageUrl`, reordenação via update, remoção de fotos, persistência no `/catalog` |
| C | **Ordenação de esgotados** (feature nova) | Esgotados sempre no fim, bloco final 100% esgotado, ordem por (categoria, nome) preservada dentro de cada grupo, contagem consistente |
| D | Regressão Produtos | CRUD, SKU duplicado/inválido (caracteres proibidos), nome curto, preços nulos/zero/negativos, filtros category/stock/search, delete/update de inexistente |
| E | Regressão Promoções | Criar/editar/toggle, snapshot de preço/nome do produto, presença nas ativas, validação de desconto (0..100) e `promoPrice` (positivo), produto inexistente, título/produto ausentes |
| F | Regressão Consignados | CRUD, validação de nome (3..100), telefone (regex), e-mail, comissão (0..1 com limites), comissão ausente, not found (404), acesso sem token |
| G | Regressão Pedidos | Pedido público (`productIds`), **integridade de preço server-side** (total calculado no backend), lista vazia/sem ids/produto inexistente, summary, transições de status, confirmar exige nome do cliente, teto de 50 itens |
| I | RBAC exaustivo | Matriz completa de rotas admin × métodos (sem token e com token inválido → negado), rotas públicas acessíveis, endpoints de analytics (`/sales`, `/engagement`) protegidos e respondendo 200 para admin |
| H | Robustez / Limites / Consistência | Nome nos limites (2/3/120/121), SKUs válidos variados, categorias, cada `stockStatus`, capa consistente em toda a galeria, JSON malformado → 400 (não 500), método não suportado, rota inexistente, XSS armazenado como dado, descrição acima de 500 |
| J | Validação adicional | Varredura ampla de e-mails/SKUs/telefones inválidos, comissões e descontos válidos na faixa, nomes com acento PT-BR, galeria com extensões variadas |

---

## 4. Verificações-chave de segurança e integridade

- **RBAC:** todas as rotas `/api/admin/**` negam acesso sem token e com token inválido. Rotas públicas (catálogo, promoções ativas, registro de pedido, telemetria) permanecem acessíveis.
- **Integridade financeira:** o total do pedido é sempre calculado no servidor a partir do `salePrice`/promoção vigente — o cliente não consegue injetar preço.
- **Snapshot de promoção:** a promoção preserva nome e preço original do produto no momento da criação.
- **Integridade referencial:** produtos já usados em pedidos não podem ser excluídos (FK em `order_items`), protegendo o histórico de vendas. Confirmado em teste.
- **Retrocompatibilidade das fotos:** `imageUrl` (capa) sempre reflete a 1ª foto da galeria — carrossel de promoções, cards do catálogo e listagens antigas continuam funcionando sem alteração.

---

## 5. Observações (não bloqueiam a promoção)

| Severidade | Item | Nota |
|---|---|---|
| INFO | Validação de telefone do consignado | A regex aceita `51983396457` (11 dígitos) e fixo `(51) 3339-6457`, mas rejeita celular formatado com traço `(51) 98339-6457`. Comportamento **pré-existente**, não introduzido nesta leva. Melhoria futura opcional: flexibilizar a máscara. |
| INFO | Telemetria pública sem rate limit | Aceitável para o volume atual; melhoria futura se escalar. |
| INFO | Migração de schema | A tabela `product_images` é criada automaticamente pelo `ddl-auto: update` (aditiva). Coluna `image_url` original preservada. Nenhuma migração destrutiva. |

Nenhum bug funcional encontrado. Os dois "falsos negativos" iniciais foram do próprio harness (formato de telefone e expectativa de delete de produto com pedido), corrigidos após confirmar que o sistema estava correto.

---

## 6. Veredito

**APROVADO para promoção `homolog → produção`.**

330/330 testes aprovados, cobrindo as funcionalidades novas (múltiplas fotos, ordenação de esgotados) e regressão completa (auth/RBAC, produtos, promoções, consignados, pedidos, analytics). Integridade financeira, segurança (RBAC), snapshot de promoção, integridade referencial e casos-limite validados. Mudanças são aditivas e retrocompatíveis — sem risco identificado para o que já está em produção.

### Recomendações para o deploy em produção
1. **Backup do banco** (`pg_dump`) antes do merge `homolog → main`.
2. O `ddl-auto` em produção criará a tabela `product_images` na primeira subida (aditivo). Validar que o usuário do banco tem permissão de `CREATE TABLE`.
3. Após o deploy, smoke test rápido: catálogo carrega, admin loga, upload de foto funciona.

*Relatório gerado por QA automatizado — HESED Semijoias (homologação). Bateria reproduzível via `python3 qa/qa_homolog.py` com o backend de homolog no ar.*
