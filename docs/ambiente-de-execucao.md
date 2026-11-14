# Ambiente de execução (contexto para o agente Codex)

Este arquivo complementa o Prompt Mestre com fatos do ambiente onde o código está sendo construído.

## Repositório
- Caminho local: /workspace/zetta-estetica (git, branch main). GitHub: AdilsonZetta/zetta-estetica (privado).
- O orquestrador humano/agente faz commit e push depois de cada prompt. **Não rode `git commit`/`git push`.** Não reescreva histórico.
- Documentação e textos de interface em **pt-BR**.
- Especificação completa: `docs/spec/prompts-codex.md` (Prompt Mestre + Prompts 00–15) e `docs/spec/documento-mestre.txt` (documento mestre de 46 páginas: arquitetura, papéis, modelo de dados, invariantes, telas, Anexo A catálogo, Anexo B estados e métricas, Anexo C roteiro de homologação). Leia as seções relevantes antes de cada etapa.
- Snapshot da documentação pública da FLW (pesquisada em 14/11/2026): `docs/spec/flw/` (llms.txt, páginas .md e respostas `ask_*.md`). Conclusão: a doc pública da FLW cita API (rotas como GET /v2/panel, GET /v2/cards, PUT /v3/panel/card/{id}, GET /v1/panels/{panelId}/lost-reasons, envio de mensagem, sequências via API, carteirização/distribuição via API), webhooks com filtros, integrações Make/n8n, app Pagamentos (Asaas), mas **não** documenta URL base pública, autenticação/token, ícone de app externo no menu, iframe nem SSO.

## Sem conta FLW
- Não existe conta nem credencial FLW de homologação. Todo o adaptador FLW roda em **modo simulação** claramente marcado, com `CAPABILITY_NOT_VERIFIED` para operações não comprovadas, vínculos e tarefas manuais. Fixtures de simulação devem ser explicitamente marcadas (`simulated: true`, pasta `fixtures/simulacao`).
- Liste em docs cada passo que exige teste humano numa conta FLW real.

## Backend Supabase
- O projeto Supabase hospedado **ainda não existe** (limite de projetos gratuitos da organização). Tudo precisa funcionar e ser testado LOCALMENTE e ser portável para o Supabase hospedado sem mudanças (migrations padrão em `supabase/migrations/`, funções em `supabase/functions/`, `supabase/config.toml`).
- Não há Docker. Existe uma pilha local compatível com Supabase já em execução:
  - Postgres 17.11 em `localhost:54322`, banco `zetta`, usuário `postgres` (trust). Binários: `/workspace/.pgbin/node_modules/@embedded-postgres/linux-x64/native/bin` (psql do sistema em /usr/bin/psql também funciona).
  - Papéis Supabase emulados: `anon`, `authenticated`, `service_role` (bypassrls), `authenticator`, `supabase_auth_admin`. Extensões disponíveis no schema `extensions`: `pgcrypto`, `btree_gist`, `pgtap` (1.3.3). `pg_cron` NÃO está disponível localmente: escreva a migration de cron de forma condicional (só agenda se a extensão existir) e ofereça a função de limpeza chamável.
  - Schema `auth` real criado pelo GoTrue v2.197.0 (auth.users, auth.uid(), auth.jwt(), auth.role()).
  - Schema `storage` emulado (storage.buckets, storage.objects com RLS, storage.foldername, storage.filename) criado por `scripts/local-stack/bootstrap.sql`. Não há API HTTP de Storage local: teste políticas de Storage via SQL trocando de papel (`set local role authenticated; select set_config('request.jwt.claims', ..., true)`), que é como o Storage do Supabase aplica RLS. Estruture os testes para que também rodem no Supabase real.
  - GoTrue (Auth) e PostgREST atrás de um proxy estilo Kong em `http://localhost:54321` (`/auth/v1`, `/rest/v1`, `/functions/v1` -> porta 54330 se você subir as Edge Functions localmente com Deno). Iniciar/garantir: `/workspace/.stack/start.sh`. Logs em /workspace/.stack/*.log. O GoTrue local está com autoconfirm de e-mail ligado (não há SMTP local).
  - Chaves locais (anon e service_role locais, JWT secret local) em `/workspace/.stack/local.env`. **Nunca copie esses valores para arquivos versionados.** Use `.env.local`/variáveis de ambiente (gitignored). No navegador só a chave anon/publishable.
  - Após aplicar migrations que mudem a API, recarregue o cache do PostgREST: `psql ... -c "notify pgrst, 'reload schema'"`.
  - Deno 2.9.8 em `~/.deno/bin/deno` para Edge Functions e testes de funções.
  - Node 24, npm. Playwright e Chromium podem ser instalados via npm (`npx playwright install chromium`).
- Crie e mantenha `scripts/db-reset.sh` (recria o banco `zetta` local: drop/create, bootstrap, reinicia GoTrue para migrar o auth, aplica migrations em ordem, seed) e scripts de teste (`npm run test:db` para pgTAP, `npm run test:api` para testes com sessões reais via supabase-js contra localhost:54321, `npm run test:concurrency`, `npm run test:e2e`).
- Usuários de teste: crie via API Admin do GoTrue local (service key local) ou SQL de seed. Senha de todos os usuários demo: `Demo@123456`. E-mails `@example.com`.
- O e-mail `grupozettaoficial@gmail.com` deve ser promovido automaticamente a admin da plataforma Zetta ao se cadastrar (tabela privada de e-mails admin + trigger em auth.users), sem criar conta nem senha para ele.

## Frontend
- Stack: React 19 + TypeScript + Vite + Tailwind v4 + supabase-js + react-router-dom (mesma base do projeto irmão `/workspace/guia-local`, consulte `package.json`, `vite.config.ts`, `src/index.css`, `src/components/ui`).
- Deploy no GitHub Pages: `base: '/zetta-estetica/'`, BrowserRouter com basename `import.meta.env.BASE_URL`, `404.html` como fallback SPA (workflow `.github/workflows/deploy.yml` igual ao do guia-local, com `VITE_SUPABASE_URL` em vars e `VITE_SUPABASE_ANON_KEY` em secrets). Sem backend configurado, a UI deve mostrar uma tela clara "Backend não configurado" em vez de quebrar.
- Lint com oxlint. Typecheck com `tsc -b`.

## Design (obrigatório em todas as telas, inclusive login)
- Fundo branco com "orbes" escuros, suaves e bem desfocados (blur grande, opacidade baixa), mais uma textura sutil de grade/ruído. **Sem** gradientes coloridos tipo mesh. **Sem** hero com foto lavada.
- Cartões de vidro fosco (~78% de preenchimento branco, backdrop-blur, borda fina clara, sombra suave).
- Paleta monocromática (pretos/cinzas) com **um único** acento (use o lima `#cfff04` como no guia-local, com texto preto sobre ele).
- Tipografia: **Inter Tight 600** para títulos, **Inter** para corpo (Google Fonts).
- Movimento leve; respeitar `prefers-reduced-motion` e `prefers-reduced-transparency`.
- Referência: https://lp.pierre.finance/lp/converse, porém com fundo branco. Reaproveite tokens/efeitos de `/workspace/guia-local/src/index.css`.
- Interface responsiva (desktop e mobile), acessível (labels, foco visível, contraste), estados de carregando/vazio/erro em todas as listas.
