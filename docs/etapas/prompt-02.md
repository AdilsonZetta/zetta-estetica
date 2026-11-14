# Prompt 02 — Console Zetta e catálogo de módulos

Implementação local em 14/11/2026. Executado somente o Prompt 02. Git inicialmente limpo; instruções, ambiente, README, manifests, CI, relatório anterior e seções de console/módulos da especificação inspecionados. Migrations anteriores preservadas. Sem commit/push, deploy, vínculo remoto ou acesso ao projeto hospedado.

## Entrega

Console `/admin` com sete telas: empresas, onboarding, catálogo de módulos, instalações de ícone, conexões, assinaturas SaaS e suporte. Mantidos React 19, TypeScript, Vite, Tailwind 4, Supabase, design branco/vidro/lima, navegação acessível e responsiva. Listas possuem carregamento, vazio e falha; ações liberam os botões após erro. Mudanças registram ator e trilha no PostgreSQL.

- Empresas: pesquisa por nome/plano/estado, unidades, marca, responsável, fuso, etapa de onboarding, suspensão/reativação motivada e janela contratual de exportação.
- Onboarding: referência UUID idempotente; tenant, primeira unidade, configuração, assinatura, entitlements, conexão pendente e primeiro convite na mesma transação. Repetir a referência com outro payload é recusado. Falha reverte todo o cadastro. Convite não cria vínculo antes de confirmar identidade.
- Catálogo: chaves estáveis `core`, `agenda`, `packages`, versão, rota, permissão e dependências; planos Essencial/Completo, direitos padrão, vigência, overrides motivados e configuração clínica. Preços/limites iniciais são referências de homologação, sem cobrança automática nem validação comercial.
- Configuração clínica: prévia de 15 minutos, teste sem alterar direitos operacionais, revisão e publicação. Publicação revalida ator, vínculo, contrato, prazo e dependências; não permite desligar Agenda enquanto Pacotes depender dela. Plano/override/limite/papel global não são editáveis pelo admin clínico.
- FLW: credencial pendente, resultado do teste, capacidade e instalação do ícone em campos distintos. Testar registra bloqueio, data e evidência; nunca retorna sucesso externo. Configuração manual registra conta de referência, instalador, horário, URL de retorno HTTPS e abertura externa. Capacidade permanece `CAPABILITY_NOT_VERIFIED`; configuração do ícone aguarda validação humana. URL da clínica copiável, sem token de autorização.
- Assinaturas: plano, trial/ativa/carência/cancelada, vigência, limites e override de quota. Mudanças de plano preservam overrides contratados. Override expirado **nega** o direito até revisão explícita; não há renovação ou fallback implícito. Cancelamento/expiração bloqueia módulos contratados; suspensão bloqueia também o núcleo.
- Suporte: motivo, aprovador, destinatário, escopo, expiração máxima de 60 minutos e revogação. Diagnóstico exige papel global ativo e concessão `diagnostics` vigente, inclusive para superadmin. Retorna somente tenant UUID, estados, data de teste e contagem de entregas pendentes. Nenhuma mensagem bruta de fornecedor, e-mail, credencial ou conteúdo clínico é retornado.

Seed local: A/Aurora usa Completo (Agenda e Pacotes); B/Horizonte usa Essencial (somente Agenda). `module_test_records` contém registros sintéticos inclusive de Pacotes em B para provar o bloqueio por RLS. As telas verticais ainda não existem: rotas de módulo exibem descrição, permissão de teste e ação para executar `module_probe`, protegida no banco. Menu/rota, RLS e RPC respeitam a mesma autoridade. Passar `core` junto de `packages.test` não contorna o módulo.

Conta sintética adicional `zetta@example.com`, senha `Demo@123456`, abre o console após `npm run db:seed`; seu papel é privado e não concede vínculo operacional nas clínicas. O e-mail real da whitelist não foi cadastrado. Dados de demonstração ficam exclusivamente no seed e nas fixtures.

## Autoridade, transações e efeitos externos

Schemas privados continuam fora da Data API. Novas tabelas públicas usam RLS e somente SELECT para authenticated; escritas de autoridade usam RPC. Todas as funções SECURITY DEFINER fixam `search_path=''`, qualificam relações e têm EXECUTE restrito. Helpers sem identidade própria são privados e não executáveis pelo cliente; RPCs validam o papel global ou vínculo/unidade/permissão/módulo apropriados. Relações operacionais mantêm tenant obrigatório e FKs compostas.

Provisionamento usa advisory lock pela referência e compara o payload. Criação de unidade e mudanças de plano/quota serializam pela linha do tenant: 12 requisições pela última vaga geram exatamente uma unidade. Mudança de escopo é global, motivada, transacional e auditada; unidade de outra clínica falha na FK composta sem perder o escopo anterior. Aceite de convite preserva os locks e unicidade do Prompt 01, valida e-mail confirmado/igual, validade, tenant/unidade/core ativos e autoridade atual do emissor. O primeiro convite permite emissor global ativo associado ao provisionamento. Reaceite não reativa vínculo revogado.

Envio Auth/e-mail é separado: `request_invitation_delivery` autoriza e mantém pending/sending/failed/sent; worker obtém lease de dois minutos, incrementa tentativas e registra resultado redigido. Falha permite retry sobre o mesmo convite. Envio concluído não gera novo claim. Não se usa service role para verificar permissões de clínica nos testes API: sessões vêm do Auth real. A API Admin prepara/remove identidades sintéticas; o teste da máquina do remetente exerce funções SQL com papel servidor para o fluxo exclusivo do worker.

A Edge Function `invitation-delivery` valida a autorização com o JWT do usuário antes de usar a credencial privilegiada do servidor. Redirect deriva exclusivamente de `APP_URL`, com UUID validado; origem vem de `APP_ORIGIN`. Chaves não são devolvidas ao cliente. Cinco testes Deno usam transportes controlados para verificar negação sem chamada privilegiada, falha redigida, retry concluído e lease ocupado; são testes do handler, **não** prova de envio externo. PostgreSQL/Auth/PostgREST nos testes de integração são reais.

Suspensão bloqueia RLS, RPCs, aceite, novos envios e elegibilidade de jobs via `private.job_allowed`. Não há scheduler operacional nesta etapa; workers futuros devem usar esse helper antes da execução. Chamadas externas já em curso não podem ser desfeitas pelo banco. Operações PostgreSQL já iniciadas seguem sua semântica transacional.

Canal `/exportacao`: concessão nominal `export`, janela contratual vigente e vínculo admin ativo permitem exportar JSON de **metadados da empresa e unidades atribuídas**, mesmo com tenant suspenso. Exportação é auditada. Não exporta dados clínicos, Pacotes ou módulos futuros. Ausência/expiração/revogação da concessão ou da janela bloqueia o canal; não existe bypass operacional por ser suporte/global.

## Arquivos alterados

| Arquivos | Conteúdo |
| --- | --- |
| `supabase/migrations/202611140005_console.sql` | Catálogo, planos, configuração, assinatura, entitlements, prévias, provisionamento, quota, estado, suporte/exportação, FLW manual, fila de convite, RLS/grants, auditoria e aceite inicial |
| `supabase/migrations/202611140006_console_configuration.sql` | Onboarding motivado, situação/limites da assinatura e teste temporário de candidato de configuração |
| `supabase/seed.sql`, `scripts/seed-local.mjs` | Planos A/B, registros sintéticos e usuário local do console sem vínculo operacional |
| `supabase/functions/invitation-delivery/{index,handler,handler.test}.ts`, `supabase/functions/README.md` | Remetente, fronteira de segredos, CORS/redirect, tratamento de falha e testes Deno |
| `src/console.tsx`, `src/main.tsx`, `src/style.css`, `src/database.types.ts` | Sete telas, módulos da clínica, canal de exportação, estilos e tipos gerados do schema público local |
| `supabase/tests/console.sql` | 62 novas assertivas pgTAP de autorização, vigência, dependências, prévia, publicação, suspensão, contrato e suporte |
| `tests/console-{api.test,concurrency.test,support}.mjs` | Integração real, fixtures isoladas, provisionamento/aceite/retry/escopo e disputa de quota |
| `tests/e2e/console.spec.ts`, `tests/e2e/shell.spec.ts`, `playwright.config.ts` | Seis cenários novos desktop/mobile; teste anterior aponta ao novo endpoint do console |
| `package.json`, `.env.example`, `README.md`, este relatório | Comandos, configuração de servidor sem valores reais, comportamento e homologação |

Nenhuma dependência de aplicação foi adicionada; `package-lock.json` preservado. Prettier 3.6.2 foi usado via npx apenas para formatar arquivos novos, sem inclusão no projeto. CI anterior preservado: lint/unitários/build sem depender da stack local. Os testes Deno/DB/API/concorrência continuam locais nesta etapa.

## Comandos e resultados reais

| Comando/verificação | Resultado |
| --- | --- |
| `git status --short`, leituras com `cat`, `sed`, `rg`, revisão do diff | Árvore inicial limpa; trabalho anterior preservado |
| `psql ... -v ON_ERROR_STOP=1 -1 -f supabase/migrations/...` e `notify pgrst, 'reload schema'` | Migrations novas aplicadas incrementalmente no PostgreSQL local |
| `npm run db:reset` | Passou: banco exclusivamente local recriado, seis migrations em ordem e seed; Auth/PostgREST reaproveitados/reiniciados pelo script existente |
| `npm run db:seed` | Passou; estado A/B reposto e quinta identidade sintética do console criada; sem conta real |
| `npm run db:types` | Passou, tipos públicos gerados; CLI avisa futura depreciação de `--db-url` |
| `npm run test:db` | **158/158**: 96 anteriores + 62 novas; inclui matriz Storage SQL/RLS |
| `npm run test:api` | **29/29**, zero skips: 17 anteriores + 12 resultados do console (teste principal e 11 subtestes) |
| `npm run test:concurrency` | **3/3**: dois anteriores e quota com 12 requisições/uma vaga; teste de console API também repete provisionamento e oito aceites simultâneos |
| `npm test` | **9/9** anteriores preservados |
| `npm run test:edge` | **5/5** testes Deno reais do handler com transportes controlados |
| `deno check supabase/functions/invitation-delivery/index.ts` | Passou |
| `npm run build` | Passou: TypeScript/Vite/fallback; verificado sem backend e com URL/chave pública local fornecidas somente ao processo |
| Inspeção programática do build autenticado | `console_snapshot` e `test_module_change` presentes; service role/JWT secret locais ausentes; `index.html` e `404.html` idênticos |
| `npm run lint` | Passou sem warnings |
| `npx playwright test tests/e2e/console.spec.ts --project=auth-local --project=auth-mobile-chromium` | **6/6**, em 21,1 s; somente cenários novos durante desenvolvimento |
| `npm run test:e2e` | **48/48**, em 1,5 min: 42 anteriores + seis novos, quatro projetos desktop/mobile; suíte completa executada uma vez ao concluir o código |
| `git diff --check` e verificação de whitespace nos arquivos novos | Passaram |

Falhas intermediárias corrigidas: a primeira chamada da RPC recém-criada encontrou cache PostgREST antigo (PGRST202); recarregado e assertiva de negação passou. TypeScript apontou que limite contratual opcional precisava de default SQL; corrigida a assinatura e regerados tipos. O novo teste usava um matcher inexistente (`toContainValue`), substituído por `toHaveValue` com expressão regular. A tentativa E2E nesse estado parou no build, sem executar cenários; após correção, seis afetados e os 48 completos passaram. Nenhuma falha foi apresentada como aprovação. Reset emitiu recusas transitórias de conexão durante a espera de inicialização e terminou com `stack ok`, migrations e seed concluídos.

## Dependências, limites e pendências

Node/npm, PostgreSQL 17, pgTAP, GoTrue/PostgREST/proxy locais, CLI Supabase, Chromium/Playwright e Deno já fornecidos pelo ambiente. Sem Docker e sem servidores adicionais permanentes. Playwright reutiliza portas saudáveis quando disponíveis e gerencia seus servidores temporários.

- **SMTP/Edge HTTP:** não há SMTP nem servidor Edge HTTP local iniciado. Entrega de e-mail, allowlist/redirect externo e autenticação do gateway hospedado ainda precisam de homologação. `sent` é aceitação pelo Auth, não prova de chegada à caixa. Queda entre o efeito Auth e a confirmação SQL pode ocasionar reenvio após expiração do lease; não há promessa de exatamente um e-mail. Conta já cadastrada pode ser recusada por Auth Invite: orientar login existente e abertura do convite vigente, sem recriar identidade.
- **Storage HTTP:** continua sem servidor no ambiente local; a suíte anterior verifica retorno **404** real. Aprovação de Storage é das políticas SQL, sem afirmar upload/download HTTP, streaming ou assinatura de URL.
- **FLW:** sem conta/credencial. Nada de SSO, iframe, instalação automática, API/capacidade autenticada ou envio de mensagens foi habilitado. Evidências são de bloqueio/configuração manual local. Validar ícone/abertura/retorno desktop/celular com conta real autorizada.
- **Jobs e exportadores:** guard de suspensão/entitlement pronto; não há jobs de agenda, cobrança ou exportadores clínicos antes das respectivas etapas. Este canal exporta somente metadados disponíveis no Prompt 02.
- **Projeto hospedado:** ambiente informa `ijjhtfryawtjoxvprjix` (sa-east-1), mas não houve confirmação nem operação remota. Migrations são portáveis; bootstrap emulado e seed não devem ir à produção. Pages/ACLs reais permanecem pendentes de aplicação/homologação pelo responsável.

## Homologação

1. Na stack local existente, executar `npm run db:reset` apenas se desejar apagar/recriar o banco de desenvolvimento; caso contrário aplicar migrations novas em ordem e `npm run db:seed`. Gerar tipos. Não duplicar serviços. Configurar navegador somente com URL/chave pública, conforme README.
2. Entrar como `zetta@example.com` e abrir Administração Zetta. Confirmar ausência de clínica operacional para essa conta. Revisar as sete telas, pesquisa, marca/unidades/plano, criar cadastro com referência estável e repeti-lo. Em Conexões, conferir convite pendente separado; testar conexão e observar bloqueio persistido. Registrar ícone manual e conferir aguardando validação.
3. Entrar com A/B. A deve abrir os testes Agenda/Pacotes; B somente Agenda. Tentar URL direta de Pacotes e RPC como B: negar. Como A admin, preparar/testar prévia, conferir que operação não mudou, revisar/publicar; reativar depois. Tentar alterar plano/quota/override/global como clínica: negar. Repetir suítes DB/API/concorrência.
4. No console, suspender clínica sintética com motivo; conferir negação operacional e elegibilidade de jobs. Sem grant, exportação nega. Registrar janela contratual e conceder `export` ao admin da clínica por prazo curto; acessar `/exportacao` e conferir somente unidades atribuídas. Revogar/expirar o grant: negar. Reativar com motivo. Conferir trilha.
5. Conceder `diagnostics` por até 60 minutos a operador global autorizado; consultar e conferir lista fechada de campos redigidos. Sem grant, após expiração/revogação e com vínculo global inativo: negar. Não compartilhar tokens/conteúdo clínico como evidência.
6. **Antes de qualquer operação remota**, confirmar ref, ambiente, região, URL e autorização com o responsável. Aplicar migrations versionadas em ordem, sem bootstrap/seed demo. Conferir grants/ACLs gerenciados e RLS como no roteiro do Prompt 01. Publicar `invitation-delivery` somente no projeto confirmado; configurar secrets no servidor, SMTP, `APP_URL`, `APP_ORIGIN` e allowlist Auth. Nunca expor service role em `VITE_*`.
7. Enviar convite para endereço sintético autorizado, provocar falha SMTP e retomar o mesmo registro; conferir tentativas/lease/trilha, ausência de duplicação de tenant/vínculo e significado de `sent`. Abrir e-mail real, confirmar identidade, aceitar, testar expiração, revogação e reaceite. Repetir Storage HTTP com sessões de usuário no Supabase real. Homologar FLW/Pages separadamente, registrando evidência real sem substituir os resultados locais.

## Revisão Gemini

Revisor informado: **gemini-4-hydrogen / gemini-4-hydrogen**. Avaliação em 14/11/2026, preservando a árvore preexistente do Prompt 02. Correções de banco em migration aditiva `supabase/migrations/202611140007_console_review.sql`; migrations anteriores, assinaturas e privilégios das funções preservados. Aplicação exclusivamente no PostgreSQL local, sem reset, operação remota, commit ou push.

1. **Corrigido — unidade vazia.** O shell só monta os componentes de equipe/módulos com unidade selecionada; `ClinicModules` também evita consultas sem unidade. A RLS normalmente já oculta o tenant sem atribuição ativa, portanto esse não é o caminho normal de um usuário sem unidade; uma mudança entre a consulta de tenant e a de unidades ainda pode produzir o estado vazio. A proteção evita UUID vazio nesse intervalo e preserva a orientação “Nenhuma unidade autorizada”.

2. **Corrigido, com ressalva — estado nulo e empresa inexistente.** `set_tenant_status` recusa `suspended=NULL` com `22023`, mantendo o estado anterior. As seis RPCs citadas e `set_tenant_plan` verificam a existência e bloqueiam a linha do tenant após autorizar o operador, antes de escrever. **Descartada a alegação de sucesso silencioso em `set_module_override`:** a FK já recusava empresa inexistente; a correção padroniza o erro como “Empresa inexistente”. Eventos históricos de empresas removidas são legítimos e continuam preservados; não são necessariamente eventos fantasmas.

3. **Corrigido — entrega falha com estado persistido.** `run` atualiza o snapshot antes de tratar o erro retornado pela ação, incluindo HTTP 502 da Edge. Estado, tentativas e código atualizado aparecem junto da orientação de falha. E2E usa transporte Edge controlado que persiste a falha na fixture local antes de responder 502; verifica atualização pelo snapshot real. Não representa entrega SMTP real.

4. **Corrigido — foco e remontagem.** Removida a chave da raiz do console. A navegação, seletor e cartões permanecem montados; somente os formulários específicos da empresa reiniciam seus valores ao mudar a seleção. E2E verifica preservação de foco no seletor e nos cartões.

5. **Corrigido — diagnóstico de pendências.** A contagem parte dos convites vigentes com LEFT JOIN na fila: inclui convite ainda não enfileirado, conta uma única vez após enfileiramento e exclui convites aceitos, revogados, expirados ou enviados. pgTAP verifica ausência de fila, enfileiramento e expiração.

6. **Corrigido — entradas do provisionamento.** A RPC valida nome, slug, primeira unidade, marca, responsável e formato mínimo do e-mail antes de qualquer escrita. Algumas entradas já eram recusadas por constraints das tabelas; o responsável composto só por espaços era uma lacuna real. As constraints continuam válidas e a RPC agora retorna erro explícito `22023`. A validação mínima não comprova existência da caixa nem entrega. Sete casos pgTAP cobrem campos em branco e e-mail inválido.

7. **Corrigido — contexto na auditoria de suporte.** Mantidos os triggers de auditoria; as RPCs acrescentam eventos `support_granted` e `support_revoked` com escopo, destinatário, aprovador, motivo e expiração. Concessão inclui minutos; revogação inclui seu horário e preserva o motivo da concessão. Concessão inexistente é recusada. pgTAP verifica os detalhes de ambas as ações.

8. **Corrigido — abas sem empresa.** Ícone, Conexões, Assinaturas e Suporte exibem orientação para selecionar uma empresa. E2E verifica as quatro abas antes da seleção.

9. **Corrigido — busca e lista de unidades.** A pesquisa inclui Ativa/Suspensa e o nome do plano, preservando também as chaves internas. A lista de UUIDs remove entradas vazias após aparar espaços; lista totalmente vazia continua sendo recusada pela RPC. E2E verifica pesquisa por Ativa e Essencial.

10. **Corrigido — mensagens e configuração clínica.** Mensagens e prévia são limpas na mudança de tenant/unidade/rota; nova prévia limpa mensagens anteriores. Publicação bem-sucedida exibe confirmação preservada durante a recarga dos direitos. O botão exige permissão `modules.configure` obtida do banco, entitlement habilitado e vigência iniciada/não expirada. Prévia, teste e publicação continuam revalidando contrato, dependências e autoridade no PostgreSQL.

11. **Corrigido — configuração da Edge.** Ausência de `APP_ORIGIN` retorna `503 SERVER_NOT_CONFIGURED` antes da checagem de origem/preflight, sem acessar transporte privilegiado. URL base do backend tem barras finais removidas. Dois testes Deno novos verificam configuração ausente (POST e OPTIONS) e URL sem separador duplicado. Com servidor configurado, origem externa continua sendo recusada com 403. Sem origem configurada, o navegador pode ocultar o corpo da resposta por CORS; o status/código do servidor não promete leitura pelo JavaScript nesse caso.

### Validação desta revisão

A primeira execução pgTAP encontrou uma assertiva nova excessivamente ampla: ela contava nove eventos históricos legítimos de fixtures já removidas. O teste passou a considerar somente eventos posteriores ao início da própria execução; não foram apagados registros históricos. As 27 novas assertivas passaram junto das 158 anteriores. Nenhuma falha intermediária foi tratada como aprovação.

A primeira execução E2E completa passou **48/48** em **1,4 min**. Depois, a chave de remontagem foi restringida aos formulários para preservar também os cartões, e foi acrescentado o cenário de perda de unidade entre consultas. A execução final completa passou **50/50** em **1,5 min**, incluindo os novos testes desktop/mobile, sem skips.

| Verificação final | Resultado |
| --- | --- |
| Aplicação incremental de `202611140007_console_review.sql` com `psql -1 -v ON_ERROR_STOP=1` e reload PostgREST | Passou, exclusivamente em localhost:54322/zetta; sem reset |
| `npm run test:db` | **185/185**: 158 anteriores + 27 novas; inclui matriz Storage SQL/RLS |
| `npm run test:api` | **29/29**, sem skips; Auth/PostgREST reais e sessões de usuário |
| `npm run test:concurrency` | **3/3**, incluindo 12 disputas pela última unidade |
| `npm test` | **9/9** |
| `npm run test:edge` | **7/7**, incluindo dois testes novos |
| `deno check supabase/functions/invitation-delivery/index.ts` | Passou |
| `npm run build` | Passou com e sem backend público local; TypeScript/Vite/fallback |
| Inspeção do build autenticado | Console e `modules.configure` presentes; service role/JWT secret locais ausentes; `index.html` e `404.html` idênticos |
| `npm run lint` | Passou, sem warnings |
| `npm run test:e2e` | **50/50**, quatro projetos desktop/mobile, em 1,5 min |
| `git diff --check` e whitespace dos arquivos novos | Passaram |

Permanecem os limites já documentados: **Storage HTTP local indisponível (404 verificado), SMTP/entrega real, gateway Edge hospedado, aplicação remota e homologação Pages/FLW**. Os testes controlados de falha Edge não substituem essas homologações. Nenhum segredo foi versionado; nenhuma operação remota, publicação, commit ou push foi realizada.
