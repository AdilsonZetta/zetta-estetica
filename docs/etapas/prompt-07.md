# Prompt 07 — Agenda e reservas transacionais

Implementação local do Prompt 07 sobre o catálogo do Prompt 06. Sem operação no projeto hospedado e sem chamada FLW. A migration nova aplica uma vez depois de `202611140001`–`202611140013`.

## Entrega

**Clínica → Agenda** (`/clinicas/:slug/agenda`) mostra grade por dia e por semana, profissionais, salas e equipamentos, reserva temporária, confirmação, check-in, reagendamento, cancelamento, falta, bloqueio rígido e lista de espera. A interface não escreve nas tabelas: só chama RPC. Conflito explica o recurso e o intervalo e oferece outros inícios do dia.

A ocupação ativa é `tstzrange [)` com os buffers da versão, restrita por exclusão GiST em `(tenant_id, resource_id)`. O profissional é o mesmo UUID em todas as unidades. Bloqueio rígido usa a mesma restrição. Holds vencidos são liberados sob lock na RPC de escrita. `pg_cron` só é agendado se a extensão existir; localmente ela não existe e `private.expire_agenda_holds_job` continua chamável.

Transições que liberam a vaga: expiração do hold, cancelamento e falta. Confirmado e check-in mantêm a vaga. Reagendamento inválido não altera horário, versão nem alocação. Encaixe aceito passa por `agenda_reserve`. Eventos operacionais entram em `private.agenda_outbox` na mesma transação, com tarefa manual `CAPABILITY_NOT_VERIFIED` quando o cliente precisaria ser avisado. Não há endpoint FLW inventado.

O teste de catálogo que reutilizava `membership_id` foi corrigido no teste: o índice único `catalog_resource_member` permanece.

## Arquivos

| Arquivo | Conteúdo |
| --- | --- |
| `supabase/migrations/202611140014_agenda.sql` | Tabelas privadas, exclusão GiST, RLS, RPCs, outbox, idempotência e cron condicional |
| `supabase/tests/agenda.sql` | 50 assertivas pgTAP |
| `tests/agenda-concurrency.test.mjs` | Duas sessões `psql` simultâneas na mesma vaga |
| `tests/catalog-api.test.mjs` | Vínculo histórico usa outro membership |
| `src/agenda.tsx`, `src/main.tsx`, `src/style.css` | Grade, reserva, fila, bloqueio e navegação |
| `src/database.types.ts` | Tipos públicos regenerados |
| `supabase/seed.sql` | Mariana · exemplo, 16/11/2026 10h, nas duas clínicas |
| `tests/e2e/agenda.spec.ts`, `playwright.config.ts` | Spec da grade; não executado nesta máquina |
| `docs/agenda.md`, `README.md` | Contrato e ponteiro da migration |

## Comandos e resultados

Ambiente desta execução: PostgreSQL 16.15 com pgTAP 1.3.2, sem GoTrue, PostgREST, Deno nem a pilha em `/workspace/.stack`. A migration usa SQL compatível com o Postgres 17 hospedado e foi aplicada também num banco vazio, depois de 0001–0013.

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Passou, sem warnings |
| `npm run build` | Passou (`tsc -b`, Vite e fallback SPA) |
| `npm test` | **13/13** |
| `npm run test:db` | **384/384** (334 anteriores + 50 de `supabase/tests/agenda.sql`) |
| `node --test tests/agenda-concurrency.test.mjs` | Passou duas vezes seguidas. Uma sessão confirma; a outra recebe conflito (`23P01` / “Conflito de reserva”). Estado final: 1 agendamento `confirmed`, 3 reservas ocupando (profissional, sala e equipamento) e 1 agendamento distinto no profissional |
| Aplicação limpa de `supabase/migrations/*.sql` num banco novo | Passou, inclusive `202611140014_agenda.sql` |
| `supabase/seed.sql` duas vezes | Segunda execução não duplica o horário de exemplo |
| `npm run test:api`, `npm run test:concurrency` completo, `npm run test:edge`, `npm run test:e2e` | Não executados. Faltam GoTrue, PostgREST e Deno. O spec `tests/e2e/agenda.spec.ts` fica no repositório para a pilha local |

A concorrência observada serializa o recurso com lock de transação e a exclusão GiST. A chamada perdedora não grava a segunda ocupação.

## Homologação

1. Confirmar o projeto antes de qualquer operação remota. Aplicar só `supabase/migrations/202611140014_agenda.sql` depois que 0001–0013 já estiverem no banco. Não reaplicar: `CREATE TABLE` e `CREATE FUNCTION` falham na segunda vez. Não aplicar bootstrap nem seed no hospedado.
2. Conferir `btree_gist` (já criado pela 0013) e, se o plano tiver `pg_cron`, o job `zetta-expire-agenda-holds`. Sem cron, chamar `expire_agenda_holds` ou deixar as RPCs expirarem os holds.
3. Entrar como `a@example.com` / Aurora e `b@example.com` / Horizonte. Abrir Agenda, reservar a avaliação de exemplo dentro da jornada, confirmar, fazer check-in, reagendar para um horário livre e tentar um horário ocupado. O original deve permanecer se o novo conflitar.
4. Profissional consulta a grade e não reserva. Tenant cruzado, módulo agenda desligado e escrita direta nas tabelas continuam negados.
5. FLW segue simulada. Confirmação, falta, cancelamento e reagendamento de confirmado abrem tarefa manual. Nada dispara mensagem.

## Riscos em aberto

- E2E desktop/mobile e a suíte HTTP com sessão GoTrue não rodaram aqui. O spec está escrito; a prova visual fica para a pilha local.
- `pg_cron` não foi executado de fato. A limpeza foi provada pela RPC e pelo teste de hold vencido.
- A jornada do catálogo já impede turnos sobrepostos do mesmo recurso. O conflito entre unidades foi provado com bloqueio numa unidade ocupando o profissional na outra.
- Capacidade do recurso não permite várias reservas simultâneas da mesma identidade.
- Avisos ao cliente dependem de tarefa manual até existir conta e contrato FLW comprovados.
