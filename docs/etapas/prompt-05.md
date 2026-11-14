# Prompt 05 — Cadastro e identidade do cliente

Executado localmente em 14/11/2026, com escopo exclusivo do Prompt 05. Árvore inicial limpa. Lidos AGENTS.md, README, manifests/lock, CI, ambiente, relatório do Prompt 04 e seções pertinentes da especificação/documento mestre. Stack sem Docker reutilizada, sem reset, commit/push, publicação, operação remota ou chamada FLW. Nenhuma dependência de runtime adicionada.

## Entrega

**Clínica → Clientes** (`/clinicas/:slug/clientes`): pesquisa por nome/telefone com cursor, cadastro mínimo e edição, ficha resumida, contatos opcionais, referência FLW, revisão de vínculos, histórico cadastral e abas para módulos autorizados/instalados. Cadastro estritamente por unidade, com UUID interno e referências compostas. Nenhum campo de prontuário.

Telefone brasileiro com DDD é normalizado para +55; internacional explícito conserva o país. Telefone bruto permanece disponível; informação insuficiente exige revisão. Homônimos/telefone compartilhado/e-mail repetido exigem confirmação humana, sem identificação ou merge automáticos. Edição usa versão da ficha; revisões dos vínculos também incrementam a versão.

Vínculos tipados de contato/card por tenant/conexão, com estado, modo, origem, atualização/autoria e unicidade externa enquanto não encerrados. Histórico preserva alterações anteriores. O modo sincronizado está previsto no schema, mas não habilitado por RPC. Sem conta/credencial/URL comprovada: cadastro e vínculo manuais, `CAPABILITY_NOT_VERIFIED`, botão de CRM indisponível e instrução para localizar o identificador na FLW. Não se inventa deep link.

Merge supervisionado somente para admin/gerente na unidade: revisão de ambas as fichas/versões/contatos/vínculos, motivo e confirmação explícita; serialização por tenant/unidade, locks de clientes por UUID em ordem consistente, movimentação apenas dos vínculos desta etapa, eventos e auditoria na mesma transação. Sobrevivente mantém seus contatos. Origem arquivada com referência composta ao sobrevivente. Eventos anteriores ficam intactos e aparecem na linhagem do sobrevivente. Replay para o mesmo sobrevivente ativo é idempotente. Versões obsoletas e referência cruzada abortam tudo.

Prévia de importação JSON de até 100 linhas/100 KB, mapeamento manual v1, sem escrita/sincronização. Valida tipos e campos permitidos; relata linha/origem, rejeições, normalização, candidatos na unidade e ambiguidades no banco/amostra. Download do relatório pela tela. Amostra sintética entregue com resultado real da RPC: **3 linhas, 2 em revisão, 1 rejeitada, nenhuma gravação**.

Contrato, matriz de papéis e roteiro em [clientes.md](../clientes.md). Evidências: [amostra](../../fixtures/importacao/clientes-amostra.json), [prévia/rejeições](../evidencias/prompt-05-previa-clientes.json), telas [desktop](../evidencias/prompt-05-desktop.png) e [mobile](../evidencias/prompt-05-mobile.png).

## Arquivos alterados/criados

| Arquivos | Alteração |
| --- | --- |
| `supabase/migrations/202611140011_clients.sql` | Tabelas privadas, FKs compostas, índices, RLS/grants mínimos, normalização, seis RPCs autorizadas e eventos transacionais |
| `src/clients.tsx`, `src/main.tsx`, `src/style.css` | Telas, navegação por unidade, estados de carregando/vazio/erro, revisão, merge e importação |
| `src/database.types.ts` | Tipos públicos regenerados; schema privado não publicado |
| `supabase/tests/clients.sql` | 30 assertivas pgTAP de identidade, autorização, FKs, rollback após falha injetada, paginação, módulo e suspensão |
| `supabase/tests/flw-review.sql` | Fixture anterior com horários determinísticos para eliminar falha intermitente por desempate aleatório de UUID |
| `tests/clients-api.test.mjs` | Sete resultados Node (grupo e seis subtestes), com sessões reais A/B/global/revogado/anônimo |
| `tests/clients-concurrency.test.mjs` | 12 merges repetidos, merge inverso simultâneo e 12 edições com versão concorrente |
| `tests/e2e/clients.spec.ts`, `playwright.config.ts` | Quatro E2E novos em desktop/Android emulado |
| `package.json` | Inclusão das suítes API/concorrência novas nos comandos existentes |
| `fixtures/importacao/clientes-amostra.json`, `docs/evidencias/prompt-05-*` | Amostra sintética, resposta real da prévia e telas |
| `README.md`, `docs/clientes.md`, este relatório | Contratos, operação local, limites e homologação |

Nenhuma variável nova, segredo ou função Edge necessária: a integração continua manual; Edge Functions anteriores foram preservadas. `.env.example`, package-lock e CI não precisaram de alteração.

## Comandos e resultados reais

| Comando/verificação | Resultado final |
| --- | --- |
| `git status --short`, `rg --files`, leituras `cat/sed/rg` e revisão `git diff` | Árvore inicial limpa; ambiente e autoridade existentes conferidos |
| `psql -X -h localhost -p 54322 -U postgres -d zetta -v ON_ERROR_STOP=1 -1 -f supabase/migrations/202611140011_clients.sql` | Migration aplicada incrementalmente somente no banco local. Ajustes de funções reaplicados localmente e incorporados ao arquivo final |
| `psql ... -c "notify pgrst, 'reload schema'"` e `npm run db:types` | Cache recarregado e tipos gerados; aviso conhecido de depreciação futura de `--db-url` |
| Smoke SQL transacional da migration final | Recriação de tabelas/funções/permissões da etapa dentro de transação seguida de **ROLLBACK**; passou, sem reset/perda de dados |
| `npm run test:db` | **281/281** (251 anteriores + 30 novos), incluindo políticas Storage SQL/RLS |
| `npm run test:api` | **49/49**, sem skips (42 anteriores + sete novos), GoTrue/PostgREST reais |
| `npm run test:concurrency` | **5/5**, sem skips; disputas novas e anteriores preservadas |
| `npm test` | **11/11**, anteriores preservados |
| `npm run test:edge` | **25/25**, anteriores preservados |
| `npm run build` | Passou TypeScript/Vite/fallback SPA |
| `npm run lint` | Passou sem warnings |
| `npx playwright test tests/e2e/clients.spec.ts` | **4/4** afetados antes da suíte completa |
| `npx playwright test tests/e2e/console.spec.ts -g 'clínica sem unidade'` | **2/2** após correção da navegação |
| `npm run test:e2e` | **72/72**, sem skips, execução completa final em quatro projetos desktop/mobile (68 anteriores + quatro novos) |
| Capturas Chromium desktop/mobile por Playwright | Telas reais com prévia sintética; verificação de ausência de overflow horizontal |
| Inspeção de arquivos alterados/novos e `dist/assets` contra segredos privilegiados do cofre local | Nenhuma ocorrência; valores não impressos |
| `git diff --check` | Passou |

Testes API verificam somente com sessões de usuário e chave pública. Identidades de testes anteriores usam serviço apenas na preparação. Novos clientes/links/eventos sintéticos dos testes API/concorrência/E2E são removidos; testes pgTAP usam rollback. Auditoria transacional permanece por desenho. Nenhuma aprovação acima equivale a integração FLW real ou teste HTTP Storage.

Falhas intermediárias corrigidas, sem contar reprovações como sucesso:

1. Build inicial encontrou acesso a `detail` possivelmente nulo na contagem da revisão de merge; corrigido com acesso opcional, builds posteriores passaram.
2. Uma regressão pgTAP anterior (`flw-review.sql`, lease vencido) falhou: os 25 eventos tinham `now()` igual dentro da transação e o item esperado podia ficar fora do lote de dez por UUID aleatório. Fixture passou a ordenar horários pelo ordinal antes de testar prioridade/lease; suíte completa posterior passou **281/281**. Nenhuma lógica FLW de produção foi alterada.
3. Primeira execução E2E completa: **70 aprovados, dois reprovados** no cenário anterior de clínica sem unidade. O link novo “Módulos da clínica” aparecia fora da tela de clientes e violava a expectativa de não mostrar módulos nesse vazio. Corrigido para navegação contextual “Voltar à clínica” somente em Clientes; testes afetados passaram **2/2**. Repetição completa final: **72/72**, sem skips.

## Dependências, pendências e homologação

Dependências: Node/npm, PostgreSQL 17/pgTAP, GoTrue/PostgREST/proxy locais já existentes, Supabase CLI e Deno, Chromium/Playwright. Prettier 3.6.2 foi usado por npx somente para formatar arquivos novos; não foi adicionado ao projeto.

1. **Local:** aplicar migrations em ordem, recarregar PostgREST e gerar tipos. Entrar como A/Aurora e B/Horizonte. Testar mesmo nome e telefone, cadastro incompleto, mudança de número, vínculo/card duplicado, revisão/encerramento, merge autorizado/falho, origem arquivada, histórico no sobrevivente e prévia baixável. Contas sintéticas do README; recepção cadastra mas não faz merge, profissional lê mas não altera, global sem vínculo não acessa. A unidade não atribuída e o tenant cruzado devem ser negados pelo banco.
2. **Remoto:** nenhuma operação realizada. Confirmar explicitamente projeto/ref, URL, ambiente e autorização antes de aplicar migrations/publish. O ambiente informa ref `ijjhtfryawtjoxvprjix`, sa-east-1; isso não foi tratado como autorização operacional. Não aplicar bootstrap/seed/fixtures locais no hospedado.
3. **FLW:** obter duas contas e comprovar leitura autenticada, escopo, atributos, paginação/cursor, carimbo de origem e URL exata de card. Implementar e versionar transporte/mapeamento somente após prova. Até lá, contato/card se localiza por ID manual; deep link e sincronização permanecem indisponíveis. Não houve teste com fornecedor.
4. **Importação:** prévia entregue, sem importação definitiva/corte. A clínica revisa ambiguidades/rejeições e aprova lote antes de futura implementação de gravação. Não tratar candidatos por nome/telefone como identidade confirmada.
5. **Histórico de módulos:** Agenda/Pacotes ainda não têm entidades operacionais nesta etapa. Abas seguem catálogo/entitlement/permissão e informam ausência de registros; etapas próprias deverão conectar referências compostas e estender o merge explicitamente.
6. **Limites do ambiente:** sem API HTTP de Storage local (políticas SQL testadas), SMTP/gateway Edge hospedado, SSO/iframe/instalação FLW e dispositivos iOS/WebKit físicos não homologados. Nenhum bloqueio impediu a entrega local desta etapa.

## Revisão Gemini

Avaliação crítica dos oito itens do modelo `gemini-4-hydrogen`, em 14/11/2026. As alterações existentes foram preservadas. A migration 011 já aplicada não foi reescrita: correções SQL estão em `supabase/migrations/202611140012_clients_review.sql`, aplicada incrementalmente somente ao banco local `zetta` em localhost:54322, seguida de recarga do PostgREST e regeneração dos tipos. Sem reset, commit/push, operação remota ou chamada FLW.

1. **Corrigido — replay do merge com versões arbitrárias.** A busca do evento inclui tenant, unidade e cliente. O retorno idempotente exige as duas versões originais presentes nos efeitos do evento; versões diferentes ou nulas seguem para `22023` porque a origem está arquivada. Num merge novo, a divergência continua retornando `40001`. Ressalva: um replay com as versões **originais** é válido mesmo se o sobrevivente tiver sido editado depois; ele apenas recupera o resultado da operação concluída, sem executar novo merge. Exigir as versões atuais quebraria esse contrato. API cobre replay exato, versões diferentes/nula e replay após edição posterior; as 12 repetições concorrentes continuam produzindo um único evento.
2. **Corrigido — e-mail repetido na amostra.** A prévia compara também e-mails entre linhas diferentes, com remoção de espaços e normalização de caixa. E-mail ausente/vazio não cria ambiguidade. Regressão API verifica duas linhas com nomes diferentes e e-mail equivalente como `review`, e duas sem e-mail como `new`, mantendo a ausência de gravações.
3. **Corrigido — sobrescrita concorrente de vínculo.** `set_client_link` recebe `expected_version`, obrigatório ao editar vínculo existente e validado contra a ficha bloqueada. Ausência ou divergência retorna `40001`. A UI envia a versão revisada ao confirmar/encerrar. A assinatura anterior foi removida para evitar bypass e ambiguidade no PostgREST; a nova tem EXECUTE somente para `authenticated`, com autorização no corpo. Criar um vínculo continua sem versão obrigatória; unicidade externa e locks existentes permanecem. API cobre ausência/obsolescência; concorrência disputa confirmação/encerramento com 12 chamadas: uma aceita, 11 conflitos, uma única revisão adicional e um único incremento de versão. pgTAP verifica assinatura e grants.
4. **Corrigido — mensagens ao trocar de ficha.** Seleção da lista, Novo cliente e abertura do sobrevivente limpam erro/mensagem e descartam detalhe e preparação anteriores. Selecionar novamente a mesma ficha provoca recarga, evitando carregamento sem consulta. A atualização após salvar preserva a mensagem de sucesso da operação atual. E2E verifica limpeza do erro ao iniciar novo cadastro e carregamento de outra ficha com resposta retida até a assertiva.
5. **Corrigido — proveniência ao revisar vínculo.** A revisão manual define `mode='manual'` e remove `source_updated_at`, preservando o snapshot anterior no evento. Ressalva de alcance: nenhuma RPC atual produz vínculos sincronizados; portanto não havia fluxo operacional de sincronização quebrado. A regra torna coerente a revisão manual com os dois modos já admitidos pelo schema. pgTAP prepara um vínculo sincronizado exclusivamente sintético dentro de rollback, revisa com sessão de usuário e comprova modo, carimbo e histórico.
6. **Corrigido — preparação do sobrevivente.** Campo controlado, UUID com espaços normalizado, validação de formato, recusa do próprio cliente (inclusive em maiúsculas) e de destino arquivado com mensagens específicas. Nenhum desses casos exibe confirmação. E2E cobre o próprio UUID, destino com espaços aceito e arquivado recusado. A autoridade/validação final continua no PostgreSQL.
7. **Corrigido no rótulo / descartado quanto a habilitar CRM.** O rótulo passa a refletir `link.mode`, em vez de fixar manual. Porém `client_detail` retorna **sempre** `crm_url=null` e `crm_code='CAPABILITY_NOT_VERIFIED'`; não existe URL verificada nem capacidade habilitada no backend atual. A alegação de um link disponível sendo ignorado é falsa neste contrato. O botão indisponível e a orientação manual foram mantidos; não foi inventada URL nem habilitada navegação por presença de um campo futuro. API/E2E continuam verificando CRM indisponível. Uma integração futura deverá definir validação de origem/URL e homologar a capacidade junto com sua apresentação.
8. **Corrigido na normalização / descartada otimização especulativa.** A RPC usa `btrim(coalesce(query,''))` na pesquisa por nome/telefone e no caso vazio; API cobre nome com espaços externos. É correto que B-tree não acelera substring arbitrária de nome, mas o índice ainda pode restringir tenant/unidade. Não há medição de lentidão nem exigência de escala que justifique adicionar extensão/GIN nesta revisão. Busca por substring foi preservada; avaliar `pg_trgm` com plano de execução e volume representativo se surgir necessidade.

Validação desta revisão (suítes anteriores preservadas e regressões incluídas nos testes existentes, além de nove assertivas novas de pgTAP):

| Comando | Resultado |
| --- | --- |
| Aplicação local da migration 012, recarga PostgREST e `npm run db:types` | Passou; schema privado não publicado |
| `npm run build` | Passou TypeScript/Vite/fallback SPA |
| `npm run lint` | Passou sem warnings |
| `npm test` | **11/11**, sem skips |
| `npm run test:db` | **290/290** (281 anteriores + nove novas), incluindo Storage SQL/RLS |
| `npm run test:api` | **49/49**, sem skips, sessões reais e regressões de identidade/replay/importação |
| `npm run test:concurrency` | **5/5**, sem skips, incluindo 12 revisões concorrentes de vínculo |
| `npm run test:edge` | **25/25**, sem falhas |
| `deno check` nos três entrypoints Edge | Passou |
| E2E isolado do cenário anterior que teve timeout | **1/1**, sem alteração do teste |
| `npm run test:e2e` (repetição completa final) | **72/72**, sem skips, quatro projetos desktop/mobile |
| `git diff --check` | Passou |

Na primeira execução completa E2E desta revisão, **71 passaram e um falhou**: o cenário anterior de usuário revogado em `auth-mobile-chromium` excedeu 30 segundos ao preencher o campo de e-mail, antes de autenticar. A captura final continha o formulário de login; isso não demonstra uma falha da autorização nem determina sozinho a causa do atraso. Os quatro E2E de Clientes passaram nessa execução. O cenário anterior foi repetido isoladamente, sem alteração de código ou aumento de timeout: **1/1**, em 1,2 segundo. A suíte completa foi então repetida e terminou com **72/72 aprovados**, sem skips, em 2,6 minutos. Nenhuma falha foi contada como sucesso.

Inspeção de arquivos alterados/novos e `dist` não encontrou os segredos privilegiados locais (valores comparados sem impressão). Permanecem os avisos conhecidos de depreciação de `--db-url` ao gerar tipos e `NO_COLOR/FORCE_COLOR` no Playwright. Limites anteriores permanecem: Storage HTTP local indisponível (políticas SQL aprovadas), FLW real, SMTP/gateway Edge hospedado e iOS físico não homologados. A aplicação remota futura deve incluir a migration 012 após a 011 e exige confirmação do projeto/ambiente.
