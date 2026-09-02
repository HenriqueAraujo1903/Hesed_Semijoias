# Contexto da Sessão — HESED Semijoias

**Última atualização:** 02/09/2026
**Status:** 🟢 Em produção e estável. Leva de SEGURANÇA (cookie HttpOnly + correções red team) entregue em produção. Próximo: definir a próxima melhoria na `dev`.

---

## 🎯 Retomar amanhã

- Trabalhar na branch **`dev`** (working tree limpo).
- As 3 branches (`dev`, `homolog`, `main`) e a produção estão TODAS no mesmo commit: **`da798ef`**.
- Fluxo de sempre: `dev` → validar local → `dev → homolog` → QA → `homolog → main` (deploy prod, com backup antes).

### Subir ambiente local
- Backend dev: `/opt/homebrew/opt/openjdk/bin/java -jar target/hesed-api-0.1.0.jar` (porta 8080, banco `hesed_db`). Admin: `admin@hesed.com` / `admin123`.
- Frontend dev: `npm run dev` na pasta frontend (porta 5173).
- Backend homolog: `... -jar target/hesed-api-0.1.0.jar --spring.profiles.active=homolog` (8081, banco `hesed_homolog`). Admin: `admin@homolog.com` / `homolog123`.
- Frontend homolog: `VITE_PROXY_TARGET=http://localhost:8081 VITE_DEV_PORT=5174 npm run dev` (5174).
- Java: `/opt/homebrew/opt/openjdk/bin/java`. Maven: `mvn`. ImageMagick disponível (`magick`).

---

## 📦 O que foi feito nesta sessão (01–02/09) — leva de SEGURANÇA

Origem: análise de segurança (red team) apontou 8 achados. Todos corrigidos, testados (1011 casos em homolog) e já em PRODUÇÃO.

### Migração de autenticação: localStorage → cookie HttpOnly
- Token JWT agora vive em cookie `HttpOnly; SameSite=Strict; Secure` (Secure só em prod/HTTPS — `app.cookie.secure`, default true no perfil prod, false em dev/homolog local HTTP).
- Login NÃO retorna mais o token no body (só dados do usuário). Novos endpoints `POST /api/auth/logout` (limpa cookie) e `GET /api/auth/me` (valida sessão).
- `JwtAuthFilter` lê cookie `jwt` (prioridade) OU header `Authorization: Bearer` (retrocompat de scripts/QA). Corrigido bug: cai para header mesmo havendo outros cookies.
- Frontend: `api.ts` com `withCredentials:true`, sem interceptor de Authorization; `AuthContext` sem token no estado, valida sessão via `/auth/me` na montagem, `logout()` chama backend. Estado `loading` no AuthContext/ProtectedRoute/App evita "tela piscando" (loop de redirect). O interceptor NÃO redireciona em `/auth/me`|`/auth/login`|`/login`.
- CSRF: protegido por `SameSite=Strict` (sem token CSRF separado).

### Correções dos 8 achados do red team
1. **Vazamento de custo (catálogo público):** novo `PublicProductResponse` (id, sku, name, description, category, imagens, salePrice, stockStatus). Custo/estoque/fornecedor só na visão admin. `GET /api/products` e `/catalog` = público enxuto; admin usa `GET /api/admin/products` (novo, ProductResponse completo).
2. **Custo no pedido público:** `OrderResponse.fromPublic()` zera costPrice no retorno de `POST /api/orders`.
3. **SSRF no import CSV:** `CsvImportService` valida URL de verdade (HTTPS + host EXATO docs.google.com + path /spreadsheets/, sem redirect, timeout), mensagens de erro genéricas (não vaza host interno).
4. **Upload/XSS:** `FileStorageService` valida MAGIC BYTES reais (JPEG/PNG/WebP); extensão derivada do tipo detectado (ignora a do cliente). Bloqueia .html/.svg disfarçado.
5. **RBAC consignados:** `/api/consignees/**` agora exige `ROLE_ADMIN` (SecurityConfig).
6. **Segredo JWT:** fallback hardcoded do `application.yml` trocado por valor obviamente dev-only; prod sem fallback (`${JWT_SECRET}`).
7. **Rate limiting login:** `LoginRateLimitFilter` — 20 tentativas/min por IP no `/api/auth/login` → 429.
8. **Bug JwtAuthFilter:** corrigido (item da migração acima).

Também no Nginx (`nginx/nginx.conf`): `server_tokens off`, `Content-Security-Policy` (self + Google Fonts + placehold.co + GA), `proxy_cookie_flags` reforçando atributos do cookie.

### QA (1011 casos, 0 falhas em homolog)
- `qa/qa_homolog.py` (398): geral/regressão + suíte K de varredura densa. Parametrizável por env `QA_BASE`/`QA_ADMIN_EMAIL`/`QA_ADMIN_PASS`. Usa CookieJar + flag `no_cookie` para testes RBAC.
- `qa/qa_estoque_dev.py` (262): estoque + suíte 5 de varredura densa (status derivado 9x10, garantia, valores, SKU, nomes).
- `qa/qa_seguranca.py` (311, NOVO): valida os 8 achados com muitas variações (SSRF ~90 URLs, upload magic bytes, RBAC, cookie/header, rate limit, métodos/rotas).
- 40 testes unitários JUnit (inclui `JwtAuthFilterTest` — usa JwtService REAL, não @Mock, por causa de bug do Byte Buddy no JDK 26).
- **ATENÇÃO ao rodar QA:** o rate limit é por IP; suítes que fazem muitos logins (A, J, seguranca) estouram 20/min. Rodar as suítes ESPAÇADAS (~65s entre elas) senão o login inicial da próxima falha com 429.

### Commits desta sessão (todos em produção)
`e2e00ad` (migração cookie) → `7c80972` (correções red team) → `da798ef` (bateria QA 1011). Deploy prod feito de `da798ef`.

---

## Estado atual das branches

| Branch | Commit | Situação |
|--------|--------|----------|
| `main` (produção) | `da798ef` | No ar em https://hesedsemijoias.online |
| `dev` | `da798ef` | Sincronizada (trabalhar aqui) |
| `homolog` | `da798ef` | Sincronizada |

Rollback do último deploy: `git checkout 3944336` + rebuild no VPS. Backup do banco: `/root/Hesed_Semijoias/backups/prod_pre_seguranca_20260902_000143.sql`.

**IMPORTANTE pós-deploy:** a mudança de localStorage→cookie invalidou todas as sessões abertas antes do deploy. Todos (Henrique, Su) precisam logar de novo — comportamento esperado, ocorre uma única vez.

---

## Infra de produção (VPS Hostinger)

- **SSH:** `ssh root@srv1939516.hstgr.cloud` (chave ed25519 `~/.ssh/id_ed25519`, já autorizada).
- Projeto: `/root/Hesed_Semijoias`. Docker compose v5.5.0. Profile Spring: `prod` (via `SPRING_PROFILES_ACTIVE: prod` no compose).
- Containers: `hesed-postgres` (banco `hesed_db`, user `hesed`), `hesed-backend` (8080), `hesed-frontend`, `hesed-nginx` (80/443), `hesed-certbot`. `restart: unless-stopped`.
- Domínio **hesedsemijoias.online** (HTTPS Let's Encrypt).
- `.env` de prod tem: CORS_ALLOWED_ORIGINS, DB_NAME, DB_PASSWORD, DB_USERNAME, JWT_EXPIRATION_MS, JWT_SECRET, UPLOAD_BASE_URL. (COOKIE_SECURE não está setado, mas o perfil prod default é true.)
- **Backup automático:** `/root/backup-hesed.sh` via cron, a cada 3 dias 05:00 UTC, retenção 10 dias, em `/root/backups/`.
- **Deploy:** backup pg_dump → `git pull origin main` → `docker compose up -d --build backend frontend` → `docker compose restart nginx` (obrigatório: re-resolve IPs + aplica config nova) → smoke test HTTPS.

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
- `qa/qa_homolog.py`, `qa/qa_estoque_dev.py`, `qa/qa_seguranca.py` — baterias de QA (1011 casos)
