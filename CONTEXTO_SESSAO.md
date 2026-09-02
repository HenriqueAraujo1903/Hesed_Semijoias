# Contexto da Sessão — HESED Semijoias

**Última atualização:** 02/09/2026
**Status:** 🟢 Em produção e estável. Nesta sessão foram entregues 3 levas em produção (leva WhatsApp/usuários/cancelamento/preço-promo/carrossel → imagem opcional nas mensagens → cadastro de clientes/aba Cadastros). Próximo grande passo aguarda o usuário obter o **WhatsApp Business** para o envio de mensagem em massa (promoção).

---

## 🎯 Retomar na próxima sessão

- Trabalhar na branch **`dev`** (working tree limpo).
- As 3 branches (`dev`, `homolog`, `main`) e a produção estão TODAS no mesmo commit: **`f9f2af1`**.
- Fluxo de sempre: `dev` → validar local → `dev → homolog` → QA → `homolog → main` (deploy prod, com backup antes).
- **Padrão do usuário:** valida visualmente em dev antes de subir; aprova cada etapa; quer QA completo antes de produção.

### Próxima feature planejada: MENSAGEM EM MASSA (broadcast de promoção)
- **Bloqueada** até o usuário ter conta **WhatsApp Business / Meta Cloud API**. O `wa.me` (usado hoje) NÃO faz envio em massa (abriria 1 aba por cliente) — decidido esperar a API oficial.
- Quando tiver a conta, o usuário precisa fornecer: Phone Number ID, WhatsApp Business Account ID, token de acesso (permanente) e templates aprovados pela Meta.
- **A base já está pronta:** cadastro de clientes (entidade `Customer`) alimenta a lista de destinatários. Falta plugar a Cloud API e uma tela de disparo.
- Decisão em aberto p/ quando retomar: cadastro de clientes vai alimentar só fluxos internos (é o atual) ou também capturar telefone no catálogo público. Hoje é **Opção 1** (catálogo público inalterado, não pede telefone).

### Subir ambiente local
- Backend dev: `export PATH=/opt/homebrew/opt/openjdk/bin:$PATH && SPRING_PROFILES_ACTIVE=dev java -jar target/hesed-api-0.1.0.jar` (porta 8080, banco `hesed_db`). Admin: `admin@hesed.com` / `admin123`.
- Frontend dev: `npm run dev` na pasta frontend (porta 5173, proxy `/api` e `/uploads` → 8080).
- Backend homolog: `export PATH=/opt/homebrew/opt/openjdk/bin:$PATH && COOKIE_SECURE=false java -jar target/hesed-api-0.1.0.jar --spring.profiles.active=homolog` (8081, banco `hesed_homolog`). Admin: `admin@homolog.com` / `homolog123`.
- Frontend homolog: `VITE_PROXY_TARGET=http://localhost:8081 VITE_DEV_PORT=5174 npm run dev` (5174).
- Empacotar jar: `export PATH=/opt/homebrew/opt/openjdk/bin:$PATH && mvn -q package -DskipTests` (cwd backend). Rodar testes: `mvn test`.
- Java em `/opt/homebrew/opt/openjdk/bin`. Maven `mvn`. ImageMagick disponível (`magick`).

---

## 📦 O que foi feito nesta sessão (02/09) — 3 levas

### LEVA 1 — Usuários, Config/WhatsApp, Cancelamento, Preço promo, Carrossel (commits `863de74`→`ef23ef3`, já em produção)
- **CRUD de usuários do sistema** (admin): email único, senha bcrypt, papéis, autoproteção (não rebaixar/excluir a si mesmo), resposta sem hash.
- **Aba Configurações** (`SettingsPage`) com sub-abas Usuários e Mensagens.
- **Mensagens automáticas WhatsApp** (`MessageTemplate`, tabela `message_templates`, seed `ORDER_CONFIRMED`/`ORDER_CANCELLED`): editáveis em Configurações → Mensagens. Placeholders `{cliente}` `{pedido}` `{total}` `{itens}`.
- **Cancelamento ágil**: confirmar E cancelar passam pela mesma tela de edição do pedido; ambos exigem nome + telefone do cliente (usados no aviso WhatsApp).
- **Preço promocional no catálogo**: `PublicProductResponse` expõe `effectivePrice`/`onSale`/`discountPercent`; catálogo e carrinho usam o preço com desconto (bate com o pedido).
- **Carrossel sem esgotado**: `PromotionService.findActive()` filtra produto ESGOTADO no endpoint público `/api/promotions` (admin `findAll` inalterado).

### LEVA 2 — Imagem opcional nas mensagens (commit `c4635c9`/`e82dc8c`, em produção)
- `MessageTemplate` ganhou `image_url` (TEXT nullable). Request/Response expõem `imageUrl` (opcional, máx 500). `MessageTemplateService.update` normaliza vazio→null; `render()` anexa o link da imagem ao final via `appendImage`.
- Frontend `TemplateEditor` (em `SettingsPage`): upload/preview/remover imagem por template (reusa `POST /api/admin/products/upload`).
- `whatsapp.ts` `buildOrderMessage(templateBody, order, imageUrl?)` anexa o link ao final do texto — **Opção A**: o `wa.me` só leva texto; o WhatsApp gera o **preview** do link (confirmado funcionando em produção). NÃO é anexo de mídia real (isso exigiria Cloud API).

### LEVA 3 — Cadastro de Clientes + aba Cadastros (commits `c14af41`→`f9f2af1`, em produção)
- Entidade **`Customer`** (tabela `customers`): name, phone, email (único, opcional), notes. Repo `findFiltered` (busca por nome OU telefone). `CustomerService` (CRUD, e-mail duplicado, normaliza e-mail para **lowercase** — bug de case-insensitive pego no QA). `CustomerController` sob `/api/admin/customers` (RBAC herdado de `/api/admin/**`).
- **Validação de telefone mais robusta** que a do Consignee: regex `^\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}$` aceita celular formatado `(51) 98888-7777`, fixo, com/sem máscara (a regex antiga do Consignee rejeitava celular com traço).
- **Pedido vinculado ao cliente**: `Order` ganhou `@ManyToOne Customer` (coluna `customer_id`, nullable), mantendo `customerName`/`customerPhone` como **snapshot**. `AdminOrderCreateRequest` e `OrderUpdateRequest` aceitam `customerId`; `OrderService.applyCustomer()` — se vem id, busca o cliente e preenche o snapshot (texto informado sobrescreve se preenchido); sem id, usa texto solto (fluxo antigo intacto). `OrderResponse` expõe `customerId`.
- **Frontend**: `CustomersPage.tsx` (CRUD tabela+cards+modal, busca) + `CadastrosPage.tsx` com abas (Clientes/Fornecedores). Menu: item **Cadastros** (`RegistryIcon`) substituiu Fornecedores (que virou aba interna; `/admin/fornecedores` redireciona p/ `/admin/cadastros`). `OrderEditModal` ganhou seletor de cliente cadastrado que preenche nome+telefone e envia `customerId` (editar texto limpa o id).
- **Catálogo público inalterado** (não pede cliente/telefone).

### QA desta sessão
- **Suíte nova `qa/qa_leva_config.py`** (85 casos): usuários, mensagens (com imagem), telefone obrigatório confirmar/cancelar, preço promo no catálogo, carrossel sem esgotado, e **clientes** (CRUD, telefone válido/inválido, e-mail dup case-insensitive, busca, vínculo cliente-pedido, catálogo público inalterado). Faz cleanup próprio via API + psql (`QA_DB=hesed_homolog`).
- Última bateria completa em homolog: **1.425 casos, 0 falhas** (unit 98 + qa_leva_config 85 + qa_homolog 399 + qa_estoque_dev 262 + qa_seguranca 311 + qa_metas 270).
- **2 testes de regressão foram ajustados** (código de teste, não app) pela regra "telefone obrigatório confirmar E cancelar": `qa_homolog.py` (G8) e `qa_estoque_dev.py` (venda direta confirmada envia `customerPhone`).
- **Bugs reais pegos pelo QA e corrigidos:** (1) e-mail de cliente duplicado case-insensitive não era bloqueado → `CustomerService.normalizeEmail` agora faz `.toLowerCase()`.
- **ATENÇÃO ao rodar QA:** rate limit de login por IP (20/min). Rodar suítes ESPAÇADAS (~65s): `echo "cooldown"; sleep 65; QA_BASE=http://localhost:8081 python3 qa/qa_XXX.py`. `qa_metas.py`/`qa_homolog.py`/`qa_leva_config.py` já usam admin@homolog default; `qa_estoque_dev.py`/`qa_seguranca.py` precisam de `QA_ADMIN_EMAIL=admin@homolog.com QA_ADMIN_PASS=homolog123` explícitos.

---

## Estado atual das branches

| Branch | Commit | Situação |
|--------|--------|----------|
| `main` (produção) | `f9f2af1` | No ar em https://hesedsemijoias.online |
| `dev` | `f9f2af1` | Sincronizada (trabalhar aqui) |
| `homolog` | `f9f2af1` | Sincronizada |

- **Backups de banco pré-deploy** (VPS `/root/backups/`): `hesed_db_pre_leva_20260902_154709.sql.gz` (leva 1), `hesed_db_pre_imagem_20260902_163745.sql.gz` (leva 2), `hesed_db_pre_cadastros_20260902_184346.sql.gz` (leva 3).
- **Migração de schema (ddl-auto update, aditivo):** criadas ao longo da sessão as tabelas `message_templates`, `customers` e colunas `users.phone`, `message_templates.image_url`, `orders.customer_id`. Dados de produção preservados (products=24, users=3, customers=0).
- Rollback de um deploy: no VPS `git checkout <commit_anterior>` + `docker compose up -d --build`; restaurar banco pelo dump se necessário.

---

## Infra de produção (VPS Hostinger)

- **SSH:** `ssh root@103.199.184.97` (= `srv1939516.hstgr.cloud`, chave já autorizada a partir da máquina local).
- Projeto: `/root/Hesed_Semijoias`. Docker Compose. Profile Spring: `prod`.
- Containers: `hesed-postgres` (banco `hesed_db`, user `hesed`), `hesed-backend` (8080, healthy), `hesed-frontend`, `hesed-nginx` (80/443), `hesed-certbot`. `restart: unless-stopped`.
- Domínio **hesedsemijoias.online** (HTTPS Let's Encrypt).
- `.env` de prod inclui `UPLOAD_BASE_URL=https://hesedsemijoias.online/uploads` (por isso imagens/links saem com domínio público em prod; em dev/homolog saem como localhost).
- **Deploy (procedimento usado nesta sessão):** backup `pg_dump` (dentro do container postgres) → `git checkout main && git merge --ff-only homolog && git push origin main` (local) → no VPS `git pull origin main` → `docker compose up -d --build` (rodar via processo em background; o warning de "foreground" é falso positivo pois usa `-d`) → aguardar backend healthy → smoke test HTTPS (site, catálogo, endpoint admin protegido = 403, schema novo) → parar processo.
- **Cache/PWA:** o front é PWA com service worker (`registerType: autoUpdate`). Após deploy, usuário pode precisar de hard refresh / unregister do SW para ver a versão nova (aconteceu 1x nesta sessão com a Visão Geral).

### Logins de produção
- Admin Henrique: `henriquecorreadearaujo@gmail.com` / `Pai912510!`
- Admin Su: `suhsilvarodrigues@gmail.com` / `Su!190717`

---

## Stack

- Backend: Java 21 (roda em JDK local) + Spring Boot 3.3.2 + PostgreSQL 16 + JWT (cookie HttpOnly). `ddl-auto: update`.
- Frontend: React 18 + TypeScript + Vite 5.4 + Tailwind + PWA.
- Infra: Docker + Nginx (CSP, server_tokens off, rate limit login 20/min por IP) + Let's Encrypt.

---

## Funcionalidades em produção

- **Cadastros:** aba Cadastros com CRUD de **Clientes** (novo) e **Fornecedores**. Pedidos podem vincular um cliente cadastrado (preenche nome+telefone; guarda snapshot).
- **Configurações:** CRUD de usuários; mensagens automáticas WhatsApp (confirmado/cancelado) editáveis, com **imagem opcional** por template (link com preview no WhatsApp).
- **Visão Geral (resumo executivo):** metas mensais (receita/pedidos) com herança e trava+auditoria, progresso vs meta, KPIs, pedidos pendentes, alertas de estoque/garantia, gráfico de receita 6 meses.
- **Catálogo público:** sacola, carrossel de promoções (sem produtos esgotados), preço promocional (effectivePrice) exibido/cobrado, telemetria, modal de fotos (galeria até 5).
- **Pedidos:** registro via catálogo/WhatsApp, edição, confirmação/cancelamento (ambos exigem nome+telefone), venda direta; aviso automático via WhatsApp com template + imagem opcional.
- **Dashboards** (Vendas: KPIs/margem/funil/série; Engajamento). **Estoque** unificado (Produtos CRUD + Reposição + Garantia). **Promoções**, **Revendedoras**.
- **Segurança:** auth por cookie HttpOnly, CSP, rate limit, uploads validados por magic bytes, catálogo sem vazar custo.

---

## Documentação do projeto

- `CONTEXTO_PROJETO.md` — stack/arquitetura base
- `DOCUMENTACAO.md` — documentação oficial
- `DEPLOY.md` — guia de deploy
- `FLUXO_TRABALHO.md` — fluxo dev/homolog/prod
- `qa/qa_homolog.py`, `qa/qa_estoque_dev.py`, `qa/qa_seguranca.py`, `qa/qa_metas.py`, `qa/qa_leva_config.py` — baterias de QA (1.425 casos)
