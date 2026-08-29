# Contexto da Sessão — HESED Semijoias

**Data:** 29/08/2026  
**Status:** 🟢 NO AR EM PRODUÇÃO — http://103.199.184.97

---

## 🚀 DEPLOY REALIZADO (29/08/2026)

- **VPS Hostinger:** KVM 1, Ubuntu 24.04 + Docker, IP `103.199.184.97`
- **Acesso SSH:** `ssh root@103.199.184.97` (chave ed25519 `hesed-vps-deploy`)
- **Projeto:** clonado em `/root/Hesed_Semijoias`
- **Containers rodando:** postgres (healthy), backend (healthy), frontend, nginx
- **Testes pós-deploy:** frontend 200, API catálogo 200 (16 produtos), login admin 200 ✅

### Correções feitas durante o deploy:
- Removido `COPY .mvn` do Dockerfile backend (pasta não existia)
- `ddl-auto: validate` → `update` em prod (banco novo precisava criar schema)

### ⚠️ PENDÊNCIAS DE SEGURANÇA (fazer com urgência):
1. **Trocar senha do admin** (`admin123` é padrão) — logar e alterar
2. **Rotacionar/remover JWT secret antigo** do `application.yml` (vazou no GitHub)
3. **Configurar domínio + SSL (HTTPS)** — hoje só HTTP no IP
4. **Restringir portas** 5432 e 8080 (hoje expostas publicamente — deixar só 80/443)

### Segredos de produção (guardados no `.env` do VPS, permissão 600):
- Estão APENAS no servidor, NÃO commitados. Ver `/root/Hesed_Semijoias/.env`

---

## Status anterior (28/08): Pronto para deploy em produção

---

## O que foi feito nesta sessão

### 1. QA Completo (31/31 testes PASS)
- Autenticação (4 testes) ✅
- Produtos API (5 testes) ✅
- Promoções API (6 testes) ✅
- Revendedoras API (4 testes) ✅
- Segurança/RBAC (5 testes) ✅
- Frontend Build (2 testes) ✅
- Frontend Pages (5 testes) ✅

### 2. Bugs Corrigidos
- **Lombok 1.18.34 → 1.18.46** (compatibilidade JDK 26)
- **Query JPQL `lower(bytea)`** → adicionado `CAST(:search AS string)` em `ConsigneeRepository` e `ProductRepository`
- **SecurityConfig `/error`** → adicionado `permitAll()` para evitar 403 em exceptions
- **CORS** → agora dinâmico via `app.cors.allowed-origins` (env var)

### 3. Infraestrutura de Produção Criada
- `backend/Dockerfile` (multi-stage, JDK 21 Alpine, non-root)
- `frontend/Dockerfile` (Node build + Nginx)
- `docker-compose.yml` (PostgreSQL + backend + frontend + Nginx reverse proxy)
- `nginx/nginx.conf` (reverse proxy, rate limiting login, security headers)
- `backend/src/main/resources/application-prod.yml` (configs externalizadas)
- `.env.example` (template de variáveis)
- `backend/railway.toml` + `frontend/railway.toml` (alternativa Railway)
- `DEPLOY.md` (guia completo Hostinger, Railway, DigitalOcean)

---

## Próximo Passo: Deploy na Hostinger

### O que falta fazer:
1. **Comprar VPS Hostinger** — plano KVM 1 (~R$25-40/mês), template Docker
2. **Docker Manager** → "Compose from URL" → `https://github.com/HenriqueAraujo1903/Hesed_Semijoias`
3. **Configurar variáveis de ambiente:**
   ```
   DB_PASSWORD=<gerar com: openssl rand -base64 32>
   JWT_SECRET=<gerar com: openssl rand -base64 64>
   CORS_ALLOWED_ORIGINS=https://seudominio.com.br
   UPLOAD_BASE_URL=https://seudominio.com.br/uploads
   ```
4. **Deploy** (botão no Docker Manager)
5. **Domínio** — vincular DNS (registro A → IP do VPS)
6. **SSL** — Certbot para HTTPS

### Guia detalhado:
Ver `DEPLOY.md` no repositório (Opção 1: Hostinger).

---

## Repositório

- **GitHub:** https://github.com/HenriqueAraujo1903/Hesed_Semijoias
- **Branch:** main
- **Último commit:** `c1cc694` — "docs: guia deploy Hostinger VPS + Docker Manager"

---

## Stack

- **Backend:** Java 21 + Spring Boot 3.3.2 + PostgreSQL 16
- **Frontend:** React 18 + TypeScript + Vite 5.4 + Tailwind CSS
- **Infra:** Docker + Nginx reverse proxy
- **Runtime dev:** JDK 26 (Homebrew), Node 20

---

## Credenciais Dev (NÃO usar em produção)

- Admin: `admin@hesed.com` / `admin123`
- Operador: `operator@hesed.com` / `operador123`
- DB: PostgreSQL local sem senha (trust auth)
- JWT Secret: hardcoded no `application.yml` (TROCAR em prod!)
