# Fluxo de Trabalho — HESED Semijoias

Três estágios: **dev → homolog → produção**. Nada vai para produção sem passar por homologação.

```
  dev  ──merge──►  homolog  ──merge──►  main (produção)
   │                  │                    │
 trabalho livre    baterias de teste    no ar
 + localhost       e homologação        (Su usa)
 (porta 8080)      (porta 8081)         hesedsemijoias.online
```

---

## Branches

| Branch | Propósito | Ambiente |
|--------|-----------|----------|
| `dev` | Desenvolvimento livre, validação visual/funcional | Local, porta 8080, banco `hesed_db` |
| `homolog` | Homologação e baterias de teste | Local, porta 8081, banco `hesed_homolog` |
| `main` | Produção (Su trabalhando) | VPS Hostinger, HTTPS |

---

## Ambientes locais

### DEV (padrão)
- **Backend:** porta 8080, banco `hesed_db`
- **Frontend:** porta 5173 (`npm run dev`)
- **Rodar backend:**
  ```bash
  cd backend && mvn spring-boot:run
  ```

### HOMOLOG
- **Backend:** porta 8081, banco `hesed_homolog` (isolado do dev)
- **Rodar backend:**
  ```bash
  cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=homolog
  ```
- **Frontend apontando para homolog:** criar `.env.local` no frontend com
  `VITE_API_URL=http://localhost:8081/api` e rodar `npm run dev`

---

## Fluxo passo a passo

### 1. Desenvolver (na branch dev)
```bash
git checkout dev
# ... fazer alterações ...
git add <arquivos> && git commit -m "feat: ..."
git push origin dev
```
Validar localmente (backend 8080 + frontend 5173).

### 2. Promover para homologação
```bash
git checkout homolog
git merge dev
git push origin homolog
```
Rodar backend no profile homolog (8081) e executar as baterias de teste/QA.

### 3. Promover para produção (só após homologação aprovada)
```bash
git checkout main
git merge homolog
git push origin main
```
Depois, no servidor:
```bash
ssh root@103.199.184.97
cd /root/Hesed_Semijoias && git pull origin main && docker compose up -d --build
```

---

## Regras de ouro

1. **Nunca commitar direto na `main`.** Sempre passar por dev → homolog.
2. **Produção só recebe o que foi homologado.**
3. **Bancos separados:** dev (`hesed_db`), homolog (`hesed_homolog`), produção (no VPS). Nunca compartilhados.
4. **`.env` e segredos** nunca vão para o Git.
