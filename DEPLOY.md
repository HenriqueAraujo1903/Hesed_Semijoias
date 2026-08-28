# Deploy — HESED Semijoias

Guia para levar a aplicação para produção.

---

## Opção 1: Hostinger VPS com Docker Manager (Recomendado)

Hostinger oferece VPS com Docker Manager integrado no painel — deploy via docker-compose visual, sem precisar de SSH.  
Custo estimado: **~R$25-40/mês** (plano KVM 1).

### Pré-requisitos

- Conta na [Hostinger](https://www.hostinger.com.br)
- VPS com template Docker instalado

### Passo a Passo

#### 1. Comprar e configurar o VPS

1. Acesse [hostinger.com/docker-hosting](https://www.hostinger.com/docker-hosting)
2. Escolha o plano **KVM 1** (4GB RAM, 1 vCPU, 50GB NVMe) — suficiente para esse projeto
3. Na configuração inicial, selecione o template **Docker** (ou Ubuntu + Docker)
4. Defina senha root ou SSH key

#### 2. Acessar o Docker Manager

1. No painel Hostinger → **VPS** → **Docker Manager**
2. Clique em **"Compose from URL"**
3. Cole a URL do repositório:
   ```
   https://github.com/HenriqueAraujo1903/Hesed_Semijoias
   ```
4. O Docker Manager vai detectar o `docker-compose.yml` na raiz

#### 3. Configurar Variáveis de Ambiente

No painel do Docker Manager, configure as variáveis (ou crie um `.env` via terminal SSH):

```env
DB_NAME=hesed_db
DB_USERNAME=hesed
DB_PASSWORD=<GERAR: openssl rand -base64 32>
JWT_SECRET=<GERAR: openssl rand -base64 64>
JWT_EXPIRATION_MS=86400000
CORS_ALLOWED_ORIGINS=https://seudominio.com.br
UPLOAD_BASE_URL=https://seudominio.com.br/uploads
```

**Para gerar senhas seguras** (rode no terminal do Mac ou no terminal do VPS):
```bash
# Senha do banco
openssl rand -base64 32

# JWT Secret
openssl rand -base64 64
```

#### 4. Deploy

1. Clique **Deploy** no Docker Manager
2. Aguarde ~3-5 minutos (o build do backend é o mais demorado)
3. Verifique o status dos containers no dashboard

#### 5. Configurar Domínio

1. No painel Hostinger, vincule seu domínio ao IP do VPS (DNS → Registro A)
2. Aguarde propagação DNS (até 24h, geralmente 5-30 min)

#### 6. Configurar SSL (HTTPS)

**Via SSH** (terminal do Docker Manager):
```bash
# Instalar certbot
apt install -y certbot

# Parar nginx temporariamente
docker compose stop nginx

# Gerar certificado
certbot certonly --standalone -d seudominio.com.br

# Copiar certs
mkdir -p /root/Hesed_Semijoias/nginx/ssl
cp /etc/letsencrypt/live/seudominio.com.br/fullchain.pem /root/Hesed_Semijoias/nginx/ssl/
cp /etc/letsencrypt/live/seudominio.com.br/privkey.pem /root/Hesed_Semijoias/nginx/ssl/
```

Edite `nginx/nginx.conf`: descomente o bloco HTTPS e o redirect HTTP→HTTPS.  
Descomente também o volume SSL no `docker-compose.yml`.

```bash
docker compose up -d
```

#### 7. Verificar

- Frontend: `https://seudominio.com.br`
- API: `https://seudominio.com.br/api/products/catalog`
- Login: `admin@hesed.com` / `admin123`

#### 8. Renovação automática do SSL

```bash
crontab -e
# Adicionar:
0 3 1 * * certbot renew --pre-hook "cd /root/Hesed_Semijoias && docker compose stop nginx" --post-hook "cd /root/Hesed_Semijoias && cp /etc/letsencrypt/live/seudominio.com.br/*.pem nginx/ssl/ && docker compose start nginx"
```

---

## Opção 2: Railway (Alternativa — deploy sem servidor)

Railway oferece deploy direto do GitHub, SSL automático e PostgreSQL incluso.  
Custo estimado: **~$5-15/mês** (plano Hobby).

### Pré-requisitos

- Conta no [Railway](https://railway.app) (login com GitHub)
- Repositório no GitHub (já feito ✅)

### Passo a Passo

#### 1. Criar projeto no Railway

1. Acesse [railway.app/new](https://railway.app/new)
2. Clique em **"Deploy from GitHub repo"**
3. Selecione o repositório `Hesed_Semijoias`

#### 2. Adicionar PostgreSQL

1. No dashboard do projeto, clique **"+ New"** → **"Database"** → **"PostgreSQL"**
2. O Railway cria automaticamente a variável `DATABASE_URL`

#### 3. Deploy do Backend

1. No projeto, clique **"+ New"** → **"GitHub Repo"** → selecione `Hesed_Semijoias`
2. Em **Settings**:
   - **Root Directory**: `backend`
   - **Build Command**: `mvn clean package -DskipTests`
   - **Start Command**: `java -jar -Dserver.port=$PORT -Dspring.profiles.active=prod target/hesed-api-0.1.0.jar`
3. Em **Variables**, adicione:
   ```
   DB_HOST=<host do PostgreSQL Railway — pegar em "Connect">
   DB_PORT=<porta — geralmente 5432>
   DB_NAME=railway
   DB_USERNAME=postgres
   DB_PASSWORD=<password gerado pelo Railway>
   JWT_SECRET=<gerar com: openssl rand -base64 64>
   JWT_EXPIRATION_MS=86400000
   CORS_ALLOWED_ORIGINS=https://SEU-FRONTEND.up.railway.app
   UPLOAD_BASE_URL=https://SEU-BACKEND.up.railway.app/uploads
   UPLOAD_DIR=/app/uploads
   ```
   
   **Dica**: Railway oferece variáveis de referência. Se adicionou o PostgreSQL no mesmo projeto, pode usar:
   ```
   DB_HOST=${{Postgres.PGHOST}}
   DB_PORT=${{Postgres.PGPORT}}
   DB_NAME=${{Postgres.PGDATABASE}}
   DB_USERNAME=${{Postgres.PGUSER}}
   DB_PASSWORD=${{Postgres.PGPASSWORD}}
   ```

4. Clique **Deploy**

#### 4. Deploy do Frontend

1. No projeto, clique **"+ New"** → **"GitHub Repo"** → selecione `Hesed_Semijoias`
2. Em **Settings**:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npx serve dist -s -l $PORT`
3. Em **Variables**, adicione:
   ```
   VITE_API_URL=https://SEU-BACKEND.up.railway.app/api
   ```
   ⚠️ **Importante**: variáveis `VITE_*` são injetadas em build-time. Após adicionar, faça redeploy.

4. Clique **Deploy**

#### 5. Configurar domínio (opcional)

1. No serviço do frontend, vá em **Settings** → **Networking** → **Generate Domain**
2. Para domínio próprio: **Custom Domain** → adicione o CNAME no seu DNS

#### 6. Verificar

- Frontend: `https://seu-frontend.up.railway.app`
- Backend health: `https://seu-backend.up.railway.app/api/products/catalog`
- Login: `admin@hesed.com` / `admin123`

---

## Opção 3: DigitalOcean Droplet (Mais controle)

Usa o `docker-compose.yml` que já criamos. Custo: **~$6-12/mês**.

### Passo a Passo

#### 1. Criar Droplet

1. Acesse [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. **Create** → **Droplets**
3. Escolha:
   - **Image**: Ubuntu 24.04
   - **Plan**: Basic $6/mês (1GB RAM, 25GB SSD)
   - **Region**: São Paulo (se disponível) ou New York
   - **Auth**: SSH Key (recomendado)

#### 2. Configurar servidor

```bash
# Conectar via SSH
ssh root@SEU_IP

# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# Criar usuário deploy
adduser deploy
usermod -aG docker deploy
su - deploy
```

#### 3. Clonar e configurar

```bash
git clone https://github.com/HenriqueAraujo1903/Hesed_Semijoias.git
cd Hesed_Semijoias

# Criar .env
cp .env.example .env
nano .env
```

Preencha o `.env`:
```
DB_NAME=hesed_db
DB_USERNAME=hesed
DB_PASSWORD=<GERAR: openssl rand -base64 32>
JWT_SECRET=<GERAR: openssl rand -base64 64>
JWT_EXPIRATION_MS=86400000
CORS_ALLOWED_ORIGINS=https://seudominio.com.br
UPLOAD_BASE_URL=https://seudominio.com.br/uploads
```

#### 4. Subir aplicação

```bash
docker compose up -d --build
```

Aguarde ~2-3 minutos. Verifique:
```bash
docker compose ps
docker compose logs backend --tail 20
```

#### 5. Configurar domínio + SSL

```bash
# Instalar Certbot
apt install -y certbot

# Parar nginx temporariamente
docker compose stop nginx

# Gerar certificado
certbot certonly --standalone -d seudominio.com.br

# Copiar certs para o projeto
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/seudominio.com.br/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/seudominio.com.br/privkey.pem nginx/ssl/
```

Edite `nginx/nginx.conf`: descomente o bloco HTTPS e o redirect HTTP→HTTPS.

```bash
# Reiniciar
docker compose up -d
```

#### 6. Renovação automática do SSL

```bash
# Adicionar ao crontab
crontab -e
# Adicionar linha:
0 3 1 * * certbot renew --pre-hook "docker compose -f /home/deploy/Hesed_Semijoias/docker-compose.yml stop nginx" --post-hook "docker compose -f /home/deploy/Hesed_Semijoias/docker-compose.yml start nginx"
```

---

## Opção 4: VPS Genérico (Contabo, Vultr, etc.)

Mesmos passos da Opção 2, mas em provedores mais baratos (~$4-8/mês).  
A diferença é só onde comprar o servidor.

---

## Pós-deploy: Checklist

- [ ] Testar login admin
- [ ] Testar catálogo público
- [ ] Testar criação de produto
- [ ] Verificar upload de imagem
- [ ] Testar em mobile
- [ ] Alterar senha padrão do admin
- [ ] Rotacionar JWT_SECRET (o antigo vazou no GitHub)
- [ ] Configurar backup do banco (pg_dump via cron)

---

## Comandos Úteis (docker-compose)

```bash
# Ver logs
docker compose logs -f backend

# Reiniciar serviço
docker compose restart backend

# Rebuild após mudanças
docker compose up -d --build backend

# Backup do banco
docker compose exec postgres pg_dump -U hesed hesed_db > backup_$(date +%Y%m%d).sql

# Restaurar backup
cat backup.sql | docker compose exec -T postgres psql -U hesed hesed_db
```
