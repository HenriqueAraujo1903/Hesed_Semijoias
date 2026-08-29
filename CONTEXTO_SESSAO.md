# Contexto da Sessão — HESED Semijoias

**Última atualização:** 29/08/2026
**Status:** 🟢 Sistema em produção, estável e autônomo. Próximo: melhorias na `dev`.

---

## 🎯 Retomar amanhã: melhorias em DEV

- Trabalhar na branch **`dev`** (é onde estou parado, working tree limpo).
- Subir ambiente local para desenvolver:
  - Backend dev: `mvn spring-boot:run` na pasta backend (porta 8080, banco `hesed_db`)
  - Frontend dev: `npm run dev` na pasta frontend (porta 5173)
- Fluxo: desenvolver na `dev` → validar local → promover `dev → homolog` → QA → `homolog → main` (deploy prod).

---

## Estado atual das branches

| Branch | Último commit | Situação |
|--------|--------------|----------|
| `main` (produção) | `47d53ee` | No ar em https://hesedsemijoias.online |
| `dev` | `2fd669f` | Sincronizada com main (trabalho aqui) |
| `homolog` | `dbde533` | 1 commit atrás (só doc; sem impacto) |

---

## O que está EM PRODUÇÃO (funcionando)

- **Catálogo público** (sacola minimizável, carrossel de promoções, telemetria de engajamento)
- **Pedidos**: registro automático via catálogo, edição (qtd/preço/itens/cliente), confirmação, venda direta (canal DIRETA)
- **Dashboards**: Vendas (KPIs, funil, série temporal) e Engajamento (funil visitas→seleções→pedidos→vendas, desejados vs vendidos)
- **Gestão**: produtos, promoções, revendedoras
- **Dados de produção:** 10 produtos (catálogo curado pela Su), 3 usuários admin/operador. NUNCA re-semear (seed foi removido do DataInitializer).

---

## Infra de produção (VPS Hostinger — 103.199.184.97)

- Acesso: `ssh root@103.199.184.97` (chave ed25519 já configurada)
- Domínio: **hesedsemijoias.online** (HTTPS Let's Encrypt, válido até 27/11/2026)
- Containers Docker: postgres, backend, frontend, nginx, certbot — todos com `restart: unless-stopped`
- **Roda sozinho**: restart automático, SSL auto-renova, Docker inicia no boot
- **Backup automático**: `/root/backup-hesed.sh` via cron — a cada 3 dias às 05:00 UTC (02:00 Brasília), retenção 10 dias, em `/root/backups/`
- Deploy: `git pull origin main` + `docker compose up -d --build backend frontend` + **reiniciar nginx** (importante: nginx cacheia IPs dos containers)

### Logins de produção
- Admin Henrique: `henriquecorreadearaujo@gmail.com` / `Pai912510!`
- Admin Su: `suhsilvarodrigues@gmail.com` / `Su!190717`
- (operador legado também existe)

---

## Ambientes locais

| Ambiente | Backend | Banco | Frontend |
|----------|---------|-------|----------|
| dev | 8080 | `hesed_db` | 5173 |
| homolog | 8081 (`--spring.profiles.active=homolog`) | `hesed_homolog` | 5174 (`VITE_PROXY_TARGET=http://localhost:8081 VITE_DEV_PORT=5174`) |
| Admin homolog | — | — | `admin@homolog.com` / `homolog123` |

Nota: Java local via `/opt/homebrew/opt/openjdk/bin/java`. JDK 26, Lombok 1.18.46.

---

## Documentação do projeto

- `DOCUMENTACAO.md` — documentação oficial (arquitetura, API, funcionalidades, deploy, operação)
- `DEPLOY.md` — guia de deploy
- `FLUXO_TRABALHO.md` — fluxo dev/homolog/prod
- `QA_REPORT.md` / `QA_REPORT_HOMOLOG.md` — relatórios de QA

---

## Stack

- Backend: Java 21 + Spring Boot 3.3.2 + PostgreSQL 16 + JWT
- Frontend: React 18 + TypeScript + Vite 5.4 + Tailwind
- Infra: Docker + Nginx + Let's Encrypt
