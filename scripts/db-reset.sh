#!/usr/bin/env bash
# DESTRUTIVO somente no banco de desenvolvimento fixo zetta, localhost:54322.
set -euo pipefail
cd "$(dirname "$0")/.."
# Encerrar somente os serviços desta pilha que mantêm conexão no banco a recriar.
for executable in ./auth/auth ./postgrest; do
  pids=$(pgrep -f "^$executable$" || true)
  if [ -n "$pids" ]; then
    kill $pids
    for pid in $pids; do
      for attempt in {1..100}; do
        if ! kill -0 "$pid" 2>/dev/null || [[ $(ps -o stat= -p "$pid") == Z* ]]; then break; fi
        sleep 0.1
      done
      if kill -0 "$pid" 2>/dev/null && [[ $(ps -o stat= -p "$pid") != Z* ]]; then
        echo "Serviço local $pid não encerrou; reset interrompido." >&2
        exit 1
      fi
    done
  fi
done
psql -h localhost -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS zetta WITH (FORCE)'
psql -h localhost -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE zetta'
psql -h localhost -p 54322 -U postgres -d zetta -v ON_ERROR_STOP=1 -f scripts/local-stack/bootstrap.sql
bash scripts/local-stack/start.sh
for attempt in {1..30}; do
  if curl -fsS --max-time 2 http://localhost:9999/health >/dev/null; then break; fi
  sleep 1
done
for migration in supabase/migrations/*.sql; do
  psql -h localhost -p 54322 -U postgres -d zetta -v ON_ERROR_STOP=1 -f "$migration"
done
node scripts/seed-local.mjs
