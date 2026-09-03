# Contexto da Sessão — HESED Semijoias

**Última atualização:** 03/09/2026
**Status:** 🟢 Em produção e estável. Última entrega em produção: **Consignação Fase 1** (lotes consignados com reserva de estoque, acerto por quantidade, fechamento com baixa/devolução + venda canal CONSIGNADO na receita + comissão por lote). Sessões anteriores entregaram: dashboards (Vendas/Engajamento/Estoque/Promoções) + filtro de período compartilhado; e a leva WhatsApp/usuários/clientes/onDemand. Próximo passo da consignação: **Fase 2 (dashboard Revendedoras)**. Continua pendente (bloqueada) a **mensagem em massa** aguardando o usuário obter o WhatsApp Business.

---

## 🎯 Retomar na próxima sessão

- Trabalhar na branch **`dev`** (working tree limpo).
- As 3 branches (`dev`, `homolog`, `main`) e a produção estão TODAS no mesmo commit: **`3c951e6`**.
- Fluxo de sempre: `dev` → validar local → `dev → homolog` → QA → `homolog → main` (deploy prod, com backup antes).
- **Padrão do usuário:** valida visualmente em dev antes de subir; aprova cada etapa; quer QA completo antes de produção.

### Próxima feature planejada: CONSIGNAÇÃO FASE 2 — Dashboard de Revendedoras
- A Fase 1 (fluxo + tela de gestão) já está em produção. A Fase 2 é o **dashboard de Revendedoras**: desempenho por revendedora (quanto levou, vendeu, devolveu, comissão apurada, líquido), ranking, período. Agora há dados reais para alimentar (entidades `Consignment`/`ConsignmentItem` com apurados no fechamento).
- Decisão de receita já tomada na Fase 1: **Opção A** — venda consignada entra na receita geral com **canal CONSIGNADO** explícito (origem visível em controles/dashboards). Não é faturamento separado.

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

### LEVA 4 — Fix do PWA / fotos quebradas (commit `c18bdf5`, em produção)
- **Sintoma:** no painel admin logado, TODAS as fotos apareciam quebradas; em guia anônima funcionavam. Servidor/dados sempre corretos (imagens 200 via HTTPS).
- **Causa raiz:** o service worker do PWA servia precache antigo — `png` estava no `globPatterns` e o SW não assumia o controle nem se atualizava (`registerType: autoUpdate` sem `skipWaiting`/`clientsClaim`).
- **Correção** (`frontend/vite.config.ts` workbox): `skipWaiting: true`, `clientsClaim: true`, `cleanupOutdatedCaches: true`; removido `png` do `globPatterns` (fotos de `/uploads` não entram no precache); `runtimeCaching` NetworkFirst para `/uploads` (imagens sempre da rede); `navigateFallbackDenylist` mantém `/api` e `/uploads` fora do fallback.
- **Efeito:** dali em diante o SW novo se instala sozinho a cada deploy — não precisa mais de unregister manual. (Na transição desta correção, quem tinha o SW velho precisou de um unregister único: F12 → Application → Service Workers → Unregister + Clear site data + hard refresh.)

### LEVA 5 — Produto sob encomenda / onDemand (commits `1d7b3ab`→`4c6fa5f`, em produção)
Produto anunciado no catálogo SEM estoque próprio (venda sob encomenda; compra-se do fornecedor quando alguém pede). Decisões do usuário: custo estimado no cadastro (Opção 1), selo no catálogo, e prazo "entrega em até X dias úteis".
- **Backend:** `Product` ganhou `onDemand` (bool, col `on_demand`, default false) e `leadTimeDays` (Integer, col `lead_time_days`). ProductRequest/ProductResponse/PublicProductResponse expõem os campos.
- **Regra de estoque:** se `onDemand`, `ProductService.applyStockAndWarranty` força `stockStatus=DISPONIVEL` (nunca ESGOTADO por qty 0). `StockService.consumeForOrder`/`restockForOrder` PULAM itens onDemand (não baixa/estorna, sem StockMovement). `ProductRepository.findLowStock` exclui onDemand (`WHERE onDemand IS NULL OR onDemand=false`) — fora do alerta de reposição.
- **Financeiro:** venda de onDemand conta na receita normalmente; margem usa o `costPrice` estimado do snapshot (`buildSnapshotItem`).
- **Frontend catálogo:** selo dourado "Sob encomenda" + "Entrega em até X dias úteis" no card e no modal; produto onDemand sempre comprável.
- **Frontend admin (AdminProductsPage):** checkbox "Produto sob encomenda" + campo "Prazo de entrega (dias úteis)"; ao marcar, os campos de quantidade/estoque somem; aviso de que o custo é estimado.

---

## 📦 CONSIGNAÇÃO FASE 1 (03/09, commits `570c5e6`→`3c951e6`, em produção)

Fluxo de lotes consignados com revendedoras. Abrir lote reserva estoque; acerto por quantidade vendida; fechar baixa os vendidos, devolve o resto, gera venda na receita (canal CONSIGNADO) e apura comissão por lote. Fase 2 (dashboard Revendedoras) fica para depois.

**Decisões do usuário:** (1) estoque fica **reservado** ao abrir (estado "reservado consignado", extensível a outras reservas no futuro — NÃO baixa direto como venda); (2) comissão **configurável por lote na tela**, com default vindo da revendedora; (3) receita **Opção A** integrada com origem CONSIGNADO explícita; (4) **quantidade por produto** no item (não é 1 peça = 1 linha); acerto por quantidade (vendido; o resto é devolvido); comissão sobre o preço de venda, com `unitSalePrice` editável por lote.

### Backend
- **`Product.reservedQuantity`** (col `reserved_quantity`, default 0): estoque reservado, fora da loja mas ainda "nosso" — não conta como disponível nem esgotado. `stockStatus` segue derivado só do `stockQuantity` (disponível). Exposto em `ProductResponse` (`reservedQuantity`).
- **`StockService`**: `reserve(productId, qty, reason)` move disponível→reservado (movimento **RESERVA**, delta negativo no disponível; rejeita reservar mais que o disponível); `releaseReservation` move reservado→disponível (movimento **LIBERACAO**, piso no reservado); `consumeReserved` baixa do reservado de vez sem voltar ao disponível (movimento **SAIDA**, venda consignada efetivada). Helper `recordMovement`.
- **`Consignment`**: `commissionRate` (snapshot 0..1 por lote) + apurados no fechamento `totalSold`/`commissionAmount`/`netAmount`. **`ConsignmentItem`**: `quantity` (levado), `soldQuantity`, `returnedQuantity`, `unitSalePrice`, snapshot `productSku`/`productName`.
- **`ConsignmentService`** `open`/`settle`/`close`/`cancel`/`findAll`/`findById`. `open` valida revendedora, define comissão (request ou da revendedora), monta itens e reserva estoque. `settle` salva quantidades vendidas sem fechar (valida vendido ≤ levado). `close` consome vendidos (`consumeReserved`), libera devolvidos (`releaseReservation`), gera venda CONSIGNADO e apura comissão = totalSold × commissionRate; só fecha ABERTO (idempotente). `cancel` libera todo o reservado.
- **`OrderService.createConsignmentSale(consigneeName, List<ConsignmentSaleItem(productId,quantity,unitPrice)>, now)`**: cria `Order` CONFIRMADO **canal CONSIGNADO** SEM tocar estoque (o estoque já saiu da reserva via `consumeReserved` — evita dupla baixa). Record interno `ConsignmentSaleItem`.
- **`ConsignmentController`** `/api/admin/consignments`: GET (list `?status`), GET/{id}, POST (open), PUT/{id}/settle, POST/{id}/close, POST/{id}/cancel. RBAC herdado de `/api/admin/**`. DTOs `ConsignmentRequest`/`ConsignmentSettleRequest`/`ConsignmentResponse`. Repo `findFiltered(status)`/`findByIdWithItems(id)` (JOIN FETCH itens+produto+consignee).

### Frontend
- **`ConsignmentsPage.tsx`** (rota `/consignacoes`, ROLE_ADMIN; menu **Consignações** com `HandshakeIcon`): lista com filtro por status (Todos/Abertos/Fechados/Cancelados); **abrir lote** (revendedora, comissão editável com default da revendedora, e **busca de produto por nome/SKU** com lista de resultados mostrando estoque disponível — substituiu o `<select>` que estourava com nomes longos; qtd + preço de venda editável por item); **acerto/fechar** (quantidade vendida por item, resumo ao vivo vendido/devolvido/comissão/líquido); cancelar.
- **Fix de layout:** selects/colunas com `min-w-0` + `truncate` e `overflow-x-hidden` no modal — nomes longos não quebram mais a tela.

### QA da Consignação
- **`StockServiceTest`** ganhou reserva/liberação/consumo + casos de borda (reservar exatamente o disponível, rejeitar qtd não positiva, `consumeReserved` com piso no reservado). Novo **`ConsignmentServiceTest`** (open reserva + comissão do request/revendedora, settle valida vendido>levado, close apura comissão/gera venda CONSIGNADO/devolve, sem vendas não gera venda, refechar 400, cancel libera). Como StockService/OrderService não são mockáveis (bug Byte Buddy/JDK), os testes usam instâncias REAIS com repos mockados e asseguram o efeito (estado do produto, Order capturado). **Total unit: 122, 0 falhas.**
- **Suíte E2E `qa_leva_config` → CG (Consignação)**, 8 cenários com invariantes de estoque validadas via SQL: reserva preserva total físico (disp+reservado); guardas (excede estoque, revendedora/lote inválido, vendido>levado); acerto parcial não mexe no estoque; fechar baixa só os vendidos (sem dupla baixa) + devolve o resto + receita CONSIGNADO +N + comissão por lote + movimentos SAIDA/LIBERACAO; refechar/recancelar/acertar-fechado 400; cancelar restaura estoque; 100% vendido / 100% devolvido; multi-produto; filtros de status. Cleanup de lotes/revendedoras/vendas CONSIGNADO de teste + leak checks.

### QA desta sessão
- **Suíte nova `qa/qa_leva_config.py`** (85 casos): usuários, mensagens (com imagem), telefone obrigatório confirmar/cancelar, preço promo no catálogo, carrossel sem esgotado, e **clientes** (CRUD, telefone válido/inválido, e-mail dup case-insensitive, busca, vínculo cliente-pedido, catálogo público inalterado). Faz cleanup próprio via API + psql (`QA_DB=hesed_homolog`).
- Última bateria completa em homolog (03/09, pós-Consignação): **1.566 casos, 0 falhas** (unit 122 + qa_leva_config 202 + qa_homolog 399 + qa_estoque_dev 262 + qa_seguranca 311 + qa_metas 270). A `qa_leva_config` cobre também **sob encomenda** e a nova suíte **CG de Consignação** (fluxo + invariantes de estoque via SQL).
- **QA de infra/PWA** (classe do bug de fotos): validado com o build servido (`npx vite preview`, SW ativo) — `sw.js` com skipWaiting/clientsClaim/cleanupOutdatedCaches/NetworkFirst; `/uploads` e `/api` fora do precache (só assets do app); assets versionados batem com o index.html; upload real 200 image/png; magic-bytes rejeita não-imagem (400). Vale repetir esse check a cada mexida em PWA/upload/nginx.
- **2 testes de regressão foram ajustados** (código de teste, não app) pela regra "telefone obrigatório confirmar E cancelar": `qa_homolog.py` (G8) e `qa_estoque_dev.py` (venda direta confirmada envia `customerPhone`).
- **Bugs reais pegos pelo QA e corrigidos:** (1) e-mail de cliente duplicado case-insensitive não era bloqueado → `CustomerService.normalizeEmail` agora faz `.toLowerCase()`.
- **ATENÇÃO ao rodar QA:** rate limit de login por IP (20/min). Rodar suítes ESPAÇADAS (~65s): `echo "cooldown"; sleep 65; QA_BASE=http://localhost:8081 python3 qa/qa_XXX.py`. `qa_metas.py`/`qa_homolog.py`/`qa_leva_config.py` já usam admin@homolog default; `qa_estoque_dev.py`/`qa_seguranca.py` precisam de `QA_ADMIN_EMAIL=admin@homolog.com QA_ADMIN_PASS=homolog123` explícitos.

---

## Estado atual das branches

| Branch | Commit | Situação |
|--------|--------|----------|
| `main` (produção) | `3c951e6` | No ar em https://hesedsemijoias.online |
| `dev` | `3c951e6` | Sincronizada (trabalhar aqui) |
| `homolog` | `3c951e6` | Sincronizada |

- **Backups de banco pré-deploy** (VPS `/root/backups/`): mais recentes `hesed_db_pre_periodfilter_20260903_191655.sql.gz` (dashboards/filtro de período) e `hesed_db_pre_consignacao_20260903_210055.sql.gz` (Consignação Fase 1). Anteriores: leva/imagem/cadastros/pwafix/sobencomenda.
- **Migração de schema (ddl-auto update, aditivo):** a Consignação adicionou `products.reserved_quantity` (default 0) e as colunas em `consignments` (`commission_rate`, `total_sold`, `commission_amount`, `net_amount`) e `consignment_items` (`quantity`, `sold_quantity`, `returned_quantity`, `unit_sale_price`, `product_sku`, `product_name`). Tabelas `consignments`/`consignment_items` já existiam (entidades antigas) e passaram a ser usadas. Schema de prod confirmado pós-deploy: 24 produtos com `reserved_quantity`, tabelas de consignação vazias. Sessões anteriores criaram `message_templates`, `customers` e colunas `users.phone`, `message_templates.image_url`, `orders.customer_id`, `products.on_demand`, `products.lead_time_days`.
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
- **Produto sob encomenda:** flag por produto — comprável no catálogo (selo "Sob encomenda" + prazo em dias úteis) sem consumir estoque nem entrar em alertas de reposição; conta na receita.
- **Configurações:** CRUD de usuários; mensagens automáticas WhatsApp (confirmado/cancelado) editáveis, com **imagem opcional** por template (link com preview no WhatsApp).
- **Visão Geral (resumo executivo):** metas mensais (receita/pedidos) com herança e trava+auditoria, progresso vs meta, KPIs, pedidos pendentes, alertas de estoque/garantia, gráfico de receita 6 meses.
- **Catálogo público:** sacola, carrossel de promoções (sem produtos esgotados), preço promocional (effectivePrice) exibido/cobrado, telemetria, modal de fotos (galeria até 5).
- **Pedidos:** registro via catálogo/WhatsApp, edição, confirmação/cancelamento (ambos exigem nome+telefone), venda direta; aviso automático via WhatsApp com template + imagem opcional.
- **Dashboards** (Vendas/Engajamento/Estoque/Promoções, todos com filtro de período compartilhado: atalhos + intervalo customizado). **Estoque** unificado (Produtos CRUD + Reposição + Garantia). **Promoções**, **Revendedoras**.
- **Consignações (Fase 1):** lotes com revendedoras — abrir reserva estoque, acerto por quantidade vendida, fechar baixa vendidos + devolve o resto ao estoque + gera venda na receita (canal CONSIGNADO) + apura comissão por lote. Comissão editável por lote. (Fase 2 = dashboard Revendedoras, pendente.)
- **Segurança:** auth por cookie HttpOnly, CSP, rate limit, uploads validados por magic bytes, catálogo sem vazar custo.

---

## Documentação do projeto

- `CONTEXTO_PROJETO.md` — stack/arquitetura base
- `DOCUMENTACAO.md` — documentação oficial
- `DEPLOY.md` — guia de deploy
- `FLUXO_TRABALHO.md` — fluxo dev/homolog/prod
- `qa/qa_homolog.py`, `qa/qa_estoque_dev.py`, `qa/qa_seguranca.py`, `qa/qa_metas.py`, `qa/qa_leva_config.py` — baterias de QA (1.566 casos)
