# Contexto da Sessão — HESED Semijoias

**Última atualização:** 02/09/2026
**Status:** 🟢 Em produção e estável. Leva da VISÃO GERAL + METAS MENSAIS entregue em produção. Próximo: definir a próxima melhoria na `dev`.

---

## 🎯 Retomar amanhã

- Trabalhar na branch **`dev`** (working tree limpo).
- As 3 branches (`dev`, `homolog`, `main`) e a produção estão TODAS no mesmo commit: **`ad15217`**.
- Fluxo de sempre: `dev` → validar local → `dev → homolog` → QA → `homolog → main` (deploy prod, com backup antes).

### Subir ambiente local
- Backend dev: `/opt/homebrew/opt/openjdk/bin/java -jar target/hesed-api-0.1.0.jar` (porta 8080, banco `hesed_db`). Admin: `admin@hesed.com` / `admin123`.
- Frontend dev: `npm run dev` na pasta frontend (porta 5173).
- Backend homolog: `... -jar target/hesed-api-0.1.0.jar --spring.profiles.active=homolog` (8081, banco `hesed_homolog`). Admin: `admin@homolog.com` / `homolog123`.
- Frontend homolog: `VITE_PROXY_TARGET=http://localhost:8081 VITE_DEV_PORT=5174 npm run dev` (5174).
- Java: `/opt/homebrew/opt/openjdk/bin/java`. Maven: `mvn`. ImageMagick disponível (`magick`).

---

## 📦 O que foi feito nesta sessão (02/09) — leva VISÃO GERAL + METAS

Objetivo: tornar a tela "Visão Geral" (antes um placeholder) funcional, como resumo executivo com atalhos, e permitir definir metas mensais configuráveis. Tudo testado (1294 casos em homolog) e já em PRODUÇÃO.

### Metas mensais (novo)
- Entidade `MonthlyGoal` (tabela `monthly_goals`, unique `uk_goal_year_month` em `goal_year`+`goal_month`): meta de **receita** e **pedidos** por mês.
- **Herança:** se um mês não tem meta própria, herda a última meta definida em mês anterior (`MonthlyGoalRepository.findEffective` ordena por `year*12+month`). A resposta marca `inherited=true` quando herdada e `locked=false` (mês sem meta própria).
- **Trava + auditoria:** uma vez criada, a meta fica travada (`locked=true`). Alterá-la EXIGE justificativa (`changeReason`), senão retorna 400. Toda alteração real é gravada em `GoalChangeLog` (tabela `goal_change_logs`): valores antigo/novo de receita e pedidos, `reason`, `changedBy` (id do usuário) e timestamp.
- Endpoints (`GoalController`, `/api/admin/goals`, ROLE_ADMIN):
  - `GET /current` — meta efetiva do mês corrente (com herança)
  - `GET ?year=&month=` — meta efetiva de um mês (com herança)
  - `GET /history` — metas definidas (mais recente primeiro)
  - `GET /changes?year=&month=` — histórico de alterações (auditoria) de um mês
  - `PUT` — upsert; criação livre, alteração exige `changeReason`
- `GoalService.upsert` usa `sameAmount()` (compara `BigDecimal` por VALOR com `compareTo`, ignorando escala) — evita log de auditoria espúrio ao re-salvar `2000` vs `2000.00`.

### Visão Geral / Overview (novo)
- Endpoint agregador `GET /api/admin/overview` (`OverviewController`/`OverviewService`, ROLE_ADMIN) monta em UMA chamada: `month_kpis` (receita, pedidos, itens, ticket, margem, margem%), `goal` (meta resolvida), `progress` (revenuePercent/ordersPercent, `null` se sem meta), `orders` (pendente/confirmado/cancelado), `counts` (products/consignees), `alerts` (lowStock/warrantyExpired/warrantyExpiring) e `revenue6m` (série dos últimos 6 meses, sempre 6 pontos yyyy-MM em ordem crescente). Reaproveita `AnalyticsService`, `OrderService.countByStatus`, repos de produto/consignee/estoque.
- Progresso vs meta calculado no servidor (fonte única da verdade).

### Frontend
- `DashboardPage.tsx` reescrita: bloco de Metas com barras de progresso + botão engrenagem "Configurar" (modal com seletor de mês/ano, trava + campo de justificativa quando `locked`), KPIs do mês, card de pedidos pendentes (atalho), card de alertas de estoque/garantia (atalho `/admin/estoque`), atalhos/totais e mini-gráfico de receita 6 meses. Estados loading/erro.
- Extração de duplicação: `components/KpiCard.tsx` (compartilhado) e `utils/format.ts` (`BRL`, `NUM`, `formatPeriodLabel`). `SalesDashboardPage` e `EngagementDashboardPage` passaram a importar esses compartilhados (removido código duplicado; só isso mudou nesses 2 arquivos, mais um ajuste cosmético `h-full` nas barras).

### QA (1294 casos, 0 falhas em homolog)
- `qa/qa_metas.py` (270, NOVO): RBAC de metas/overview, forma/tipos/coerência do overview (contagens e alertas batem com endpoints diretos, série de 6 meses), criação/trava/auditoria, herança (mês exato, meses seguintes, ano anterior, inserção posterior), validações (ano/mês/targets), progresso vs meta. Faz cleanup via psql (anos de teste 2093–2095 + mês vigente).
- `qa/qa_homolog.py` (398), `qa/qa_estoque_dev.py` (262), `qa/qa_seguranca.py` (311) — regressão completa, 0 falhas.
- 53 testes unitários JUnit (era 40; +12 `GoalServiceTest` +1 de regressão do bug de escala).
- **ATENÇÃO ao rodar QA:** rate limit de login é por IP (20/min). Rodar as suítes ESPAÇADAS (~65s entre elas) senão o login inicial da próxima falha com 429.

### Bug encontrado e corrigido durante o QA
- Auditoria registrava alteração espúria ao re-salvar a mesma meta, porque `Objects.equals` em `BigDecimal` considera escala (`2000` ≠ `2000.00` vindo do banco com scale=2). Corrigido com `sameAmount()` (compareTo). Coberto por teste unitário + E2E.

### Commits desta sessão (todos em produção)
`1db3fee` (visão geral: resumo executivo + metas) → `9367936` (trava meta + auditoria com justificativa) → `ad15217` (fix auditoria por escala + qa_metas.py). Deploy prod feito de `ad15217` (VPS estava em `da798ef`, veio junto o `0643076` de docs).

---

## Estado atual das branches

| Branch | Commit | Situação |
|--------|--------|----------|
| `main` (produção) | `ad15217` | No ar em https://hesedsemijoias.online |
| `dev` | `ad15217` | Sincronizada (trabalhar aqui) |
| `homolog` | `ad15217` | Sincronizada |

Rollback do último deploy: `git checkout 0643076` (ou `da798ef`) + rebuild no VPS. Backup do banco pré-deploy: `/root/backups/hesed_db_predeploy_20260902_131219.sql.gz`.

**Migração de schema deste deploy:** o `ddl-auto: update` (aditivo) criou as tabelas novas `monthly_goals` e `goal_change_logs` no banco de produção. Contagem de dados pré/pós-deploy idêntica (products=24, orders=11, users=3, consignees=0, promotions=0) — nada perdido.

---

## Infra de produção (VPS Hostinger)

- **SSH:** `ssh root@103.199.184.97` (= `srv1939516.hstgr.cloud`, chave já autorizada).
- Projeto: `/root/Hesed_Semijoias`. Docker Compose. Profile Spring: `prod`.
- Containers: `hesed-postgres` (banco `hesed_db`, user `hesed`), `hesed-backend` (8080), `hesed-frontend`, `hesed-nginx` (80/443), `hesed-certbot`. `restart: unless-stopped`.
- Domínio **hesedsemijoias.online** (HTTPS Let's Encrypt).
- `.env` de prod: CORS_ALLOWED_ORIGINS, DB_NAME, DB_PASSWORD, DB_USERNAME, JWT_EXPIRATION_MS, JWT_SECRET, UPLOAD_BASE_URL. (COOKIE_SECURE não setado, mas o perfil prod default é true.)
- **Backup automático:** `/root/backup-hesed.sh` via cron, a cada 3 dias 05:00 UTC, retenção 10 dias, em `/root/backups/`.
- **Deploy:** backup pg_dump → merge `homolog→main` + push → no VPS `git pull origin main` → `docker compose up -d --build backend frontend` → `docker compose restart nginx` (obrigatório: re-resolve IPs) → smoke test HTTPS + comparar contagens de dados.

### Logins de produção
- Admin Henrique: `henriquecorreadearaujo@gmail.com` / `Pai912510!`
- Admin Su: `suhsilvarodrigues@gmail.com` / `Su!190717`

---

## Stack

- Backend: Java 21 (roda em JDK 26 local) + Spring Boot 3.3.2 + PostgreSQL 16 + JWT (cookie HttpOnly)
- Frontend: React 18 + TypeScript + Vite 5.4 + Tailwind + PWA
- Infra: Docker + Nginx (CSP, server_tokens off, rate limit login) + Let's Encrypt

---

## Funcionalidades em produção

- **Visão Geral (resumo executivo):** metas mensais (receita/pedidos) com herança e trava+auditoria, progresso vs meta, KPIs do mês, pedidos pendentes, alertas de estoque/garantia, atalhos e gráfico de receita 6 meses
- Catálogo público (sacola, carrossel de promoções, telemetria, modal de fotos com galeria até 5)
- Pedidos (registro via catálogo/WhatsApp, edição, confirmação, venda direta)
- Dashboards (Vendas: KPIs/margem/funil/série; Engajamento)
- Gestão: aba Estoque unificada (Produtos CRUD + Reposição + Garantia), Fornecedores, Promoções, Revendedoras
- Estoque numérico com status derivado, baixa automática na venda, garantia por produto, 3 valores (fornecedor/custo/venda)
- Segurança: auth por cookie HttpOnly, CSP, rate limit, uploads validados por magic bytes, catálogo sem vazar custo

---

## Documentação do projeto

- `DOCUMENTACAO.md` — documentação oficial
- `DEPLOY.md` — guia de deploy
- `FLUXO_TRABALHO.md` — fluxo dev/homolog/prod
- `qa/qa_homolog.py`, `qa/qa_estoque_dev.py`, `qa/qa_seguranca.py`, `qa/qa_metas.py` — baterias de QA (1294 casos)
