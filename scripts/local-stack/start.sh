#!/bin/bash
# Pilha exclusivamente local sem Docker; cadastro público desabilitado.
# Reutiliza serviços saudáveis e separa processos da sessão do terminal.
set -euo pipefail
source /workspace/.stack/env.sh
PGB=/workspace/.pgbin/node_modules/@embedded-postgres/linux-x64/native/bin
pg_isready -h localhost -p 54322 -q || $PGB/pg_ctl -D /workspace/.pg/data -o "-p 54322 -c max_connections=200" -l /workspace/.pg/log.txt start
cd /workspace/.stack
if ! curl -fsS --max-time 2 localhost:9999/health >/dev/null; then
GOTRUE_API_HOST=127.0.0.1 PORT=9999 API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:local-auth-admin@localhost:54322/zetta?sslmode=disable" \
GOTRUE_SITE_URL=http://localhost:5173 GOTRUE_URI_ALLOW_LIST="http://localhost:5173/**,http://localhost:4173/**" \
GOTRUE_JWT_SECRET=$LOCAL_JWT_SECRET GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
GOTRUE_DISABLE_SIGNUP=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_SMTP_ADMIN_EMAIL=noreply@local.test \
GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_RATE_LIMIT_VERIFY=10000 GOTRUE_RATE_LIMIT_TOKEN_REFRESH=10000 GOTRUE_RATE_LIMIT_SIGN_IN_SIGN_UPS=10000 \
GOTRUE_LOG_LEVEL=warn nohup setsid ./auth/auth > auth.log 2>&1 &
fi
if ! curl -fsS --max-time 2 localhost:3000 >/dev/null; then
PGRST_DB_URI="postgres://authenticator:local-authenticator@localhost:54322/zetta" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
PGRST_JWT_SECRET=$LOCAL_JWT_SECRET PGRST_DB_POOL=20 PGRST_SERVER_PORT=3000 PGRST_DB_CHANNEL_ENABLED=true nohup setsid ./postgrest > postgrest.log 2>&1 &
fi
if ! curl -fsS --max-time 2 localhost:54321/health >/dev/null; then nohup setsid node /workspace/.stack/proxy.mjs > proxy.log 2>&1 & fi
sleep 2; echo "stack ok"
