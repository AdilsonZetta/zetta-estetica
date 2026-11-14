# Prompt 03 — Abertura pela FLW e Supabase Auth

Implementação local em 14/11/2026. Árvore inicialmente limpa; nenhuma alteração anterior foi descartada. Lidos AGENTS.md, README, ambiente, relatório do Prompt 02, especificação relevante, package.json, configuração e CI. Executado somente o escopo do Prompt 03. Sem commit, push, publicação, operação remota ou instalação real na FLW.

## Entrega

- `/launch` consulta `launch_context`: um vínculo vigente abre a clínica; dois ou mais abrem o seletor; nenhum orienta solicitar convite. `/launch/:slug` preserva o destino através do login e só navega quando a RPC encontra vínculo autorizado. Slug inexistente, suspenso ou sem acesso apresenta indisponibilidade sem revelar a existência da clínica. A conta global continua sem acesso operacional.
- RPC SECURITY DEFINER com `search_path=''`, nomes qualificados e EXECUTE somente authenticated. Autoridade delegada ao helper vigente: identidade, tenant ativo, vínculo ativo, unidade atribuída ativa, permissão `unit.read` e módulo core vigente. O shell continua protegido por RLS e RPCs; a resolução inicial não substitui autorização das operações.
- Login por senha anterior preservado. Acrescentados pedido de OTP com `shouldCreateUser: false`, verificação de código `email` para conta existente e `invite` para identidade convidada. Conta existente também pode entrar por código dentro da rota do convite. “Já tenho um código” permite verificar material recebido previamente, inclusive após falha de envio. Não há cadastro público nem service role no navegador.
- Aceite transacional/idempotente anterior preservado. Expiração, revogação, convite encaminhado a outra identidade e repetição após perda de vínculo são recusados no banco. Código Auth expirado/reutilizado é recusado pelo GoTrue real. Mensagens orientam novo envio/revisão sem expor detalhes de terceiros. Código continua sendo credencial: encaminhá-lo junto do convite permite representar a identidade; a interface/e-mail orientam não compartilhar.
- Templates pt-BR versionados de código e convite; config local com signup desabilitado, confirmação ligada, OTP de seis dígitos/600 segundos e intervalo de 60 segundos, redirects restritos a `/convites/*`. Configuração por ambiente, SMTP, domínio remetente e limites estão em `docs/auth-ambientes.md`. A CLI/config não reconfigura automaticamente o GoTrue externo já em execução nem o projeto hospedado.
- Retorno externo vem exclusivamente de `VITE_FLW_RETURN_URL` HTTPS aprovada, sem credenciais/query/fragmento. Parâmetros `return` e referrer não determinam destinos. O remetente Edge exige APP_URL na origem exata APP_ORIGIN, sem query/fragmento/credenciais e HTTPS fora de localhost; a URL normalizada recebe somente o UUID do convite.
- Troca de rota/identidade desmonta estado anterior; troca de unidade reinicia equipe e módulos. Consultas de contexto usam AbortSignal; previews Blob registrados são revogados, callbacks de recursos executados e canais Realtime removidos pelo SDK. Não há cache persistente de dados do tenant. Revalidação ao ganhar foco e a cada 60 segundos em launch/clínica descarta o contexto e refaz consultas; formulários locais desse contexto reiniciam. Revogação já bloqueia novas operações no banco antes da atualização visual. Não existem documentos clínicos ou subscriptions operacionais nesta etapa; futuros recursos devem usar `src/context.ts`.
- Console copia `/launch/:slug` e registra nome do ícone, referência da conta FLW, modo desejado, instalador autenticado, evidência redigida, status pendente/instalado/testado/bloqueado e referência de contrato/prova futura. Registro auditado; estados de instalação/teste/bloqueio exigem evidência. Isso não habilita iframe, SSO ou capacidade FLW. Campo antigo de retorno por clínica permanece no banco por compatibilidade e não é usado para navegação.
- Em iframe, o app apresenta abertura externa e não instancia o cliente Auth. Aba externa é a proposta inicial ainda pendente de comprovação na FLW. SSO e iframe continuam condicionados a contrato/prova, origens exatas e homologação de sessão.

## Arquivos

| Arquivos | Alteração |
| --- | --- |
| `supabase/migrations/202611140008_launch.sql` | Resolução autorizada do destino; metadados e RPC auditada de instalação manual |
| `src/main.tsx`, `src/login.tsx`, `src/launch.tsx`, `src/context.ts` | Rotas, login/códigos, estados de acesso, fallback externo e descarte de contexto |
| `src/console.tsx`, `src/database.types.ts` | Formulário de instalação e tipos públicos gerados localmente |
| `supabase/config.toml`, `supabase/templates/{magic-link,invite}.html` | Auth local portável, redirects restritos e templates de e-mail |
| `supabase/functions/invitation-delivery/{handler,handler.test}.ts` | Validação do destino configurado e testes sem transporte SMTP |
| `supabase/tests/launch.sql` | 14 novas assertivas pgTAP |
| `tests/launch-api.test.mjs`, `tests/context.test.ts`, `tests/e2e/launch.spec.ts` | Auth/API reais, expiração/convites/revogação, recursos privados e seis cenários de navegador por perfil |
| `tests/e2e/console.spec.ts`, `playwright.config.ts`, `package.json` | Regressão do console atualizada, suítes novas e projeto iPhone/WebKit opcional |
| `.env.example`, `README.md`, `supabase/functions/README.md`, `docs/auth-ambientes.md`, este relatório | Variáveis sem segredos, configuração e homologação |

Sem novas dependências de aplicação; package-lock preservado e CI anterior mantido. Prettier 3.6.2 usado via npx somente para formatação, sem inclusão no projeto.

## Comandos e resultados reais

| Comando | Resultado |
| --- | --- |
| `git status --short`, leituras `cat/sed/rg`, revisão `git diff` | Árvore inicial limpa; alterações anteriores preservadas |
| `psql -X -h localhost -p 54322 -U postgres -d zetta -v ON_ERROR_STOP=1 -1 -f supabase/migrations/202611140008_launch.sql` | Aplicação incremental local; sem reset. Função corrigida reaplicada localmente e arquivo da migration atualizado |
| `psql ... -c "notify pgrst, 'reload schema'"` | Cache da API local recarregado |
| `npm run db:types` | Passou; tipos públicos atualizados; aviso da CLI sobre futura depreciação de `--db-url` |
| `npm run test:db` | **199/199**: 185 anteriores + 14 novas, incluindo Storage SQL/RLS |
| `npm run test:api` | **36/36**, sem skips: 29 anteriores + sete resultados da suíte nova; sessões de usuário reais |
| `npm run test:concurrency` | **3/3** anteriores, incluindo aceite/revogação e 12 disputas pela última unidade |
| `npm test` | **10/10**: nove anteriores + descarte de recursos/preview Blob real |
| `npm run test:edge` | **8/8** Deno: sete anteriores + matriz de APP_URL inválida, com transportes controlados |
| `deno check supabase/functions/invitation-delivery/index.ts` | Passou |
| `npm run build` | Passou TypeScript/Vite/fallback, sem backend e com configuração pública local |
| `npm run lint` | Passou sem warnings |
| E2E afetados durante desenvolvimento | **16/16** launch/console desktop/Android; depois convite novo **2/2** e JWT expirado **2/2** |
| `npm run test:e2e` | **62/62**, quatro projetos desktop/mobile, sem skips, em 1,9 min; 50 anteriores + 12 novos. Execução final sem avisos React de chaves duplicadas |
| Build autenticado e inspeção dos assets | Passou: launch_context, shouldCreateUser e record_icon_installation presentes; service role/JWT secret locais ausentes; index.html e 404.html idênticos |
| `git diff --check` | Passou |
| `npx playwright install webkit` | Binário WebKit 27.2 baixado; validação identificou bibliotecas ausentes |
| `npx playwright install-deps webkit` | Bloqueado: repositórios Debian HTTP retornaram 500; apt terminou com código 100 |
| `PLAYWRIGHT_IOS=1 npx playwright test tests/e2e/launch.spec.ts --project=auth-ios-webkit --grep 'launch específico'` | **1 bloqueado/falhou na inicialização**: faltam libevent, libgstgl, libgstcodecparsers, libavif, libmanette e libenchant. Nenhum cenário iOS executado; não contado como aprovado nem skip |

Service role apenas prepara/remove identidades sintéticas e gera material Auth das fixtures; verificação de OTP e operações usam chave pública/sessões de usuário. O teste de expiração prepara timestamps antigos na identidade/token da fixture local e obtém `otp_expired` real, sem esperar relógio ou falsificar resposta. Os valores de duração locais do processo GoTrue fornecido pelo ambiente não são os do config CLI; a tentativa inicial de retroceder apenas duas horas não expirou o código e foi corrigida para uma data inequivocamente antiga.

Falhas intermediárias: pgTAP revelou ambiguidade de `evidence` na RPC nova (qualificada); leitura de conexão no teste foi corrigida para usar snapshot autorizado; TypeScript exigiu AbortSignal antes de maybeSingle; envio OTP real sem SMTP não fornecia código, então o teste passou a verificar a falha real e usar material da fixture Admin com verificação pública. Uma execução afetada sofreu HMR durante edição e perdeu o formulário; repetida sem edição, passou. A primeira suíte E2E completa passou 62/62 mas expôs aviso de chaves React duplicadas; as chaves de equipe/módulos foram diferenciadas e a suíte final repetida. Nenhuma falha/bloqueio foi tratado como aprovação. Warnings de NO_COLOR/FORCE_COLOR são do runner.

## Observações por dispositivo e ambiente

| Ambiente observado | Resultado e alternativa |
| --- | --- |
| Desktop, Chromium/Playwright | Login/senha/código real, destino específico, recarregar, logout e nova conta, seletor com dois vínculos reais, troca de slug, revogação ao voltar o foco, JWT expirado com renovação e refresh revogado recusado passaram. Retorno é link para domínio `.invalid` de teste; não comprova FLW. Iframe oferece aba externa |
| Android, perfil Pixel 7/Chromium emulado | Mesmos cenários locais passaram; preservadas regressões de responsividade/movimento. Sem aparelho Android físico/webview FLW disponível. Alternativa prevista: navegador externo pelo link da clínica |
| iOS, perfil iPhone 13/WebKit | Tentativa bloqueada antes de abrir navegador pelas bibliotecas ausentes e falha apt. Sem iPhone físico; cookies, sessão, teclado OTP e retorno FLW não observados. Alternativa prevista, ainda não homologada: Safari externo pelo link da clínica |
| FLW A/B reais | Sem conta/credencial disponível. Instalação manual, nomes/ícones na FLW, duas contas, encaminhamento, abertura e retorno reais bloqueados. Fixtures A/B são clínicas Zetta sintéticas, não contas FLW |

## Dependências, pendências e homologação

Dependências usadas: Node 24/npm, React/TypeScript/Vite/Tailwind/Supabase já instalados, PostgreSQL 17/pgTAP, GoTrue/PostgREST/proxy existentes, CLI Supabase, Deno e Chromium/Playwright. Sem Docker e sem duplicar serviços existentes. Playwright reutiliza servidores saudáveis ou gerencia os temporários nas portas previstas. Nenhum `db:reset` nesta etapa.

1. Localmente, aplicar somente a migration nova no banco de desenvolvimento existente, recarregar PostgREST e gerar tipos. Configurar apenas URL/chave pública no frontend. Entrar A em `/launch/clinica-aurora`, B no mesmo destino (negar), B em Horizonte (permitir), multi em `/launch` (duas clínicas) e usuário revogado (nenhum vínculo). Testar também acesso direto e console global sem vínculo operacional.
2. No console, selecionar empresa, copiar o link `/launch/:slug`, registrar nome do ícone/conta/modo/estado/evidência redigida e conferir instalador/trilha. Não registrar instalado/testado sem evidência real. No ambiente atual registrar bloqueio por falta de conta FLW. Registros sintéticos criados pelos testes são removidos; não são prova de instalação externa.
3. Antes de qualquer ação hospedada, confirmar ref, URL, região, ambiente e autorização. O ambiente informa ref `ijjhtfryawtjoxvprjix` (sa-east-1), sem confirmação operacional nesta etapa. Aplicar migration versionada e publicar Edge no projeto confirmado, sem bootstrap/seed/chaves locais.
4. Aplicar as configurações de `docs/auth-ambientes.md`: signup desligado, confirmação ligada, SMTP/domínio remetente, templates, validade/limites, Site URL, APP_URL/APP_ORIGIN e redirects exatos por ambiente. O SMTP atual é indisponível: entrega e caixa real, reputação/TLS/DNS e aplicação dos templates continuam pendentes. Auth Invite para conta já existente pode ser recusado; orientar código de acesso e rota do convite vigente, sem recriar identidade.
5. Enviar convite a endereço autorizado real. Abrir destino, informar e-mail/código, aceitar e validar tenant/unidade. Repetir código, expirar código/convite, revogar pendente e vínculo, encaminhar somente destino a outra identidade, e comprovar negações. Não compartilhar códigos como evidência. Recarregar, sair, trocar conta/slug, revogar refresh e verificar revalidação de vínculo com sessão ainda válida.
6. Com duas contas FLW autorizadas, instalar manualmente **Gestão Estética** usando links das clínicas corretas e registrar instalador, modo observado, data, evidência redigida e status. Comprovar login/reload/logout/expiração/retorno em desktop, Android físico e iOS físico, inclusive usuário realmente multiempresa e revogação durante sessão. Comparar acesso cruzado entre contas FLW sem tratar a conta FLW como autoridade. Preferir aba externa quando demonstrada; copiar/abrir o link no navegador externo se popup/webview falhar. O retorno só deve usar URL aprovada do build.
7. Repetir WebKit com dependências disponíveis, usando o projeto opcional, e complementar em aparelhos reais. Não liberar iframe antes de observar sessão/cookies, origens exatas, persistência e fallback externo; configurar CSP `frame-ancestors` no host adequado. SSO exige contrato oficial e prova formal em duas contas; registrar evolução sem habilitar capacidade por anotação.
8. Storage HTTP permanece ausente localmente (404 observado pela suíte anterior, preservada). As 199 assertivas incluem políticas Storage SQL, não upload/download/streaming reais. Repetir a matriz HTTP com sessões de usuário no projeto confirmado. Edge HTTP/gateway hospedado e subscriptions Realtime reais também dependem de homologação; testes Deno não comprovam esses serviços.

## Revisão Gemini

Revisor informado: **gemini-4-hydrogen / gemini-4-hydrogen**. Revisão em 14/11/2026 sobre a árvore preexistente do Prompt 03, preservando suas alterações. Sem commit, push, reset do banco, alteração de dependências ou operação remota.

1. **Descartado — fallback de logout já presente.** O trecho enviado pelo revisor omite o `try { await db.auth.signOut({ scope: 'local' }) }` que já existia no `catch` da árvore recebida. A versão instalada de auth-js remove a sessão local antes da requisição remota nesse escopo. Mantido o código e acrescentada regressão E2E: logout HTTP 503, aviso de revogação não confirmada, ausência do token no localStorage e recarga sem restauração da sessão. Isso comprova a saída local; não comprova revogação remota durante indisponibilidade.

2. **Corrigido — modos conflitantes no convite.** Substituídos os dois estados independentes por `mode: 'invite' | 'otp' | 'password'`, com transições explícitas e limpeza dos estados de código ao trocar modo. Cada alternativa tem um único botão. `verifyOtp` recebe `invite` exclusivamente no modo de convite e `email` no modo de conta existente. E2E percorre conta existente → senha → convite → conta existente, verifica o campo de código e autentica com código real.

3. **Corrigido — código manual ao editar e-mail.** `manualCode` distingue “Já tenho um código” de envio solicitado com sucesso. Editar e-mail invalida somente o aviso de envio anterior; preserva o campo quando o usuário já possui código. “Solicitar outro código” limpa ambos. E2E limpa/preenche o e-mail depois de escolher código manual e verifica que o campo continua visível antes de autenticar.

4. **Corrigido — troca de clínica fora de contexto.** `ReturnAction` recebe `showSwitchClinic`, desativada por padrão. Somente `Launch` autenticado com slug a habilita, inclusive no erro de consulta. Login preserva o destino; `/launch` genérico não oferece link para si mesmo. Retorno externo aprovado continua disponível; sem ações, nenhum parágrafo vazio é renderizado.

5. **Corrigido — revogação síncrona do Blob de exportação.** A URL permanece registrada no contexto e sua liberação normal ocorre após 1 segundo, permitindo iniciar a leitura assíncrona do download. Troca de contexto/logout continua podendo revogá-la imediatamente. A mudança elimina a revogação no mesmo evento; não constitui homologação em Safari/iOS físico.

6. **Corrigido com ressalva — detecção de iframe.** Adicionada proteção `try/catch` na leitura, tratando exceção como ambiente embutido e oferecendo abertura externa sem inicializar Auth. Iframes entre origens normalmente permitem a comparação de `self` com `top`; não foi reproduzido `SecurityError` nessa leitura. A alteração é uma proteção defensiva para o ambiente restrito descrito, sem afirmar que todo iframe entre origens apresenta o problema. O teste existente verifica o fallback em iframe real do navegador local.

7. **Corrigido — aviso Auth apagado por sessão inicial.** O callback limpa o aviso somente em `SIGNED_IN` com sessão, preservando-o em `INITIAL_SESSION` e renovação. Nova regressão E2E abre hash de erro com sessão existente, recarrega e verifica o aviso junto do acesso autenticado.

8. **Corrigido — exceção em callback de limpeza.** Callbacks e previews são copiados e os registros esvaziados antes de executar a limpeza. Cada callback é isolado por `try/catch`, permitindo executar os demais e revogar todos os previews mesmo após uma falha. Teste unitário usa callback que lança, verifica execução do seguinte, Blob inacessível e ausência de repetição na segunda limpeza.

9. **Descartado — variável já documentada.** `.env.example` recebido já contém `VITE_FLW_RETURN_URL=` com orientação de HTTPS aprovado, sem credenciais, query, fragmento ou derivação de referrer. Nenhuma alteração necessária.

10. **Corrigido — OTP existente no destino de convite.** Removido o desvio para `/launch/clinica-aurora` antes da autenticação. O teste usa “Acessar conta existente por código”, solicita OTP com `shouldCreateUser: false`, verifica código `email` real e confirma que permanece em `/convites/:id` para aceitar. Material Auth é preparado pela fixture Admin; verificação e aceite usam chave pública/sessão de usuário. Sem SMTP, a falha real de envio continua explicitamente testada.

### Validação desta revisão

| Verificação | Resultado |
| --- | --- |
| `npm run build` | Passou TypeScript/Vite e fallback SPA |
| `npm run lint` | Passou, sem warnings |
| `npm test` | **11/11**, incluindo falha de callback e revogação de Blob real |
| `npm run test:db` | **199/199**, incluindo Storage SQL/RLS |
| `npm run test:api` | **36/36**, sem skips, Auth/PostgREST reais |
| `npm run test:concurrency` | **3/3**, incluindo 12 disputas pela última unidade |
| `npm run test:edge` | **8/8** |
| `deno check supabase/functions/invitation-delivery/index.ts` | Passou |
| `npm run test:e2e` | **66/66**, quatro projetos desktop/mobile, sem skips, em **1,9 min**; 62 anteriores preservados e quatro execuções novas (duas regressões por perfil autenticado) |
| `git diff --check` | Passou |

Todas as verificações acima passaram nesta revisão, sem falhas intermediárias. O runner E2E emitiu somente os avisos conhecidos de `NO_COLOR`/`FORCE_COLOR`. A suíte padrão não inclui o projeto opcional WebKit: permanecem os bloqueios de bibliotecas e a homologação iOS/FLW/SMTP/Storage HTTP documentados acima, sem alegar nova validação desses ambientes. Nenhum serviço local duplicado ou banco reinicializado; as verificações usaram a stack existente.
