# HESED Semijoias — Documentação Oficial do Sistema

**Versão do documento:** 1.1
**Última atualização:** 02/09/2026
**Ambiente de produção:** https://hesedsemijoias.online

---

## 1. Visão Geral

O HESED Semijoias é um sistema de gestão para uma loja de semijoias, composto por:

- **Catálogo público** — vitrine online onde clientes navegam pelas peças, selecionam itens e enviam o pedido pelo WhatsApp.
- **Painel administrativo** — área interna (com login) para gerenciar produtos, promoções, revendedoras, pedidos e visualizar dashboards analíticos.

O fluxo central de negócio: o cliente monta um pedido no catálogo → o pedido é registrado automaticamente → a operadora negocia pelo WhatsApp → confirma ou cancela a venda no painel → os dashboards refletem as vendas confirmadas.

---

## 2. Arquitetura e Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Backend | Java 21, Spring Boot 3.3.2 (Web, Data JPA, Security, Validation) |
| Autenticação | JWT (jjwt 0.12.6), senhas com BCrypt (força 12) |
| Banco de dados | PostgreSQL 16 |
| Frontend | React 18, TypeScript, Vite 5.4, Tailwind CSS |
| Infraestrutura | Docker + Docker Compose, Nginx (reverse proxy), Let's Encrypt (HTTPS) |
| Hospedagem | VPS Hostinger (Ubuntu 24.04) |

**Estrutura de containers (produção):**
- `postgres` — banco de dados (volume persistente `postgres_data`)
- `backend` — API Spring Boot (porta interna 8080)
- `frontend` — build estático servido por Nginx
- `nginx` — reverse proxy público (portas 80/443), roteia `/api` → backend e `/` → frontend
- `certbot` — renovação automática do certificado SSL

---

## 3. Perfis de Acesso

| Perfil | Papel (role) | Acesso |
|--------|--------------|--------|
| Administrador | `ROLE_ADMIN` | Tudo: produtos, promoções, revendedoras, pedidos, venda direta, dashboards |
| Operador | `ROLE_OPERATOR` | Acesso autenticado geral, exceto áreas restritas a admin (gestão de produtos, promoções, pedidos, dashboards) |
| Cliente (catálogo) | — (público) | Catálogo, seleção de itens, envio de pedido — sem login |

Os usuários são gerenciados diretamente no banco de dados (não há tela de cadastro de usuários). Não existem credenciais padrão no sistema.

---

## 4. Funcionalidades

### 4.0 Visão Geral (`/` — tela inicial do admin)
Resumo executivo do negócio, montado em uma única chamada (`GET /api/admin/overview`):
- **Metas do mês** com barras de progresso (receita e pedidos vs. meta) e botão "Configurar".
- **KPIs do mês:** receita, pedidos confirmados, itens, ticket médio, margem e margem %.
- **Pedidos pendentes** (atalho para a central de pedidos).
- **Alertas de estoque:** itens com estoque baixo/esgotado e garantias vencidas/vencendo (atalho para a aba Estoque).
- **Totais e atalhos:** catálogo, revendedoras, dashboards.
- **Receita dos últimos 6 meses** (mini-gráfico).

**Metas mensais (configuráveis):**
- Meta de **receita** e de **pedidos** por mês (ano+mês).
- **Herança:** um mês sem meta própria herda automaticamente a última meta definida em mês anterior (marcada como "herdada" na UI).
- **Trava + auditoria:** depois de criada, a meta fica travada; alterá-la exige uma **justificativa**. Cada alteração é registrada (valores antigo/novo, justificativa, autor e data) para rastreabilidade.
- Progresso vs. meta é calculado no servidor (fonte única da verdade).

### 4.1 Catálogo Público (`/catalogo`)
- Vitrine de produtos com filtro por categoria.
- Carrossel de promoções ativas.
- Seleção de peças (sacola): expande ao adicionar um item e minimiza automaticamente para não atrapalhar a navegação.
- Envio do pedido via WhatsApp — o pedido é registrado no sistema antes de abrir o WhatsApp.
- Telemetria anônima de engajamento (visitas e seleções).

### 4.2 Produtos (Estoque)
- CRUD completo (admin): criar, editar, excluir.
- Campos: SKU (único), nome, descrição, categoria, preço de custo, preço de venda, status de estoque (DISPONIVEL/BAIXO/ESGOTADO), imagem.
- Importação via CSV e upload de imagens.
- Validações: nome mínimo 3 caracteres, SKU único, preços positivos.

### 4.3 Promoções
- CRUD completo (admin) + ativar/desativar (toggle).
- Uma promoção vincula um produto a um desconto (percentual ou preço promocional), com janela de datas opcional.
- Promoções ativas aparecem no carrossel do catálogo.

### 4.4 Revendedoras (Consignação)
- CRUD de revendedoras: nome, telefone, e-mail, taxa de comissão.

### 4.5 Pedidos
Central de gestão dos pedidos, com três status: **PENDENTE**, **CONFIRMADO**, **CANCELADO**.

- **Origem catálogo (canal WHATSAPP):** criados automaticamente quando o cliente finaliza no catálogo. Nascem PENDENTES.
- **Venda direta (canal DIRETA):** criadas manualmente pela operadora (botão "+ Novo pedido") para vendas fora do catálogo. Podem nascer já CONFIRMADAS.
- **Edição:** pedidos PENDENTES podem ter itens editados (quantidade, preço negociado), itens adicionados/removidos do estoque, e dados do cliente (nome + telefone).
- **Confirmação:** exige o nome do cliente. Ao confirmar, o pedido entra nas métricas de venda.
- **Imutabilidade:** pedidos CONFIRMADOS ou CANCELADOS não podem ser editados (garante integridade do histórico).
- **Snapshot:** cada item guarda uma cópia imutável de preço, custo, categoria e estado de promoção no momento do pedido.

### 4.6 Dashboards

**Dashboard de Vendas** (`/dashboards/vendas`)
- KPIs: receita, nº de pedidos, ticket médio, margem.
- Série temporal (dia/mês/ano), receita por categoria, top produtos.
- Split promoção vs. preço cheio.
- Taxa de conversão (pedidos confirmados / total).
- Filtros: período, granularidade, categoria, somente promoções.

**Dashboard de Engajamento do Catálogo** (`/dashboards/engajamento`)
- KPIs: visitas, visitantes únicos, seleções, pedidos, vendas.
- Funil de conversão: visitas → seleções → pedidos → vendas.
- Produtos mais desejados (selecionados) vs. vendidos — identifica peças com alto interesse e baixa conversão.
- Série temporal de visitas e seleções.

---

## 5. Referência da API

Base de produção: `https://hesedsemijoias.online`
Autenticação: header `Authorization: Bearer <token>` (obtido no login).

### Público (sem autenticação)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login (retorna token JWT) |
| GET | `/api/products/catalog` | Catálogo de produtos |
| GET | `/api/promotions` | Promoções ativas |
| POST | `/api/orders` | Registra pedido do catálogo |
| POST | `/api/catalog-events` | Telemetria (VIEW/SELECT) |

### Autenticado (qualquer usuário logado)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/products` | Lista produtos (com filtros: category, stockStatus, search) |
| GET/POST/PUT/DELETE | `/api/consignees` | Revendedoras (CRUD) |

### Admin (`ROLE_ADMIN`)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/admin/products` | Criar produto |
| PUT | `/api/admin/products/{id}` | Editar produto |
| DELETE | `/api/admin/products/{id}` | Excluir produto |
| POST | `/api/admin/products/import` | Importar produtos (CSV/URL) |
| POST | `/api/admin/products/upload` | Upload de imagem |
| GET/POST | `/api/admin/promotions` | Listar todas / criar promoção |
| PUT | `/api/admin/promotions/{id}` | Editar promoção |
| PATCH | `/api/admin/promotions/{id}/toggle` | Ativar/desativar promoção |
| DELETE | `/api/admin/promotions/{id}` | Excluir promoção |
| GET | `/api/admin/orders` | Listar pedidos (filtro: status) |
| GET | `/api/admin/orders/summary` | Contagem por status |
| POST | `/api/admin/orders` | Criar venda direta |
| PUT | `/api/admin/orders/{id}` | Editar pedido pendente |
| PATCH | `/api/admin/orders/{id}/status` | Confirmar/cancelar/reabrir |
| GET | `/api/admin/analytics/sales` | Analytics de vendas |
| GET | `/api/admin/analytics/engagement` | Analytics de engajamento |
| GET | `/api/admin/overview` | Resumo executivo da Visão Geral (KPIs do mês, meta, progresso, contagens, alertas, receita 6 meses) |
| GET | `/api/admin/goals/current` | Meta efetiva do mês corrente (com herança) |
| GET | `/api/admin/goals?year=&month=` | Meta efetiva de um mês (com herança) |
| GET | `/api/admin/goals/history` | Metas definidas (mais recente primeiro) |
| GET | `/api/admin/goals/changes?year=&month=` | Auditoria de alterações de uma meta |
| PUT | `/api/admin/goals` | Cria/atualiza meta (alteração exige `changeReason`) |

---

## 6. Modelo de Dados (principais entidades)

- **User** — usuários do painel (email, nome, senha BCrypt, role).
- **Product** — produtos do catálogo (sku, nome, categoria, preço custo/venda, status de estoque).
- **Promotion** — promoções (produto, título, desconto %, preço promo, datas, ativo).
- **Consignee** — revendedoras (nome, telefone, email, taxa de comissão).
- **Order** — pedidos (número HSD-, status, canal, total, cliente, timestamps).
- **OrderItem** — itens do pedido (snapshot: SKU, nome, categoria, preço unitário, preço efetivo, custo, quantidade, flag/desconto de promoção).
- **CatalogEvent** — eventos de engajamento anônimos (tipo VIEW/SELECT, sessão, produto).
- **MonthlyGoal** — meta mensal (ano, mês, meta de receita, meta de pedidos; único por ano+mês).
- **GoalChangeLog** — auditoria de alteração de meta (ano, mês, valores antigo/novo, justificativa, autor, data).
- **Consignment / ConsignmentItem** — estrutura de consignação (base para evolução futura).

---

## 7. Fluxo de Desenvolvimento (branches)

O projeto usa três ambientes isolados:

```
  dev  ──►  homolog  ──►  main (produção)
```

| Branch | Ambiente | Banco | Portas (local) |
|--------|----------|-------|----------------|
| `dev` | Desenvolvimento | `hesed_db` | backend 8080, frontend 5173 |
| `homolog` | Homologação | `hesed_homolog` | backend 8081, frontend 5174 |
| `main` | Produção | banco no VPS | HTTPS via Nginx |

Regras: nunca commitar direto na `main`; produção só recebe o que passou por homologação; bancos sempre separados. Detalhes em `FLUXO_TRABALHO.md`.

---

## 8. Deploy

O deploy em produção é feito no VPS via Docker Compose. Resumo do processo seguro:

1. **Backup do banco** antes de qualquer mudança (`pg_dump`).
2. Merge `homolog → main` e push.
3. No VPS: `git pull origin main` + `docker compose up -d --build backend frontend`.
4. **Reiniciar o Nginx** (`docker compose restart nginx`) para re-resolver os IPs dos containers recriados.
5. Verificar contagem de dados (deve ser idêntica ao pré-deploy) e rodar smoke test.

**Garantias de preservação de dados:**
- O banco vive em volume Docker persistente (`postgres_data`) — não é afetado pelo rebuild da aplicação.
- `ddl-auto: update` é aditivo (cria tabelas/colunas novas, nunca apaga).
- Não há seed automático de dados (o catálogo é curado pela operadora).

Guia completo de deploy (incluindo SSL e alternativas): `DEPLOY.md`.

---

## 8.1 Operação e Continuidade

**O sistema roda de forma autônoma:**
- Containers com política `restart: unless-stopped` — sobem sozinhos após falha ou reinício do VPS.
- Docker habilitado no boot do servidor.
- SSL renovado automaticamente (container `certbot`).

**Backup automático do banco:**
- Script: `/root/backup-hesed.sh` no VPS (dump comprimido + retenção).
- Agendamento (cron): a cada 3 dias, **05:00 UTC (02:00 horário de Brasília)**.
- Retenção: mantém os últimos **10 dias**; backups mais antigos são removidos automaticamente.
- Local dos backups: `/root/backups/hesed_db_auto_*.sql.gz`.
- Log: `/root/backups/backup.log`.
- Restaurar um backup:
  ```bash
  gunzip -c /root/backups/hesed_db_auto_AAAAMMDD_HHMMSS.sql.gz | \
    docker compose -f /root/Hesed_Semijoias/docker-compose.yml exec -T postgres psql -U hesed -d hesed_db
  ```

**Pontos que exigem atenção periódica do responsável:**
- Manter o pagamento do VPS (Hostinger) em dia.
- Renovar o domínio `hesedsemijoias.online` na data de vencimento anual.
- Backup automático protege contra perda de dados, mas não contra perda total do VPS — para isso, considerar snapshots do VPS na Hostinger ou cópia externa dos backups.

---

## 9. Segurança

- **Autenticação JWT** stateless; senhas com BCrypt força 12.
- **RBAC**: endpoints `/api/admin/**` exigem `ROLE_ADMIN`; catálogo e telemetria são públicos (matchers exatos).
- **HTTPS** obrigatório (Let's Encrypt, renovação automática); HTTP redireciona para HTTPS.
- **Portas do banco e do backend** não expostas à internet (só acessíveis na rede interna Docker; o Nginx intermedia tudo).
- **Segredos** (JWT, senha do banco) via variáveis de ambiente no `.env` do servidor, nunca commitados.
- **Rate limiting** no endpoint de login (Nginx).

---

## 10. Documentos Relacionados

| Arquivo | Conteúdo |
|---------|----------|
| `DEPLOY.md` | Guia passo a passo de deploy (Hostinger, Railway, DigitalOcean) |
| `FLUXO_TRABALHO.md` | Fluxo de branches dev/homolog/produção |
| `QA_REPORT.md` | Relatório de QA inicial |
| `QA_REPORT_HOMOLOG.md` | Relatório de QA de homologação (62/62 aprovado) |
| `CONTEXTO_PROJETO.md` | Contexto e histórico do projeto |

---

*Documentação oficial — HESED Semijoias*
