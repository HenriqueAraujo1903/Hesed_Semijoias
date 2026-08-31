# Contexto da Sessão — HESED Semijoias

**Última atualização:** 31/08/2026
**Status:** 🟢 Sistema em produção, estável. Leva de ESTOQUE + LOGO nova entregues em produção. Próximo: definir a próxima melhoria na `dev`.

---

## 🎯 Retomar amanhã

- Trabalhar na branch **`dev`** (working tree limpo, sincronizada com homolog e main).
- As 3 branches (`dev`, `homolog`, `main`) e a produção estão TODAS no mesmo commit: **`3944336`**.
- Fluxo de sempre: desenvolver na `dev` → validar local → `dev → homolog` → QA → `homolog → main` (deploy prod, com backup antes).

### Subir ambiente local para desenvolver
- Backend dev: `/opt/homebrew/opt/openjdk/bin/java -jar target/hesed-api-0.1.0.jar` (porta 8080, banco `hesed_db`) — ou `mvn spring-boot:run`
- Frontend dev: `npm run dev` na pasta frontend (porta 5173)
- Admin dev: `admin@hesed.com` / `admin123`

---

## 📦 O que foi feito nesta sessão (31/08)

### 1. Gestão de Estoque completa (em produção)
- **Fornecedores** (entidade dedicada): CRUD em `/api/admin/suppliers`, página admin "Fornecedores". Produto referencia fornecedor; não deixa excluir fornecedor com produto vinculado.
- **3 valores por produto:** `supplierPrice` (tabela do fornecedor), `costPrice` (o que pagamos), `salePrice` (venda). O form mostra % de acréscimo/desconto na compra e margem na venda.
- **Estoque numérico:** `stockQuantity` + `lowStockThreshold`. O `stockStatus` (DISPONIVEL/BAIXO/ESGOTADO) agora é **DERIVADO** da quantidade (0=ESGOTADO, ≤limiar=BAIXO, senão DISPONIVEL). Regra em `ProductService.deriveStockStatus`.
- **Baixa automática:** confirmar pedido dá baixa no estoque; cancelar pedido confirmado estorna; venda direta confirmada consome. Entidade `StockMovement` registra histórico (ENTRADA/SAIDA/AJUSTE/ESTORNO).
- **Garantia por produto:** `purchaseDate` + `warrantyMonths` (default 12). Vencimento calculado = purchaseDate + meses. Aba mostra 3 faixas: vencida, vencendo (60 dias), vigente.
- **Aba Estoque consolidada** (`/admin/estoque`, `StockPage.tsx`): sub-abas Produtos (CRUD, reusa `ProductsManager` do AdminProductsPage), Reposição (estoque baixo + ajuste manual), Garantia. Removidas as abas antigas "Gerenciar Produtos" e "Estoque" (ProductsPage.tsx foi deletada). Rotas `/produtos` e `/admin/produtos` redirecionam para `/admin/estoque`.
- **Retrocompat CSV/legado:** se o request traz `stockStatus` sem `stockQuantity` (import CSV), respeita o status e semeia quantidade coerente (senão tudo viraria ESGOTADO). Migração idempotente no `DataInitializer` deu quantidade inicial aos produtos existentes.
- **Bug de migração corrigido:** colunas NOT NULL novas em tabela populada exigiram `columnDefinition="integer default X"` (senão o ddl-auto falha com "column contains null values").

### 2. Logo nova (em produção)
- Trocada a logo pixelada (150x150) pela versão em alta resolução **622x658, fundo transparente** (removido o branco via ImageMagick).
- `logo-dark.png` **tratada**: atenua os reflexos branco-puro do dourado que criavam "riscos" sobre fundo escuro (login/tema escuro). Highlights estourados: 0.00000 na dark vs 0.00317 na clara.
- Componente `Logo` ganhou prop `variant` (`auto`/`light`/`dark`). Painel escuro do login força `variant="dark"`; demais telas usam `auto` (seguem o tema).
- Tamanho da logo na sidebar do admin reduzido (h-48 → h-28).

### 3. QA
- Bateria E2E: **qa/qa_homolog.py** (330 testes gerais) + **qa/qa_estoque_dev.py** (103 testes de estoque) — ambos parametrizáveis por env `QA_BASE`/`QA_ADMIN_EMAIL`/`QA_ADMIN_PASS`.
- **qa/qa_logo_assets.py** (14 checagens técnicas dos assets de logo).
- Rodadas em dev e homolog: 447 asserções, 100% aprovado. Zero regressão.

### Commits desta sessão (todos em produção)
`ad854bc` feat estoque → `73dfff6` consolida aba → `c86c1a6` fix garantia 3 faixas → `b14b32f` fix acréscimo compra → `2c57903` fix retrocompat CSV → `8010f0a` (deploy estoque) → `849ac65` logo → `3944336` QA logo (deploy logo).

---

## Estado atual das branches

| Branch | Commit | Situação |
|--------|--------|----------|
| `main` (produção) | `3944336` | No ar em https://hesedsemijoias.online |
| `dev` | `3944336` | Sincronizada (trabalhar aqui) |
| `homolog` | `3944336` | Sincronizada |

Rollback do último deploy, se necessário: `git checkout 8010f0a` + rebuild. Backups do banco em `/root/Hesed_Semijoias/backups/` no VPS (o mais recente: `prod_pre_logo_20260831_193743.sql`).

---

## Infra de produção (VPS Hostinger)

- **Acesso SSH:** `ssh root@srv1939516.hstgr.cloud` (chave ed25519 `~/.ssh/id_ed25519` = "hesed-vps-deploy", já autorizada). (IP antigo de referência: 103.199.184.97.)
- Projeto no VPS: `/root/Hesed_Semijoias`. Docker compose v5.5.0.
- Containers: `hesed-postgres` (banco `hesed_db`, user `hesed`), `hesed-backend` (8080), `hesed-frontend`, `hesed-nginx` (80/443), `hesed-certbot`. Todos `restart: unless-stopped`.
- Domínio **hesedsemijoias.online** (HTTPS Let's Encrypt).
- **Backup automático:** `/root/backup-hesed.sh` via cron, a cada 3 dias 05:00 UTC (02:00 Brasília), retenção 10 dias.
- **Deploy:** backup pg_dump → `git pull origin main` → `docker compose up -d --build frontend backend` → `docker compose restart nginx` → smoke test HTTPS. (Nginx precisa reiniciar para re-resolver IPs dos containers recriados.)

### Logins de produção
- Admin Henrique: `henriquecorreadearaujo@gmail.com` / `Pai912510!`
- Admin Su: `suhsilvarodrigues@gmail.com` / `Su!190717`

---

## Ambientes locais

| Ambiente | Backend | Banco | Frontend | Admin |
|----------|---------|-------|----------|-------|
| dev | 8080 | `hesed_db` | 5173 | `admin@hesed.com` / `admin123` |
| homolog | 8081 (`--spring.profiles.active=homolog`) | `hesed_homolog` | 5174 (`VITE_PROXY_TARGET=http://localhost:8081 VITE_DEV_PORT=5174`) | `admin@homolog.com` / `homolog123` |

- Java local: `/opt/homebrew/opt/openjdk/bin/java`. Maven: `mvn`. ImageMagick disponível (`magick`).
- JAR já compilado em `backend/target/hesed-api-0.1.0.jar`.
- Rodar QA: `QA_BASE=http://localhost:8080 QA_ADMIN_EMAIL=admin@hesed.com QA_ADMIN_PASS=admin123 python3 qa/qa_homolog.py` (e `qa_estoque_dev.py`). Limpar resíduo QA do banco depois (SKUs `QA-`/`EST-`, pedidos `HSD-QA%`, fornecedores com "QA"/"Fornecedor").

---

## Stack

- Backend: Java 21 + Spring Boot 3.3.2 + PostgreSQL 16 + JWT
- Frontend: React 18 + TypeScript + Vite 5.4 + Tailwind + PWA
- Infra: Docker + Nginx + Let's Encrypt

---

## Documentação do projeto

- `DOCUMENTACAO.md` — documentação oficial (arquitetura, API, funcionalidades, deploy, operação)
- `DEPLOY.md` — guia de deploy
- `FLUXO_TRABALHO.md` — fluxo dev/homolog/prod
- `QA_REPORT.md` / `QA_REPORT_HOMOLOG.md` — relatórios de QA
- `qa/qa_homolog.py`, `qa/qa_estoque_dev.py`, `qa/qa_logo_assets.py` — baterias de QA automatizadas
