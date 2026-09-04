# HESED Semijoias — Documentação do Projeto

> **Arquivo único de contexto.** Toda a documentação do projeto (arquitetura, features, deploy, fluxo de trabalho, QA e contexto entre sessões) vive aqui. Não há outros arquivos de doc — se precisar de contexto, é este.
>
> **Última atualização:** 03/09/2026
> **Status:** 🟢 Em produção e estável em https://hesedsemijoias.online

---

## 1. Visão geral

Sistema de gestão para uma loja de semijoias (HESED): catálogo público com envio de pedidos por WhatsApp + painel administrativo (produtos/estoque, pedidos, promoções, revendedoras/consignação, clientes, fornecedores, metas, dashboards analíticos e configurações).

### Stack

| Camada | Tecnologia |
|---|---|
| Backend | Java 21 · Spring Boot 3.3.2 · Maven · JWT (jjwt) |
| Banco | PostgreSQL 16 · JPA/Hibernate (`ddl-auto: update`) |
| Frontend | React 18 · TypeScript 5 · Vite 5.4 · Tailwind 3.4 · PWA (vite-plugin-pwa) |
| Upload | Armazenamento local (`/app/uploads`), validado por magic bytes |
| Infra | Docker Compose · Nginx (reverse proxy + SSL) · Let's Encrypt/Certbot |
| Hospedagem | VPS Hostinger (`103.199.184.97`) |

### Autenticação (resumo)
Login por **cookie JWT HttpOnly** (`SameSite=Strict`, `Secure` em prod). O token não vai no corpo da resposta nem é guardado no frontend — o browser envia o cookie automaticamente (`axios withCredentials`). Roles: **`ROLE_ADMIN`** e **`ROLE_OPERATOR`**. Rate limit de login: **20 tentativas/60s por IP** (filtro na app) + `5r/m` no Nginx.

---

## 2. Como rodar (ambientes locais)

Java em `/opt/homebrew/opt/openjdk/bin`. Sempre exportar o PATH antes dos comandos Maven/Java:
```bash
export PATH=/opt/homebrew/opt/openjdk/bin:$PATH
```

### DEV (padrão) — porta 8080, banco `hesed_db`
```bash
# Backend
export PATH=/opt/homebrew/opt/openjdk/bin:$PATH
SPRING_PROFILES_ACTIVE=dev java -jar target/hesed-api-0.1.0.jar --server.port=8080   # (cwd: backend)
# ou: mvn spring-boot:run

# Frontend (porta 5173, proxy /api e /uploads -> 8080)
npm run dev   # (cwd: frontend)
```
Admin dev: `admin@hesed.com` / `admin123`.

### HOMOLOG — porta 8081, banco `hesed_homolog`
```bash
export PATH=/opt/homebrew/opt/openjdk/bin:$PATH
COOKIE_SECURE=false java -jar target/hesed-api-0.1.0.jar --spring.profiles.active=homolog --server.port=8081
# Frontend apontando p/ homolog:
VITE_PROXY_TARGET=http://localhost:8081 VITE_DEV_PORT=5174 npm run dev   # porta 5174
```
Admin homolog: `admin@homolog.com` / `homolog123`.

### Build / testes
```bash
export PATH=/opt/homebrew/opt/openjdk/bin:$PATH
mvn -q package -DskipTests   # empacota target/hesed-api-0.1.0.jar (cwd: backend)
mvn test                     # testes unitários
npm run build                # frontend: tsc + vite build (cwd: frontend)
```

> **Nota de runtime:** `StockService` e `OrderService` são classes concretas que o Mockito **não** consegue mockar neste JDK (bug Byte Buddy). Testes que dependem deles usam instâncias **reais** com repositórios mockados e verificam o efeito (estado do produto, `Order` capturado). O `AnalyticsService` tem **7 dependências** de repositório no construtor — ao mexer nele, atualizar os `@Mock` do `AnalyticsServiceTest`.

---

## 3. Fluxo de trabalho: dev → homolog → produção

```
  dev  ──merge ff──►  homolog  ──merge ff──►  main (produção)
   │                     │                       │
 trabalho livre       baterias QA             no ar
 localhost 8080       localhost 8081          hesedsemijoias.online
 banco hesed_db       banco hesed_homolog     VPS / banco hesed_db
```

| Branch | Propósito | Ambiente |
|--------|-----------|----------|
| `dev` | Desenvolvimento e validação visual | Local 8080, `hesed_db` |
| `homolog` | Homologação + QA completo | Local 8081, `hesed_homolog` |
| `main` | Produção | VPS Hostinger, HTTPS |

**Padrão de trabalho (preferência do dono do produto):** valida visualmente em dev antes de subir; aprova cada etapa; exige QA completo antes de produção; nunca sobe sem backup.

**Regras de ouro:** nunca commitar direto na `main`; produção só recebe o que foi homologado; bancos sempre separados; `.env`/segredos nunca no Git. As 3 branches são mantidas alinhadas no mesmo commit após cada deploy.

### Promover
```bash
git push origin dev
git checkout homolog && git merge --ff-only dev && git push origin homolog
# (rodar QA em homolog; se aprovado:)
git checkout main && git merge --ff-only homolog && git push origin main
git checkout dev
```

---

## 4. Backend (`backend/src/main/java/com/hesed`)

Entry point `HesedApplication.java`. Build `backend/pom.xml`.

### 4.1 Entidades (`models/`)
Todas com `id` UUID e timestamps (`createdAt`/`updatedAt`).

- **User** (`users`): email (unique), name, phone, password (BCrypt força 12), role (default `ROLE_OPERATOR`).
- **Product** (`products`): sku (unique), name, description, category, imageUrl (capa) + imageUrls (galeria até 5, `product_images`), supplierPrice, costPrice, salePrice, **stockQuantity** (fonte da verdade), **reservedQuantity** (consignado; fora da loja mas ainda "nosso"), **stockStatus** (derivado: 0=ESGOTADO, ≤lowStockThreshold=BAIXO, senão DISPONIVEL), lowStockThreshold (default 3), supplier (opcional), purchaseDate, warrantyMonths (default 12), **onDemand** (sob encomenda), leadTimeDays.
- **Supplier** (`suppliers`): name, phone, email, website, notes.
- **Order** (`orders`): orderNumber (unique, ex `HSD-20260903-1234`), status (PENDENTE|CONFIRMADO|CANCELADO), **channel** (WHATSAPP|DIRETA|**CONSIGNADO**), totalAmount, orderedAt, resolvedAt, customer (opcional) + customerName/customerPhone (snapshot), items. Só CONFIRMADO entra na receita.
- **OrderItem** (`order_items`): snapshot productSku/productName/productCategory, unitPrice (cheio), effectivePrice (cobrado), costPrice, quantity, wasPromotion, discountPercent.
- **Customer** (`customers`): name, phone, email (unique, opcional), notes.
- **Promotion** (`promotions`): product, title, subtitle, discountPercent, promoPrice, bannerUrl, active, startsAt, endsAt, sortOrder.
- **Consignee** (`consignees`, revendedoras): name, phone, email (unique), **commissionRate** (fração 0..1).
- **Consignment** (`consignments`, lote): consignee, status (ABERTO|FECHADO|CANCELADO), **commissionRate** (snapshot do lote), **totalSold/commissionAmount/netAmount** (apurados no fechamento), openedAt, closedAt, notes, items.
- **ConsignmentItem** (`consignment_items`): product + snapshot productSku/productName, **quantity** (levado), **soldQuantity**, **returnedQuantity**, **unitSalePrice**, returnedAt, soldAt.
- **Sale / SaleItem** (`sales`/`sale_items`): estrutura de venda direta (legado; hoje as vendas fluem por Order).
- **StockMovement** (`stock_movements`): product, type (ENTRADA|SAIDA|AJUSTE|ESTORNO|**RESERVA**|**LIBERACAO**), delta, resultingQuantity, reason, orderId. Auditoria imutável.
- **MonthlyGoal** (`monthly_goals`): year, month, revenueTarget, ordersTarget. Sem meta no mês → herda a última anterior.
- **GoalChangeLog** (`goal_change_logs`): auditoria de alteração de meta (exige justificativa + changedBy).
- **MessageTemplate** (`message_templates`): templateKey (ORDER_CONFIRMED/ORDER_CANCELLED), title, body (variáveis `{cliente}{pedido}{total}{itens}`), imageUrl (opcional), active.
- **CatalogEvent** (`catalog_events`): telemetria anônima do catálogo (type VIEW|SELECT, sessionId, snapshot do produto).

### 4.2 Endpoints (controllers)

**Público**
- `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET /api/products` · `GET /api/products/catalog` (visão pública, sem custo/estoque/fornecedor)
- `GET /api/promotions` (ativas, sem esgotados)
- `POST /api/orders` (pedido do catálogo)
- `POST /api/catalog-events` (telemetria; nunca quebra)
- `GET /uploads/**`

**Admin (`ROLE_ADMIN`)**
- **Produtos:** `GET/POST /api/admin/products`, `PUT/DELETE /api/admin/products/{id}`, `POST /api/admin/products/import` (CSV/Google Sheets), `POST /api/admin/products/upload`.
- **Pedidos:** `POST /api/admin/orders` (venda direta), `GET /api/admin/orders?status=`, `GET /api/admin/orders/summary`, `PUT /api/admin/orders/{id}`, `PATCH /api/admin/orders/{id}/status`.
- **Promoções:** `GET /api/admin/promotions`, `POST`, `PUT/{id}`, `PATCH /{id}/toggle`, `DELETE /{id}`.
- **Revendedoras:** `GET/POST /api/consignees`, `GET/PUT/DELETE /api/consignees/{id}` (RBAC ADMIN).
- **Consignação:** `GET /api/admin/consignments?status=`, `GET /{id}`, `POST` (abre lote, reserva estoque), `PUT /{id}/settle` (acerto), `POST /{id}/close` (fecha), `POST /{id}/cancel`.
- **Analytics:** `GET /api/admin/analytics/sales` (status, granularity day|month|year, from, to, category, promoOnly), `/engagement` (from,to), `/promotions` (from,to,category), `/resellers` (from,to), `/stock` (category,status,movementsFrom,movementsTo).
- **Visão geral:** `GET /api/admin/overview` (KPIs + série de receita 6 meses).
- **Metas:** `GET /api/admin/goals/current`, `GET /api/admin/goals` (year,month, com herança), `PUT` (upsert; alteração exige justificativa), `GET /history`, `GET /changes`.
- **Estoque:** `POST /api/admin/stock/{productId}/adjust` (ENTRADA soma / AJUSTE absoluto), `GET /{productId}/movements`, `GET /low`, `GET /warranty?days=`.
- **Fornecedores/Clientes/Usuários:** CRUD sob `/api/admin/suppliers`, `/api/admin/customers`, `/api/admin/users` (usuários com proteção: admin não se exclui/rebaixa, não remove o último admin).
- **Configurações:** `GET /api/admin/settings/messages`, `PUT /api/admin/settings/messages/{key}`.

### 4.3 Segurança (`config/`)
- **SecurityConfig:** stateless, CSRF off, CORS com credenciais. Público: `/api/auth/**`, GETs de `/api/products` e `/api/promotions`, `POST /api/orders`, `POST /api/catalog-events`, `/uploads/**`. `/api/admin/**` e `/api/consignees/**` = `ROLE_ADMIN`. Demais = autenticado.
- **JwtService:** HMAC, subject = userId, claims email+role, expiração `app.jwt.expiration-ms`.
- **JwtAuthFilter:** lê token do cookie HttpOnly `jwt` (prioridade) ou do header `Authorization: Bearer` (retrocompat p/ scripts QA).
- **LoginRateLimitFilter:** 20 tentativas/60s por IP no `POST /api/auth/login` (429 + Retry-After).
- **DataInitializer:** NÃO faz seed de catálogo nem de usuários. Faz backfill idempotente de `stockQuantity` (dados pré-feature de estoque) e seed dos templates ORDER_CONFIRMED/ORDER_CANCELLED.

### 4.4 Profiles (`application*.yml`)
| Profile | Porta | Banco | cookie.secure | upload base-url |
|---|---|---|---|---|
| `application.yml` (dev, default) | 8080 | `hesed_db` | false | `http://localhost:8080/uploads` |
| `application-homolog.yml` | 8081 | `hesed_homolog` | `${COOKIE_SECURE:false}` | `http://localhost:8081/uploads` |
| `application-prod.yml` | 8080 | `hesed_db` (VPS, user `hesed`) | `${COOKIE_SECURE:true}` | `${UPLOAD_BASE_URL}` |

`ddl-auto: update` em todos (migração aditiva automática). Em prod, `JWT_SECRET` e `DB_PASSWORD` são obrigatórios (sem fallback).

---

## 5. Frontend (`frontend/src`)

- **api.ts:** axios com `baseURL = VITE_API_URL || '/api'`, `withCredentials: true`. Interceptor: 401 (ou 403 em rota `/admin/`) fora de probe de auth → redireciona para `/login`.
- **AuthContext:** `useAuth` (user, isAuthenticated, isAdmin, loading, logout); verifica sessão via `/auth/me` na inicialização.
- **ProtectedRoute:** spinner enquanto carrega; sem auth → `/login`; com `requiredRole` incompatível → `/dashboard`.
- **PWA (vite.config.ts / workbox):** `skipWaiting` + `clientsClaim` + `cleanupOutdatedCaches` (SW novo assume a cada deploy). Precache só de js/css/html/ico/svg/woff2; `/uploads` e `/api` fora do fallback; `/uploads` = NetworkFirst. PWA desabilitado em dev.

### Rotas e páginas
Público: `/login`, `/catalogo` (CatalogoPage — catálogo + sacola + WhatsApp).

Protegido (dentro do `DashboardLayout`):
- `/dashboard` — Visão Geral (KPIs + série de receita).
- `/dashboards` — hub dos dashboards; e as páginas **ROLE_ADMIN**: `/dashboards/vendas`, `/engajamento`, `/estoque`, `/promocoes`, `/revendedoras`.
- `/pedidos` (ADMIN) — gestão de pedidos.
- `/revendedoras` — CRUD de revendedoras (ConsigneesPage).
- `/consignacoes` (ADMIN) — gestão de lotes de consignação.
- `/admin/promocoes`, `/admin/cadastros` (clientes+fornecedores), `/admin/estoque` (produtos+reposição+garantia), `/admin/configuracoes` (usuários+mensagens) — todas ADMIN.
- Redirects: `/produtos` e `/admin/produtos` → `/admin/estoque`; `/admin/fornecedores` → `/admin/cadastros`; `/admin/usuarios` → `/admin/configuracoes`.

Menu (DashboardLayout): Visão Geral, Dashboards, Pedidos, Estoque, Cadastros, Revendedoras, Consignações, Promoções, Configurações (itens `adminOnly` só aparecem para admin).

---

## 6. Features em produção

- **Catálogo público:** sacola, carrossel de promoções (sem esgotados), preço promocional (`effectivePrice`), telemetria anônima, galeria de fotos (até 5).
- **Pedidos:** registro via catálogo/WhatsApp, venda direta, edição, confirmar/cancelar (ambos exigem nome+telefone), aviso automático via WhatsApp com template + imagem opcional (link com preview). O aviso abre o **WhatsApp Web** (`web.whatsapp.com/send`) já com o texto preenchido para a operadora enviar com um clique (semi-automático); a aba é aberta no clique e depois apontada para a URL, para não ser bloqueada como popup após as chamadas de API.
- **Estoque numérico:** quantidade como fonte da verdade; status derivado; baixa/estorno automático no pedido; ajuste manual (entrada/absoluto) com movimentações; alerta de baixo estoque e de garantia (3 faixas).
- **Produto sob encomenda (onDemand):** comprável no catálogo (selo "Sob encomenda" + prazo em dias úteis) sem consumir estoque nem entrar em alertas de reposição; conta na receita (custo estimado).
- **Cadastros:** clientes e fornecedores; pedido pode vincular cliente (snapshot de nome/telefone).
- **Precificação de produto (cadastro):** 4 campos — Preço fornecedor, Custo pago, **% de lucro** (default 85, editável) e Venda — com cálculo em cascata no frontend: Custo pago = Preço fornecedor ÷ 2; Venda = Custo ÷ (1 − lucro%/100) (85% ⇒ custo ÷ 0,15). Todos editáveis (editar venda na mão faz o % de lucro refletir o resultado). O cálculo vive só no frontend; o backend recebe/persiste `costPrice` e `salePrice` finais (o % de lucro NÃO é persistido — é derivável de custo/venda).
- **Promoções:** CRUD + carrossel público.
- **Consignação — Fase 1:** lotes com revendedoras. Abrir **reserva** estoque (disponível→reservado, movimento RESERVA); acerto por quantidade vendida; fechar **consome** os vendidos (SAIDA, sem voltar ao disponível), **devolve** o resto (LIBERACAO), gera venda canal **CONSIGNADO** na receita (sem dupla baixa) e apura comissão = totalSold × commissionRate (editável por lote, default da revendedora); cancelar libera todo o reservado.
- **Consignação — Fase 2 (Dashboard de Revendedoras):** KPIs (total vendido, comissão paga, líquido, taxa de venda + peças consignadas/vendidas/devolvidas + consignações abertas), ranking por revendedora e tabela de consignações em aberto. KPIs/ranking consideram lotes **fechados** cujo `closedAt` caiu no período; os abertos são sempre "agora" (com valor potencial).
- **Dashboards:** Vendas, Engajamento, Estoque, Promoções, Revendedoras — todos com filtro de período compartilhado (atalhos + intervalo customizado).
- **Metas mensais:** metas de receita/pedidos com herança e trava de alteração (justificativa + auditoria); progresso na Visão Geral.
- **Configurações:** CRUD de usuários; templates de mensagem WhatsApp com imagem opcional.
- **Segurança:** cookie HttpOnly, CSP, rate limit, uploads validados por magic bytes, catálogo sem vazar custo.

**Pendente (bloqueado):** **mensagem em massa** (broadcast de promoção) — aguarda o dono obter conta **WhatsApp Business / Meta Cloud API**. O aviso atual é semi-automático (abre o WhatsApp Web com o texto pronto), não faz envio em massa. A base de destinatários (entidade `Customer`) já existe; falta plugar a Cloud API e a tela de disparo. Quando houver a conta, fornecer: Phone Number ID, WhatsApp Business Account ID, token permanente e templates aprovados pela Meta.

---

## 7. Infraestrutura e deploy

### Containers (`docker-compose.yml`)
`hesed-postgres` (16-alpine, volume `postgres_data`, não exposto) · `hesed-backend` (Spring, profile prod, volume `uploads_data`, healthcheck em `/api/products/catalog`) · `hesed-frontend` (React+Nginx interno) · `hesed-nginx` (portas 80/443, proxy + SSL) · `hesed-certbot` (renova Let's Encrypt a cada 12h).

### Nginx (`nginx/nginx.conf`)
`server_tokens off`, gzip, `client_max_body_size 10M`. HTTP→HTTPS (com ACME webroot). HSTS, X-Frame-Options, nosniff, Referrer-Policy e **CSP** restritiva. Rate limit `5r/m` no login. Proxy `/api/` e `/uploads/` → backend, `/` → frontend; força `proxy_cookie_flags jwt HttpOnly SameSite=Strict`.

### Variáveis (`.env` na VPS — ver `.env.example`)
`DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` (`openssl rand -base64 64`), `JWT_EXPIRATION_MS`, `CORS_ALLOWED_ORIGINS`, `UPLOAD_BASE_URL`. Em prod, `COOKIE_SECURE=true` (default do profile). O `.env` nunca vai para o Git.

### Procedimento de deploy (usado a cada release)
```bash
# 1. Backup do banco de produção ANTES de tudo
ssh root@103.199.184.97 'docker exec hesed-postgres sh -c "pg_dump -U \$POSTGRES_USER \$POSTGRES_DB" | gzip > /root/backups/hesed_db_pre_<feature>_$(date +%Y%m%d_%H%M%S).sql.gz'

# 2. Promover main (local): git checkout main && git merge --ff-only homolog && git push origin main

# 3. Na VPS: pull + rebuild
ssh root@103.199.184.97 'cd /root/Hesed_Semijoias && git pull origin main'
#   rebuild via processo em background:
#   cd /root/Hesed_Semijoias && docker compose up -d --build
#   (o aviso de "foreground" é falso positivo — sobe com -d)

# 4. Aguardar backend healthy e fazer smoke test HTTPS:
#    catálogo público 200, login admin 200, endpoint novo respondendo, schema migrado.
```
**Rollback:** na VPS `git checkout <commit_anterior>` + `docker compose up -d --build`; restaurar banco pelo dump se necessário. Backups em `/root/backups/`.

### Acesso e credenciais
- **SSH:** `ssh root@103.199.184.97` (= `srv1939516.hstgr.cloud`).
- **Domínio:** hesedsemijoias.online (HTTPS Let's Encrypt, renovação automática).
- **Admin produção:** `suhsilvarodrigues@gmail.com` / `Su!190717` · `henriquecorreadearaujo@gmail.com` / `Pai912510!`
- **Migração de schema:** `ddl-auto: update` aplica alterações aditivas no boot; dados preservados. Após deploy, confirmar o schema novo no banco.

---

## 8. QA (`qa/`)

Scripts Python (stdlib pura). Cada um cria e **limpa 100%** dos próprios dados ao final. Autenticam por cookie (com fallback header).

| Script | Cobre | Env (padrão) |
|---|---|---|
| `qa_homolog.py` | E2E completo + regressão (auth/RBAC, produtos, promoções, consignados, pedidos, segurança) | 8081, admin@homolog.com |
| `qa_estoque_dev.py` | Estoque: fornecedores, preços, status derivado, baixa/estorno, ajuste, garantia | 8080, admin@hesed.com |
| `qa_metas.py` | Metas mensais + Visão Geral (herança, trava/justificativa, auditoria) | 8081, admin@homolog.com |
| `qa_seguranca.py` | Red team: vazamento de custo, SSRF no import, upload por magic bytes, RBAC, rate limit | 8081, admin@homolog.com |
| `qa_leva_config.py` | Config (usuários, mensagens), clientes, catálogo/promo, **sob encomenda**, **CG (consignação)**, **RD (dashboard revendedoras)** e **EN (encoding UTF-8)** | 8081, admin@homolog.com, `QA_DB=hesed_homolog` |
| `qa_logo_assets.py` | Assets de logo via ImageMagick (resolução, transparência, integridade) | — (só arquivos locais) |

Parametrização: `QA_BASE`, `QA_ADMIN_EMAIL`, `QA_ADMIN_PASS` (e `QA_DB` no leva_config). Defaults apontam para homolog (8081), exceto `qa_estoque_dev` (dev 8080). Para rodar contra homolog, `qa_estoque_dev`/`qa_seguranca` precisam de `QA_ADMIN_EMAIL=admin@homolog.com QA_ADMIN_PASS=homolog123` explícitos.

> **⚠️ Rate limit de login (20/min por IP):** rodar as suítes **espaçadas ~65s** (`sleep 65` entre elas), senão o login passa a receber 429. A suíte de segurança faz muitos logins (teste de rate limit) — dar folga maior depois dela.

### Suíte de consignação — invariantes de estoque (via SQL, na `qa_leva_config`)
- **CG:** reserva preserva o total físico (disponível+reservado); guardas (excede estoque, revendedora/lote inválido, vendido>levado); acerto parcial não mexe no estoque; fechar baixa só os vendidos (sem dupla baixa) + devolve o resto + gera receita CONSIGNADO + comissão por lote + movimentos SAIDA/LIBERACAO; refechar/recancelar/acertar-fechado retornam 400; cancelar restaura estoque; 100% vendido / 100% devolvido; multi-produto; filtros de status.
- **RD:** coerência de KPIs/ranking/abertos, sell-through, ordenação desc, `net = total − comissão`, período futuro zera fechados mantendo abertos.
- **EN (encoding UTF-8):** regressão do bug do aviso WhatsApp. Verifica que as respostas JSON declaram `Content-Type: application/json;charset=UTF-8` e que um template com emojis (✨ 💛 🛍️ 💰 🥰) e acentos faz roundtrip idêntico pela API (salvar → reler sem corromper).

### Última bateria completa (homolog): **1.605 casos, 0 falhas**
unit 130 · qa_leva_config 233 (com CG/RD/EN) · qa_homolog 399 · qa_estoque_dev 262 · qa_seguranca 311 · qa_metas 270.

Testes unitários cobrem também o **impacto da precificação**: `OrderServiceTest` (snapshot de preço no pedido — unitPrice=venda, costPrice=custo, effectivePrice com override; venda CONSIGNADO usa o preço do lote) e `AnalyticsServiceTest.sales`/`stock` (margem = receita − custo, marginPercent; valor de estoque a custo e a venda). Como o backend só lê custo/venda finais, esses testes travam os pontos financeiros/estoque contra regressão.

**Limpeza de resíduos QA em homolog** (produtos retidos por FK de pedido são comportamento correto; para zerar antes do veredito):
```sql
-- remove pedidos que referenciam produtos QA e depois os produtos
DELETE FROM stock_movements WHERE order_id IN (SELECT DISTINCT oi.order_id FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE p.sku LIKE 'QA-%');
DELETE FROM order_items WHERE order_id IN (SELECT DISTINCT oi.order_id FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE p.sku LIKE 'QA-%');
DELETE FROM orders WHERE id IN (SELECT DISTINCT oi.order_id FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE p.sku LIKE 'QA-%');
DELETE FROM stock_movements WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QA-%');
DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE sku LIKE 'QA-%');
DELETE FROM products WHERE sku LIKE 'QA-%';
```

---

## 9. Estado atual e histórico

### Branches (todas alinhadas)
| Branch | Commit | Situação |
|--------|--------|----------|
| `main` (produção) | `bdc8fc9` | No ar em https://hesedsemijoias.online |
| `dev` | sincronizada | Trabalhar aqui |
| `homolog` | sincronizada | — |

> As 3 branches estão alinhadas em `bdc8fc9`. Últimas levas: marketing do catálogo (`baf3033`), correção do aviso WhatsApp (`3410bee`/`d8c4fd7`) e campo % de lucro no cadastro (`4ea9444`/`bdc8fc9`).

### Leva de catálogo/marketing (`baf3033`)
- Garantia **6 meses → 1 ano** no catálogo.
- Hero com diferenciais (Não escurece · Antialérgica · Garantia de 1 ano); rodapé com acabamentos (Ouro 18K, Prata 1000 e Ródio).
- Ícone do WhatsApp no link "Atendimento via WhatsApp".

### Correção do aviso WhatsApp — emojis quebrados + popup (`3410bee` + `d8c4fd7`)
Dois bugs no aviso automático de confirmação/cancelamento de pedido:
1. **Popup bloqueado:** `window.open` era chamado após os `await` das chamadas de API, fora do gesto de clique → o navegador bloqueava a aba. Correção: abrir a aba **no clique** e só depois apontá-la para a URL (via `sendWhatsAppViaWindow` recebendo o handle da janela).
2. **Emojis viravam `�`:** duas causas somadas — (a) a API respondia `application/json` **sem** `charset=UTF-8` e, com `nosniff` no Nginx, o navegador quebrava multi-byte → corrigido no `WebConfig` (`extendMessageConverters` força UTF-8 no JSON e no texto); (b) o **`wa.me`** no desktop macOS faz handoff para o app nativo e **corrompe emojis** (4 bytes → `�`) → trocado para **`web.whatsapp.com/send`** (WhatsApp Web), que preserva o UTF-8. Regressão coberta pela suíte **EN** do `qa_leva_config`.

### Campo % de lucro no cadastro de produto (`4ea9444` + `bdc8fc9`)
Novo campo **% de lucro** (default 85, editável) no formulário de produto, entre Custo pago e Venda. Cálculo em cascata no frontend: Custo pago = Preço fornecedor ÷ 2; Venda = Custo ÷ (1 − lucro%/100) (85% ⇒ custo ÷ 0,15, ou seja o custo é 15% da venda). Todos os campos editáveis; editar a Venda na mão faz o % de lucro refletir o resultado real. **Só frontend** — o backend recebe/persiste `costPrice` e `salePrice` finais como antes (o % de lucro não é persistido). Testes de impacto (margem, valor de estoque, snapshot de preço) adicionados em `OrderServiceTest`/`AnalyticsServiceTest`.

### Padrões técnicos aprendidos (evitar retrabalho)
- **PostgreSQL + JPQL:** o Postgres não infere o tipo de parâmetro `null` (agrava com JOIN FETCH + Pageable). Normalizar datas no service: `from` → `2000-01-01`, `to` → `now()+1ano`. Padrão repetido em todos os métodos do `AnalyticsService`.
- **`List.of(new Object[]{...})`** com um único array vira `List<Object>` → usar `List.<Object[]>of(...)`.
- **Mockito/JDK:** `StockService`/`OrderService` não são mockáveis (Byte Buddy) — usar instâncias reais com repos mockados.
- **PWA:** ao mexer em PWA/upload/nginx, revalidar o service worker (skipWaiting/clientsClaim) servindo o build (`npx vite preview`), pois SW velho já causou "fotos quebradas" no painel.
- **Encoding UTF-8:** respostas HTTP devem declarar `charset=UTF-8` (feito no `WebConfig`); e o aviso ao cliente usa `web.whatsapp.com/send`, não `wa.me` (este corrompe emojis no handoff pro app nativo no desktop).

### Migrações de schema aplicadas (aditivas, via `ddl-auto: update`)
`products.reserved_quantity`, `products.on_demand`, `products.lead_time_days`; `consignments`(`commission_rate`,`total_sold`,`commission_amount`,`net_amount`); `consignment_items`(`quantity`,`sold_quantity`,`returned_quantity`,`unit_sale_price`,`product_sku`,`product_name`); `orders.customer_id`; `users.phone`; `message_templates`(+`image_url`); tabelas `customers`, `catalog_events`, `monthly_goals`, `goal_change_logs`. A Fase 2 (dashboard) **não** alterou schema.

### Backups de produção (`/root/backups/` na VPS)
Mais recentes: `hesed_db_pre_catalogomkt_...` (marketing/fix WhatsApp), `hesed_db_pre_wafix_...` (fix WhatsApp) e `hesed_db_pre_perclucro_20260904_230544.sql.gz` (campo % de lucro). As levas de catálogo, a correção do WhatsApp e o campo % de lucro **não** alteraram schema.

### Próxima feature planejada
**Mensagem em massa (WhatsApp Business/Meta Cloud API)** — bloqueada até o dono obter a conta (ver seção 6). Decisão em aberto: manter o cadastro de clientes só para fluxos internos (atual) ou também capturar telefone no catálogo público (hoje o catálogo não pede telefone).
