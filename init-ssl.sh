#!/bin/sh
# ============================================================
# Bootstrap SSL para HESED Semijoias (Let's Encrypt via Certbot)
# Executar UMA VEZ no servidor, após o DNS já apontar para o VPS.
# ============================================================
set -e

DOMAIN="hesedsemijoias.online"
WWW_DOMAIN="www.hesedsemijoias.online"
EMAIL="henriquecorreadearaujo@gmail.com"

echo "==> 1. Garantindo que os volumes existem e o webroot está acessível"
docker volume create hesed_semijoias_certbot_certs >/dev/null 2>&1 || true
docker volume create hesed_semijoias_certbot_webroot >/dev/null 2>&1 || true

echo "==> 2. Emitindo certificado via Certbot (webroot)"
# O Nginx precisa estar rodando e servindo /.well-known/acme-challenge/
docker run --rm \
  -v hesed_semijoias_certbot_certs:/etc/letsencrypt \
  -v hesed_semijoias_certbot_webroot:/var/www/certbot \
  certbot/certbot:latest certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" -d "$WWW_DOMAIN" \
  --email "$EMAIL" \
  --agree-tos --no-eff-email \
  --non-interactive

echo "==> 3. Recarregando Nginx com HTTPS"
docker compose exec nginx nginx -s reload 2>/dev/null || docker compose restart nginx

echo "==> SSL configurado com sucesso!"
