# Prompt 06 — Catálogo, profissionais e recursos

Implementação local do Prompt 06, em 14/11/2026. Árvore inicial limpa; AGENTS.md, ambiente, README, manifests/lockfile, CI, especificação e relatório/revisão do Prompt 05 conferidos. Sem commit/push, reset do banco, operações remotas ou chamadas FLW. Nenhuma dependência de runtime ou variável de ambiente adicionada.

## Entrega

**Clínica → Catálogo** (`/clinicas/:slug/catalogo`) reúne publicação de serviços, histórico, profissionais elegíveis, recursos, jornadas e consulta de disponibilidade configurada. Interface em pt-BR, responsiva, com os tokens existentes de vidro/monocromático/lima, labels, estados de carregamento/vazio/erro e prévia de preço, duração e buffers.

Serviço tem identidade estável e versões imutáveis com categoria, duração, buffers, preço inteiro em centavos, moeda, preparo administrativo, estado publicado/inativo, unidades, profissionais habilitados, recursos nominados e exigências de sala/equipamento por capacidade/quantidade. Toda alteração publica uma versão nova. Inativação preserva leitura histórica; referências futuras devem usar a versão e a associação composta com unidade. Conflito de versão não sobrescreve a publicação concorrente.

Profissional é um recurso único por clínica, com vínculo opcional à equipe, qualificação operacional e unidades. O vínculo precisa estar ativo e atribuído a todas as unidades configuradas; cadastro operacional não concede acesso. Sala/equipamento têm identidade, capacidades, localização/capacidade por unidade e estado. Um item compartilhado conserva o mesmo UUID. A API usa inativação para a exclusão lógica e impede remover atribuições que sustentam histórico/janelas.

Jornadas **por data**, folgas, feriados e exceções usam o fuso IANA da unidade. Instantes são gravados em `timestamptz`/`tstzrange [)`, com horário local/fuso originais. A exclusão GiST impede sobreposição de turnos/exceções da mesma identidade em unidades diferentes. Folgas/feriados bloqueiam o recurso compartilhado. Intervalos contíguos são permitidos. Edição de janela substitui tudo na mesma transação; erro mantém a anterior. Mudança do fuso não desloca janelas já gravadas.

Consulta de recursos livres usa janelas, bloqueios, vínculo vigente, habilitação, capacidade e buffers da versão atual. É informativa: **reservas pertencem ao Prompt 07**. Não cria agendamentos, holds ou promessa de alocação. Candidatos são individuais; o conjunto escolhido na futura agenda deverá atender a todas as exigências. Recorrência semanal não é implícita: configure janelas nas datas de atuação. Detalhes e limites em [catalogo.md](../catalogo.md).

O banco valida vínculo atual, tenant, unidade, permissão e módulo `core`. Admin/gerente configuram; recepção/profissional/financeiro/auditor consultam. Papel global não concede acesso operacional. Tabelas privadas com RLS e sem grants diretos; somente RPCs autorizadas, `SECURITY DEFINER`, `search_path=''` e EXECUTE mínimo. Todas as relações relevantes usam referências compostas. Alterações de configuração e auditoria são transacionais. Escritas são serializadas por tenant e edições de recurso/serviço usam versão esperada.

## Arquivos alterados/criados

| Arquivos | Conteúdo |
| --- | --- |
| `supabase/migrations/202611140013_catalog.sql` | Extensão `btree_gist` declarada na migration, oito tabelas privadas, fuso por unidade, integridade, exclusão GiST, RLS/grants, helpers privados e nove RPCs públicas |
| `src/catalog.tsx` | Listas paginadas, publicação/edição/inativação, histórico, habilitações, configuração de recursos, fuso/jornadas e disponibilidade |
| `src/main.tsx`, `src/style.css` | Rota, navegação e estilos do catálogo; limite de espera de dez segundos na carga inicial de clínicas, com erro e cancelamento em vez de carregamento indefinido |
| `src/database.types.ts` | Tipos públicos regenerados; schema privado não publicado |
| `supabase/seed.sql` | Exemplos sintéticos das duas clínicas, separados da migration |
| `supabase/tests/catalog.sql` | 31 assertivas pgTAP, incluindo grants/RLS, autoridade, integridade, fuso, conflitos e rollback da operação após falha injetada de auditoria |
| `tests/catalog-support.mjs`, `tests/catalog-api.test.mjs` | Fixtures isoladas e nove resultados Node (grupo + oito subtestes) com sessões reais |
| `tests/catalog-concurrency.test.mjs` | Disputas reais de publicação, edição e janela entre duas unidades |
| `tests/e2e/catalog.spec.ts`, `playwright.config.ts` | Seis novos resultados E2E em desktop/Android emulado; capturas e ausência de overflow |
| `package.json` | Suítes novas integradas aos comandos anteriores |
| `docs/evidencias/prompt-06-desktop.png`, `docs/evidencias/prompt-06-mobile.png` | Capturas reais do catálogo/formulário durante E2E |
| `README.md`, `docs/catalogo.md`, este relatório | Contratos, operação, limites e homologação |

Sem mudanças nas migrations anteriores, Edge Functions, CI, `.env.example` ou package-lock. A CI existente já executa lint/unitários/build e preserva os gatilhos Pages configurados.

## Comandos e resultados reais

| Comando/verificação | Resultado final |
| --- | --- |
| `git status --short`, `rg`, leituras e `git diff` | Árvore inicial limpa; instruções e código anterior conferidos |
| `psql -X -h localhost -p 54322 -U postgres -d zetta -v ON_ERROR_STOP=1 -1 -f supabase/migrations/202611140013_catalog.sql` | Migration aplicada somente no banco local. Funções ajustadas reaplicadas localmente durante o desenvolvimento |
| `psql ... -c "notify pgrst, 'reload schema'"`, `npm run db:types` | Cache recarregado e tipos públicos gerados; aviso conhecido de depreciação futura de `--db-url` |
| Smoke SQL da migration completa em transação com `ROLLBACK` | Passou recriação de tabelas, funções, constraints e grants sem reset/perda dos dados existentes |
| Aplicação local somente do trecho novo de `supabase/seed.sql`, seguida de repetição | Seis recursos, sete atribuições, dois serviços/versões, vínculos/exigências e sete janelas. Replay sem duplicar registros |
| `npm run test:db` | **321/321** (290 anteriores + 31 novas), incluindo políticas Storage por SQL/RLS |
| `npm run test:api` | **58/58**, sem skips (49 anteriores + nove novos), GoTrue/PostgREST e sessões públicas reais |
| `node --test tests/catalog-api.test.mjs` | **9/9**, também após validar identificação/tradução do seletor de equipe |
| `npm run test:concurrency` | **6/6**, sem skips (cinco anteriores + um novo) |
| `npm test` | **11/11**, anteriores preservados |
| `npm run test:edge` | **25/25**, anteriores preservados |
| `npm run build` | Passou TypeScript/Vite/fallback SPA |
| Build com URL e chave pública locais passadas ao subprocesso Node | Passou também com o backend configurado, incluindo o código operacional no bundle |
| `npm run lint` | Passou sem warnings |
| `npx playwright test tests/e2e/catalog.spec.ts` | **6/6** do catálogo; repetição focal com quatro regressões anteriores: **10/10** |
| `npm run test:e2e` (78 cenários) | **76 aprovados e dois timeouts** em cenários anteriores; os seis novos passaram |
| `npm run test:e2e -- --retries=1` antes da correção da carga inicial | **77 aprovados e um reprovado**, também após retry; o cenário anterior de consulta permaneceu carregando além do limite |
| `npx playwright test ... -g 'Catálogo:\|falhas nas consultas'` após correção | **8/8**, catálogo e cenário anterior nos dois dispositivos |
| `npm run test:e2e -- --retries=1` (execução completa final) | RESULTADO_E2E_FINAL |
| Inspeção de capturas | Layout desktop conferido; testes desktop/mobile verificam ausência de overflow horizontal |
| Inspeção de arquivos alterados/novos e `dist` contra segredos privilegiados locais | RESULTADO_SEGREDOS |
| `git diff --check` | RESULTADO_DIFF |

As verificações operacionais usam sessões de usuário. API Admin/service role somente prepara/remove identidades sintéticas; SQL privilegiado prepara fixtures isoladas e inspeciona efeitos. pgTAP usa rollback. API/concorrência/E2E removem seus registros; eventos de auditoria permanecem por desenho. Não foi criado outro servidor manualmente: Playwright usa a configuração existente, com reutilização quando disponível.

Concorrência observada e assertada: 12 publicações com versão esperada 1 produziram **uma versão nova e 11 conflitos `40001`**, total de duas versões persistidas; duas jornadas simultâneas da mesma identidade em unidades distintas produziram **um sucesso e um `23P01`**, uma janela e um evento correspondente; 12 edições do recurso produziram **um sucesso e 11 conflitos `40001`**.

O teste de fuso multiunidade também cobre salvar o fuso, mudar de unidade e retornar com o valor persistido. O formulário aguarda o carregamento para evitar sobrescrever a entrada administrativa com uma resposta atrasada. A seleção de serviço para disponibilidade descarta uma versão que deixou de ser atual/publicada.

Cobertura nova inclui preço negativo/fracionário, duração zero/fracionária, buffer negativo, moeda malformada, equipe sem escopo, recurso/unidade de outro tenant, escrita parcial de recurso compartilhado, versão obsoleta, inativação e histórico, profissional e equipamento multiunidade, contiguidade, conversão UTC, folga/feriado, capacidade, buffers, retirada de habilitação após revogação, paginação, auditoria e rollback após falha injetada.

Falhas intermediárias corrigidas, sem contabilizá-las como sucesso:

- Duas verificações API de disponibilidade encontraram ambiguidade SQL do parâmetro `version_id` (`42702`). Referências qualificadas; repetições passaram.
- Uma assertiva pgTAP inicial incluiu índices ao verificar RLS. Filtro corrigido para tabelas (`relkind='r'`); todas as tabelas já tinham RLS habilitada.
- Primeira execução E2E afetada: quatro reprovações por expectativa incorreta do buffer padrão e seletor de status ambíguo durante recarga. Fixture passou a definir explicitamente o buffer e verificar o status específico.
- Segunda execução afetada: três aprovados e um reprovado; troca de aba podia renderizar linhas anteriores como janelas antes da consulta terminar, causando erro em `local_start`. Limpeza síncrona da lista ao trocar de aba corrigiu o problema; terceira execução: **4/4**.
- A conferência de troca de unidade identificou fuso inicial vindo do snapshot do shell. A tela passou a carregar o fuso persistido da unidade e aguardar o carregamento antes de permitir edição. A primeira execução ampliada teve nove aprovados e uma reprovação: a resposta atrasada ainda podia substituir a entrada de fuso. O bloqueio do formulário durante a carga corrigiu a corrida; a repetição focal passou **10/10**.
- Uma execução completa registrou **76/76 aprovados**, porém a invocação externa retornou `143` depois do resumo. A causa desse sinal não foi confirmada. Repetição com processo supervisionado registrou **74 aprovados e dois reprovados** em testes anteriores: GoTrue respondeu `504` ao login e o cenário de falha de rede excedeu a espera da tela. Não foram atribuídos a uma causa única nem contados como sucesso; ambos passaram na repetição focal, sem alterar os testes anteriores. A execução completa seguinte, com 78 cenários, teve **76 aprovados e dois timeouts** em cenários anteriores (botão de convite e tela de falha de consulta). Os seis novos passaram. Causa única não determinada; uma última execução com `--retries=1`, mesmas assertivas/limites e código de saída registrado, está discriminada na tabela. Essa execução teve **77 aprovados e uma falha persistente**, pois a carga inicial não possuía limite próprio e ainda aparecia como “Carregando…” além da expectativa anterior. `Home` passou a cancelar a consulta e apresentar erro após dez segundos, com limpeza do timer ao concluir/desmontar. A repetição focal após essa correção passou **8/8**. A execução completa final aparece na tabela. Não houve remoção de teste, aumento de timeout de teste ou ativação permanente de retries na configuração.
- Ao acrescentar capturas, o primeiro build encontrou parâmetro `testInfo` ausente na assinatura do teste. Corrigido. A tentativa de E2E completa correspondente parou ao iniciar o webServer, sem executar testes. Build configurado e execução completa posteriores são os registrados na tabela.

## Dependências, limites e homologação

Dependências existentes: Node/npm, PostgreSQL 17, `pgTAP` e `btree_gist`, GoTrue/PostgREST/proxy locais, Supabase CLI, Deno e Chromium/Playwright. Prettier 3.6.2 foi usado via npx apenas para formatação, sem adicionar pacote. Sem novas credenciais/variáveis.

1. **Local:** aplicar migrations 001–013 em ordem, recarregar PostgREST e gerar tipos. Não é necessário resetar o banco. Para um ambiente novo, o seed local inclui os exemplos desta etapa; durante esta execução aplicou-se apenas seu trecho novo, preservando os vínculos anteriores.
2. Entrar como `a@example.com`/Aurora e `b@example.com`/Horizonte, senha demo do README. Abrir Catálogo; criar serviço, selecionar profissional/sala/equipamento, adicionar exigências, conferir preço/duração/buffers/preparo e publicar. Editar preço e publicar nova versão; revisar histórico e inativar. As versões antigas devem continuar legíveis.
3. Em Jornadas, selecionar **16/11/2026, 09h30–10h**, escolher a avaliação de exemplo e consultar: profissional, sala e equipamento têm janela livre considerando buffers 5/10. Criar folga/feriado e consultar novamente. Testar intervalo invertido, conflito, edição/remover janela e fuso inválido.
4. O exemplo Aurora mantém **o mesmo profissional** no Centro de 09h–12h e na segunda unidade de 13h–17h. A conta A não recebeu escopo extra. Homologar atuação multiunidade com usuário de teste explicitamente autorizado às duas unidades; tentativa de turno simultâneo deve retornar conflito. A fixture isolada API/concorrência já comprovou esse comportamento sem ampliar permissões das contas anteriores.
5. Conferir recepção/profissional somente leitura, gerência/admin com escrita, revogado/global sem vínculo/tenant cruzado/unidade não atribuída negados. Vínculo de equipe revogado deve desaparecer dos candidatos disponíveis mesmo com JWT anterior ainda válido.
6. **Remoto:** nenhuma operação realizada. Antes de migrar/publicar, confirmar projeto/ref, URL, ambiente e autorização. O ref informado pelo ambiente é `ijjhtfryawtjoxvprjix`, sa-east-1; não foi usado como autorização. Aplicar migration 013 após as anteriores; não aplicar bootstrap/fixtures locais no hospedado. Confirmar `btree_gist`, plano das funções, RLS e testes com sessões de duas clínicas no ambiente confirmado.
7. **Pendências externas herdadas:** sem HTTP Storage local (políticas SQL testadas); SMTP/gateway Edge hospedado, instalação/SSO/iframe FLW, integração autenticada real e dispositivo iOS físico continuam sem homologação. Nenhuma capacidade FLW foi habilitada. Reservas e ocupação de agenda são trabalho do Prompt 07. Não houve bloqueio para concluir o escopo local do Prompt 06.

Evidências: [desktop](../evidencias/prompt-06-desktop.png), [mobile](../evidencias/prompt-06-mobile.png). Contratos detalhados: [Catálogo](../catalogo.md).
