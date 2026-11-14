# Prompt 04 — Adaptador FLW por capacidades

Executado em 14/11/2026 no repositório local. Escopo exclusivo do Prompt 04. Árvore inicial limpa, conferida antes das edições; convenções AGENTS.md, README, manifests, CI, ambiente, Discovery, seções relevantes do documento mestre e relatório do Prompt 03 consultados. Sem commit/push, reset do banco, operação hospedada ou publicação. Stack existente reutilizada, sem Docker e sem duplicar serviços.

## Entrega e comportamento observado

Contrato interno Zetta v1 separado do transporte, com interfaces de contato, card, cobrança e automação. Como nenhuma capacidade FLW possui prova autenticada neste ambiente, nenhuma chamada FLW foi implementada ou executada. Operações padrão retornam `CAPABILITY_NOT_VERIFIED`, criam tarefa manual e permitem vincular identificador externo opaco após execução humana. A tela está em **Clínica → Administrar equipe → Integração FLW · modo manual**, exclusiva do admin clínico com unidade atribuída. Concluir tarefa não confirma pagamento nem altera dados operacionais de módulos futuros.

Migration aditiva cria `private.tenant_integrations`, `integration_capabilities`, `webhook_inbox`, `outbox_events`, `integration_deliveries` e `integration_manual_tasks`: tenant obrigatório, referências compostas, RLS sem acesso direto, chaves de deduplicação fixas e RPCs com EXECUTE mínimo. Schema privado não é publicado. A transação grava intenção, evento, entrega, tarefa e auditoria juntos. Grants e autoridade não dependem de slug, Auth metadata nem papel global.

Worker de até dez itens, acionado por sessão autorizada, com uma entrega por conexão, lock, lease de 30 segundos, cinco tentativas e backoff exponencial local. Revalida emissor, tenant, unidade, permissão `integrations.manage` e entitlement `core` em cada claim. Timeout de RPC de 5 s e da operação de 8 s. Resultado desconhecido e lease vencido exigem reconciliação, sem retry automático; replay é RPC de operador autorizado e auditada. Eventos locais ultrapassados recebem `SUPERSEDED`. Credencial expirada bloqueia a conexão. Não há scheduler ativado nem garantia de efeito externo exatamente uma vez.

A Edge propaga JWT público do usuário antes de usar service role. O serviço fica no cofre de secrets do servidor; `secret_ref` reserva referência futura a credencial FLW, sem armazenar valor. Nenhuma credencial FLW é lida enquanto o transporte estiver pendente. Logs permitidos: tenant UUID, evento, correlação, código e simulação; sem headers, tokens, conteúdo privado ou erros brutos. O webhook responde 501/`CAPABILITY_NOT_VERIFIED` sem consumir corpo ou gravar inbox. Origem, assinatura e vínculo da conta FLW ainda não foram comprovados; não há endpoint de ingresso público habilitado.

Fichas de teste registram conta/escopo/limites/amostra redigidos, URL documental, prova opaca, capability, resultado, responsável e data. Registrar ficha, inclusive `passed`, não habilita capacidade. Testes automatizados usam ficha sintética bloqueada dentro de rollback. Não há ficha de homologação real nesta etapa. Fixture `fixtures/simulacao/flw.ts` contém `simulated: true`; o sucesso da simulação não é sucesso FLW.

## Arquivos alterados/criados

| Arquivos | Alteração |
| --- | --- |
| `supabase/migrations/202611140009_flw_adapter.sql` | Tabelas privadas, permissões, evidência, RPCs manuais, outbox, worker e replay |
| `supabase/functions/flw-adapter/{contract,transport,handler,index}.ts` | Portas Zetta, transporte sintético, contexto autorizado, timeouts e worker em lote |
| `supabase/functions/flw-webhook/{handler,index}.ts` | Recusa explícita enquanto origem/conta forem pendentes |
| `fixtures/simulacao/flw.ts` | Fixture marcada, sem referência a conta real |
| `src/integrations.tsx`, `src/main.tsx` | Registro/conclusão de tarefa manual na unidade ativa, estados de carregando/vazio/erro |
| `src/database.types.ts` | Tipos públicos regenerados localmente; nenhum schema privado publicado |
| `supabase/tests/flw.sql` | 39 assertivas pgTAP adicionais |
| `supabase/functions/flw-adapter/handler.test.ts` | 13 testes Deno adicionais, incluindo falhas/roteamento/logs |
| `tests/flw-api.test.mjs`, `tests/flw-concurrency.test.mjs` | Sessões reais, isolamento, tarefa/vínculo, 12 solicitações e 12 claims concorrentes |
| `tests/e2e/flw.spec.ts`, `playwright.config.ts` | Fluxo manual em desktop e Android emulado, mantendo projetos anteriores |
| `package.json` | Inclusão das novas suítes nos comandos existentes |
| `.env.example`, `README.md`, `supabase/functions/README.md`, `docs/flw-adapter.md`, este relatório | Configuração sem valores secretos, contrato, limites e homologação |

Nenhuma dependência de aplicação adicionada; package-lock e workflow preservados. Prettier 3.6.2 usado por npx para formatar arquivos novos. Tipos gerados mantêm formato do gerador existente para evitar alterações alheias.

## Comandos executados e resultados reais

| Comando/verificação | Resultado |
| --- | --- |
| `pwd`, `git status --short`, `rg --files`, leituras `cat/sed/rg`, `git diff` | Convenções/ambiente/etapa anterior inspecionados; árvore inicial limpa |
| `psql -X -h localhost -p 54322 -U postgres -d zetta -v ON_ERROR_STOP=1 -1 -f supabase/migrations/202611140009_flw_adapter.sql` | Migration aplicada incrementalmente apenas no banco local; correções de funções e ficha aplicadas localmente, incorporadas ao arquivo final |
| `psql ... -c "notify pgrst, 'reload schema'"` | API local recarregada |
| `npm run db:types` | Passou; tipos públicos gerados; aviso conhecido de futura depreciação de `--db-url` |
| `npm run test:db` | **238/238**: 199 anteriores + 39 novas; inclui políticas Storage SQL/RLS anteriores |
| `npm run test:api` | **42/42**, sem skips: 36 anteriores + seis resultados novos (grupo e cinco subtestes); Auth/PostgREST reais com sessões públicas |
| `npm run test:concurrency` | **4/4**: três anteriores + deduplicação e limite da conexão sob disputa de 12 chamadas |
| `npm test` | **11/11** anteriores preservados |
| `npm run test:edge` | **21/21**: oito anteriores + 13 novos, transportes controlados, sem chamadas FLW |
| `deno check supabase/functions/flw-adapter/index.ts supabase/functions/flw-webhook/index.ts supabase/functions/invitation-delivery/index.ts` | Passou nos três entrypoints |
| `npm run build` | Passou TypeScript/Vite e fallback SPA |
| `npm run lint` | Passou sem warnings |
| `npx playwright test tests/e2e/flw.spec.ts` | **2/2**, desktop e Android emulado, antes da execução final |
| `npm run test:e2e` | **68/68**, sem skips; 66 anteriores + dois novos, quatro projetos desktop/mobile |
| Smoke SQL transacional da migration completa | Passou: recriação integral das seis tabelas/funções novas em transação de teste, seguida de **ROLLBACK**; sem reset nem perda dos dados existentes |
| Inspeção automatizada de arquivos alterados/novos e `dist/assets` | Sem service role/JWT secret locais; comparados no processo Node sem imprimir valores |
| `git diff --check` e revisão do diff | Passou; nenhum segredo/endpoint FLW habilitado |

Testes API usam somente sessão de usuário nas verificações. As suítes anteriores usam service role para preparar identidades sintéticas; os novos testes não precisam criar identidades. O worker é validado no PostgreSQL real por pgTAP/concorrência sob papel `service_role`, com claims de serviço, sem usar essa chave para verificações de acesso de usuário. Deno valida handler/roteamento com transportes controlados; não equivale a gateway Edge hospedado ou resposta real de fornecedor. Fixtures de eventos/tarefas são removidas pelos testes; pgTAP executa rollback. Conexão/capacidades pendentes criadas pelo uso dos testes podem permanecer sem conta/credencial, sem representar homologação.

Falhas intermediárias reais: pgTAP encontrou ambiguidade PL/pgSQL de `operation` no alvo ON CONFLICT e depois de `capability` na ficha de evidência. Corrigidas respectivamente com alvo sem conflito de variável e constraint nomeada; suites SQL posteriores passaram integralmente. Nenhuma falha foi contada como aprovação. Playwright emitiu apenas os avisos conhecidos de NO_COLOR/FORCE_COLOR. A suíte E2E completa foi rodada uma única vez ao final, depois dos testes afetados, e passou.

## Dependências, pendências e homologação

Dependências utilizadas: Node 24/npm, PostgreSQL 17/pgTAP, GoTrue/PostgREST/proxy locais existentes, Supabase CLI, Deno e Chromium/Playwright. Sem novas dependências de runtime. A documentação detalhada de chaves, estados, RPCs e roteiro está em [contrato FLW](../flw-adapter.md).

1. **Local:** aplicar a migration nova, recarregar PostgREST e gerar tipos. Entrar como A em Aurora e B em Horizonte, registrar tarefa e conferir referência opaca; negar conta cruzada, unidade não atribuída, revogado, anônimo e papel global sem vínculo. A UI utiliza somente chave pública/sessão. Simulação é opt-in por RPC/Edge e nunca chamada real.
2. **Projeto remoto:** antes de aplicar/publicar qualquer coisa, confirmar explicitamente projeto/ref, ambiente, URL e autorização. O ambiente informa `ijjhtfryawtjoxvprjix`, sa-east-1; não houve confirmação operacional nem ação remota nesta etapa. Não aplicar bootstrap nem seed local em hospedagem.
3. **FLW real:** obter duas contas autorizadas, contrato oficial de base/autenticação/escopos/limites/idempotência e dados sintéticos permitidos. Para cada operação, registrar ficha redigida com data/responsável e prova; comparar conta A/B, 429, expiração, interrupção, deduplicação e reconciliação. Não tratar documentação ou fixture como prova. Não realizar envio ou cobrança real sem autorização específica.
4. **Ativação futura:** somente após prova implementar transporte específico, guardar credenciais no cofre e validar vínculo único da conta no servidor. Não há chave de configuração para transformar esta simulação em produção. Registro administrativo de resultado não libera capacidade.
5. **Webhook:** ainda bloqueado. Exigir autenticação/origem formal, validação de conta derivada da conexão, janela de validade e prova de repetição/ordem antes de gravar inbox. Ordem ambígua exige consulta autorizada ao estado atual ou revisão humana. Não há consulta periódica FLW comprovada nesta etapa.
6. **Entrega/observabilidade:** publicar Edge no projeto confirmado e validar JWT/CORS/secrets, gateway HTTP, concorrência e logs por tenant/correlação. `unknown` exige reconciliação humana antes de replay autorizado; `credential_expired` exige rotação autorizada e recuperação da conexão. Transporte real e scheduler continuam pendentes.
7. **Limites anteriores preservados:** Storage HTTP local continua ausente (404 observado pela API); a aprovação é das políticas SQL, sem upload/download/streaming HTTP homologados. SMTP, SSO, iframe, instalação/retorno em duas contas FLW e dispositivos físicos permanecem pendentes. O projeto opcional WebKit/iOS não foi reexecutado nesta etapa; o bloqueio de bibliotecas registrado no Prompt 03 permanece sem nova alegação de aprovação.

## Revisão Gemini

Revisão crítica local dos sete apontamentos do modelo `gemini-4-hydrogen`, em 14/11/2026. Alterações anteriores preservadas; sem commit/push, reset, operação remota ou habilitação FLW. Correções SQL na migration **aditiva** `202611140010_flw_review.sql`, aplicada incrementalmente apenas a `zetta` em localhost:54322, com recarga do PostgREST e regeneração dos tipos públicos. A migration 009 já aplicada foi preservada.

1. **Corrigido — starvation no lote.** O worker agora consulta `flw_work_candidates(tenant,unit)` com JWT do usuário. A RPC verifica vínculo/unidade/permissão/módulo antes de retornar até dez candidatos, ordenados por `occurred_at ASC` e ID para desempate. Filtra simulação, backoff vencido, menos de cinco tentativas, autoridade atual do emissor e conexão disponível; lease ativo bloqueia novos envios nessa conexão. `sending` com lease vencido entra para o claim fazer a transição existente para `unknown`, **sem reenvio automático**. A listagem da UI mantém a ordem recente primeiro. Seleção não substitui lock/revalidação no claim: disputas podem legitimamente produzir `null`. Regressão SQL com 25 entregas inclui 12 retries futuros à frente de uma entrega antiga elegível, limite de lote, tentativas esgotadas, lease ativo/vencido e negações por tenant/unidade/anônimo. API verifica exposição e negações da nova RPC com sessões reais.
2. **Corrigido — tarefa manual no replay simulado.** Inserção condicionada a `not e.simulated`. Regressão verifica replay reconciliado e ausência de tarefa manual. Operações reais continuam no fluxo manual; não foi implementado transporte externo.
3. **Corrigido — falhas de RPC sem log.** O catch registra somente tenant, ação, código fixo e contexto disponível de evento/correlação/simulação. O contexto é preparado antes do claim e atualizado após ele; solicitação guarda a correlação validada. Falha anterior à seleção não inventa IDs. Quatro regressões Edge interrompem request, seleção, claim e finish e verificam campos disponíveis e ausência de exceção bruta, token ou headers. Falhas da porta continuam resultando em `OUTCOME_UNKNOWN`, com o log do resultado ou da falha de persistência.
4. **Corrigido — replay indevido.** Replay recusa `last_code='SUPERSEDED'` e conexão `disabled/credential_expired` antes de alterar estado ou auditar sucesso. Recuperar a conexão é pré-requisito, inclusive para outros estados de entrega; não há recuperação implícita da credencial. Testes SQL cobrem os dois bloqueios, conexão desabilitada e aceite após recuperação explícita da conexão sintética.
5. **Corrigido — rejeições assíncronas na UI.** A consulta normaliza o thenable com `Promise.resolve(...).then(...).catch(...)`, ignora cancelamento do contexto desmontado e termina em lista vazia/mensagem nas demais rejeições. Os dois submits usam catch redigido e `finally` para liberar `busy`. Ressalva ao diagnóstico: supabase-js normalmente converte falhas de fetch em `{error}`, já tratado; nem toda falha de rede rejeita a Promise como alegado. A ausência de proteção para exceções/rejeições inesperadas era real. O E2E injeta falha de rede na consulta e nos dois formulários, verifica estado final, botões liberados, recuperação com sucesso e ausência de `pageerror`; usa o cliente real, portanto não comprova separadamente todos os tipos de exceção possível.
6. **Descartado — `simulated: true` no log de resultado.** No contrato vigente, seleção exige evento simulado, claim retorna `null` para `not e.simulated` e o único transporte é a fixture explicitamente simulada. Logo toda execução que chega a esse log é uma simulação; não existe execução real erroneamente rotulada. A proposta trata de uma futura ampliação, fora desta correção. O novo log de falha usa o contexto disponível; uma futura implementação real deverá revisar seleção, claim, transporte, código `SIMULATION_ONLY` e logs em conjunto.
7. **Descartado — subconsulta de capacidades com várias integrações.** `tenant_integrations` impõe `CHECK(provider='flw')` e `UNIQUE(tenant_id,provider)`: só pode existir uma integração por tenant. A FK composta de `integration_capabilities` e sua PK `(tenant_id,integration_id,capability)` garantem no máximo uma linha por tenant/capacidade. Outro provider é recusado pelo schema atual, portanto erro 21000 não é reproduzível sem mudar previamente as invariantes. Expansão para outros fornecedores exigirá rever esse contrato.

Validação desta revisão:

| Comando | Resultado |
| --- | --- |
| `npm run build` | Passou TypeScript/Vite/fallback SPA |
| `npm run lint` | Passou sem warnings |
| `npm test` | **11/11**, anteriores preservados |
| `npm run test:db` | **251/251**, incluindo 13 novas assertivas e políticas Storage SQL/RLS |
| `npm run test:api` | **42/42**, sem skips; sessões reais, incluindo a RPC de candidatos |
| `npm run test:concurrency` | **4/4**, incluindo 12 disputas FLW |
| `npm run test:edge` | **25/25**, incluindo quatro novas regressões de falha/log |
| `deno check` nos três entrypoints Edge | Passou |
| `npm run test:e2e` (execução completa final) | **68/68**, sem skips, quatro projetos desktop/mobile |
| `git diff --check` | Passou |

A primeira execução E2E desta revisão teve **66 aprovados e dois reprovados**: o seletor novo `page.getByRole('status')` era ambíguo entre mensagens da página. Corrigido no teste para restringir a consulta à seção FLW; não foi uma falha da recuperação da aplicação. Depois disso, build, lint e **todas** as suítes foram repetidos, terminando com os **68/68 E2E** acima. Avisos restantes: depreciação conhecida de `--db-url` ao gerar tipos e `NO_COLOR/FORCE_COLOR` no Playwright. Sem falhas ou skips na execução final.

Limites de homologação permanecem os já documentados: Storage HTTP indisponível localmente (políticas SQL testadas), ausência de conta/credencial/transporte FLW real, SMTP/gateway Edge hospedado e iOS/WebKit físico não homologados. Nenhuma ação remota foi realizada; a migration 010 deverá acompanhar a 009 na aplicação futura ao projeto explicitamente confirmado.
