# Zetta Estética

Console Zetta e catálogo de módulos (Prompt 02), sobre a fundação SaaS multiempresa. React 19, TypeScript, Vite, Tailwind 4, Supabase Auth, PostgreSQL/RLS e Storage privado. A FLW continua sem integração autenticada comprovada; o laboratório do Discovery está em `/zetta-estetica/integration-lab`.

## Inicialização local sem Docker

Requer Node 24/npm, psql, PostgreSQL 17 e os binários GoTrue/PostgREST/proxy já fornecidos pelo [ambiente](docs/ambiente-de-execucao.md). Nenhum projeto hospedado está vinculado a este checkout; a atualização do ambiente informa o ref `ijjhtfryawtjoxvprjix` (sa-east-1) para aplicação posterior pelo orquestrador. Execute a partir da raiz:

```sh
npm ci
bash scripts/local-stack/start.sh
# Exclusivamente no desenvolvimento: APAGA e recria zetta em localhost:54322.
npm run db:reset
npm run db:types
cp .env.example .env.local
# Preencha .env.local conforme abaixo.
npm run dev -- --host 127.0.0.1
```

O reset encerra somente os processos locais Auth/PostgREST, recria o banco fixo, executa bootstrap, migra Auth pelo GoTrue, aplica migrations em ordem, cria identidades pela API Admin local e aplica seed. O script de início reutiliza serviços saudáveis; processos iniciados ficam independentes do terminal. `npm run db:seed` repõe os vínculos demo ativos (exceto o usuário revogado), portanto não deve ser usado em produção nem para medir revogação. Não execute estes scripts contra banco remoto. O bootstrap Storage é uma emulação local; não o aplique no Supabase hospedado.

Em `.env.local`, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (ou alias `VITE_SUPABASE_ANON_KEY`). As chaves locais estão em `/workspace/.stack/local.env`; copie **somente** URL e chave pública, nunca service role/JWT secret para variáveis `VITE_*`. O navegador rejeita chave JWT com papel diferente de anon. O processo Node de testes lê o cofre diretamente; `LOCAL_STACK_ENV_FILE` permite outro caminho de cofre **local**, ainda restrito a `http://localhost:54321`. Sem configuração, o app mostra “Backend não configurado”.

Acesse `http://localhost:5173/zetta-estetica/`. Senha de todas as contas sintéticas: `Demo@123456`.

| Conta fictícia | Vínculo | Papel e unidade |
| --- | --- | --- |
| a@example.com | Aurora | Admin clínica, Centro |
| b@example.com | Horizonte | Admin clínica, Centro |
| multi@example.com | Aurora e Horizonte | Gerente, Centro de cada clínica |
| revogado@example.com | Aurora revogado | Sem acesso operacional |
| zetta@example.com | Plataforma Zetta | Superadmin sintético, sem acesso operacional |

A segunda unidade Aurora existe para provar que pertencer ao tenant não autoriza todas as unidades. Esses dados são sintéticos; não são contas FLW. O e-mail administrativo real não é cadastrado pelo seed.

## Autoridade e contratos

`auth.users` é a identidade. `profiles` permite editar somente o próprio nome. `tenant_memberships` mantém um vínculo por tenant/usuário, papel e estado; `membership_units` atribui unidades por referência composta. Papéis de clínica: `clinic_admin`, `manager`, `reception`, `professional`, `finance`, `auditor`. A matriz privada `private.role_permissions` concede somente permissões desta fundação; futuros módulos precisarão de permissões próprias.

`private.is_allowed` consulta `auth.uid()`, vínculo atual ativo, tenant ativo, permissão, unidade atribuída/ativa e entitlement vigente. O catálogo contém `core`, `agenda` e `packages`. Plano, vigência, override, configuração publicada e dependências determinam os entitlements. Permissões de módulo não podem ser exercidas passando `core`. Helpers privados eliminam recursão das políticas. Não há views expostas. SELECT é filtrado por RLS; UPDATE de `units.name` e `profiles.display_name` tem grants por coluna, USING e WITH CHECK. INSERT/UPDATE/DELETE de autoridade são negados ao cliente. Leitura administrativa de equipe exige escopo de todas as unidades do vínculo; eventos de unidade na auditoria são filtrados por unidade atribuída. Eventos de equipe guardam um snapshot das unidades e exigem permissão de auditoria em todas elas; eventos antigos ou sem escopo exigem todas as unidades do tenant. UUIDs históricos de auditoria não possuem FK para entidades removíveis. Escritas permitidas em convites/vínculos ocorrem por RPC auditada.

| RPC pública (sessão authenticated) | Autorização |
| --- | --- |
| `check_access(tenant, unit, permission, module='core')` | Retorna apenas permissão do próprio usuário; `unit=null` exige ao menos uma unidade atribuída ativa para checar metadados do tenant; operações em unidade exigem seu UUID |
| `invite_member(tenant, unit, email, clinic_role)` | Admin da clínica na unidade ativa, cria convite de 7 dias |
| `accept_invitation(invitation)` | Conta Auth confirmada com mesmo e-mail, convite válido e emissor ainda autorizado; bloqueio de linha e aceite idempotente |
| `revoke_invitation(tenant, invitation)` | Admin na unidade; invalida convite |
| `revoke_membership(tenant, membership)` | Admin com escopo de todas as unidades do alvo; não permite autorrevogação; revoga também convites emitidos/aceitos pelo alvo |
| `platform_context()` | Retorna somente papel global do próprio usuário |
| `platform_tenants()` | Somente superadmin Zetta, retorna id/nome/slug/estado dos tenants |

Não existe RPC pública para promover papel global ou reativar vínculo. No Prompt 02, estado, plano, override e escopo são alterados somente por RPCs auditadas de superadmin. Papéis globais `superadmin` e `implementation` ficam em tabela privada, sem acesso direto pelo navegador; `implementation` recebe somente diagnóstico redigido quando possuir concessão temporária explícita; não administra o console nem acessa dados operacionais. Superadmin não tem bypass dos dados operacionais. A whitelist privada inclui o e-mail solicitado pelo ambiente: trigger concede o papel inicial **após confirmação do e-mail**, sem criar conta nem senha para ele. Atualizações Auth não reativam nem promovem novamente um papel já existente. Metadados Auth não concedem papéis. Bootstrap e alterações de autoridade/estado são auditados na mesma transação, sem conteúdo clínico, tokens ou senhas nos eventos.

O slug só seleciona a clínica. Shell e rotas `/clinicas/:slug`, `/clinicas/:slug/admin` e `/admin` exigem Auth; consultas/RPCs validam a autorização no banco. A interface não substitui RLS. Um JWT ainda válido identifica o usuário após revogação do vínculo, mas novas consultas e operações nesse tenant são negadas. Operações já em andamento seguem a semântica transacional do PostgreSQL. Não implementamos `/launch`, SSO ou iframe nesta etapa.

## Convites

Não há cadastro público. Admin registra o convite para unidade/papel no shell. A interface indica **envio pendente**. No ambiente local sem SMTP, os testes geram um link Auth `type: invite` pela API Admin, validam seu token pelo GoTrue e usam a sessão resultante para aceitar; não simulam autenticação nem enviam e-mails.

Na homologação com SMTP e projeto confirmado, um operador autorizado deve enviar o convite pelo Auth no servidor, conferindo e-mail/ID/unidade do registro, com `inviteUserByEmail(email, { redirectTo: APP_URL + '/convites/' + invitationId })`, usando origem configurada e allowlist de redirects. Service role permanece no servidor. Ao abrir o link Auth, o usuário pode definir senha e confirma o vínculo em `/convites/:id`. Não derive a URL externa de parâmetros livres. A senha é opcional no aceite para preservar a credencial de quem já tem conta. Convite para conta que já tem vínculo no mesmo tenant é recusado com erro 42501, sem mudar papel nem reativar acesso; exige revisão administrativa. Reaceite só retorna sucesso enquanto convite, vínculo, atribuição, emissor e acesso continuam vigentes; a expiração do convite pendente não desfaz um aceite concluído. A edição de papéis/reativação de vínculo continua fora deste fluxo. O console permite mudar atribuições por RPC global auditada e acionar o envio separado pela Edge Function `invitation-delivery`.

## Storage e testes

Bucket privado `foundation-test`, 1 MiB, `text/plain`; objetos seguem `<tenant UUID>/<unit UUID>/<arquivo>`. Leitura/download exige `storage.read`; INSERT/UPDATE/DELETE exige `storage.write`. WITH CHECK impede mover um objeto para outro tenant/unidade. Não conceda URLs públicas; no Supabase real use `download` autenticado. Não emita URL assinada duradoura para conteúdo que precise bloquear imediatamente após revogação.

```sh
npm test                   # Regressões unitárias do Discovery
npm run test:db            # pgTAP real, transação com rollback; inclui políticas Storage
npm run test:api           # Auth/PostgREST reais com sessões públicas A/B e revogados
npm run test:concurrency   # Aceites/revogações e 12 disputas pela última unidade
npm run test:edge          # Deno: autorização, falha redigida, lease e retry do remetente
npm run build
npm run lint
npm run test:e2e           # Executar suíte completa ao concluir alterações
```

Testes API usam service role somente para preparar/remover identidades; as verificações usam sessões de usuário. pgTAP alterna papel authenticated e claims JWT equivalentes às aplicadas pelo Supabase. A pilha local **não tem servidor HTTP de Storage**: a rota retorna 404, identificado em teste. Upload/download HTTP, assinatura e streaming não estão homologados; a suíte SQL valida autorização SELECT/INSERT/UPDATE/DELETE da tabela `storage.objects`, inclusive A/B, unidade não atribuída e revogação. No Supabase real, execute a matriz com sessões reais e `storage.from('foundation-test').upload/download/update/remove`, confirmando corpo do arquivo e negações cruzadas. Não use service key nessa matriz.

O Playwright preserva os projetos anteriores e acrescenta shell desktop/mobile. Reutiliza servidores existentes nas portas 42730/42731 (devem ter a configuração esperada); CI exige portas livres. O projeto offline usa build/preview sem backend e o autenticado usa Vite com a chave pública local. Na ausência do cofre só os projetos offline são registrados. Chromium é pré-requisito: `npx playwright install chromium` se necessário.

## Portabilidade e homologação

Supabase padrão: `supabase/config.toml`, migrations aditivas e tipos gerados do esquema local em `src/database.types.ts`. Funções de autorização são SQL versionadas nas migrations; o Prompt 02 adiciona a Edge Function `supabase/functions/invitation-delivery` para envio separado de convite Auth. Não aplique `scripts/local-stack/bootstrap.sql` em ambiente hospedado. O seed pressupõe as identidades demo criadas pelo script Node e deve ser usado somente no desenvolvimento.

Antes de operação remota, confirmar explicitamente projeto/ref, ambiente, URL e autorização. Aplicar migrations sem fixtures reais, conferir signup desabilitado/SMTP/redirects, criar convites de homologação, validar a matriz RLS/API e repetir a matriz HTTP Storage. O relatório [Prompt 01](docs/etapas/prompt-01.md) contém resultados locais e pendências. Nenhuma publicação, `supabase link`, push remoto, commit ou push Git foi executado. A atualização do ambiente liberou Pages público; o workflow aceita push em main e acionamento manual, com lint/unitários/build sem dependência da stack local; base `/zetta-estetica/`, BrowserRouter e fallback `404.html` estão preparados.

## Console e módulos (Prompt 02)

Entre com `zetta@example.com` / `Demo@123456` (somente seed local) e abra **Administração Zetta**. As sete telas cobrem empresas, onboarding, catálogo, ícone, conexão, assinatura e suporte. Esse usuário global não tem vínculo com as clínicas. O provisionamento recebe uma referência UUID estável: repetir os mesmos dados retorna a mesma empresa; mudar o payload com a mesma referência é recusado. Empresa, unidade, configuração, direitos e convite são gravados juntos. O envio continua separado e pode ser retomado em Conexões.

Aurora usa Completo (Agenda e Pacotes); Horizonte usa Essencial (Agenda). São planos de referência para homologação, inclusive preços e limites, sem cobrança automática. `module_test_records` guarda exclusivamente dados sintéticos para provar RLS. As rotas `/clinicas/:slug/modulos/agenda` e `/modulos/packages` usam uma permissão de teste e a RPC `module_probe`; a implementação operacional pertence às próximas etapas. O admin clínico prepara uma configuração válida por 15 minutos, testa o candidato, revisa e publica. A prévia nunca altera a autorização operacional. Desligar um módulo mantém seus dados e nega novas operações; dependências são verificadas novamente na publicação.

Overrides exigem superadmin, motivo e término. Um override expirado nega o direito até revisão explícita; não há renovação automática nem fallback implícito para direitos expirados. Mudanças de plano preservam overrides e reavaliam os padrões do novo plano. Cancelamento/expiração da assinatura bloqueia os módulos contratados. Suspensão bloqueia também o núcleo, RLS, RPCs, aceite de convite e a elegibilidade de jobs (`private.job_allowed`). Futuros workers devem chamar esse helper antes de executar; não há scheduler operacional no Prompt 02.

O console registra janela contratual de exportação e concessão nominal por até 60 minutos. `/exportacao` permite ao admin designado baixar somente metadados da empresa e das suas unidades atribuídas, mesmo durante suspensão; contrato, grant, vínculo e prazo são revalidados. Não exporta dados clínicos nem antecipa exportadores de módulos futuros. Diagnósticos de suporte exigem papel global ativo e grant `diagnostics`; contêm apenas UUID do tenant, estados, data de teste e contagem de envios pendentes. Não concedem acesso às tabelas operacionais.

Para enviar convite, configurar **no servidor** `APP_URL`, `APP_ORIGIN` e as variáveis padrão Supabase documentadas em `.env.example`. A Edge Function valida o JWT do chamador pela RPC de autorização, usa um lease de 2 minutos e só então chama Auth Admin. A chave privilegiada nunca vai ao navegador. `sent` significa que o Auth aceitou a solicitação, não confirmação de entrega. Falhas recebem código redigido e retry; lease vencido pode ser retomado. Não existe garantia de envio exatamente uma vez se o processo cair entre o efeito externo e a confirmação no PostgreSQL. Para identidade já existente, o Auth pode recusar novo convite: o operador deve orientar login pelo Supabase Auth e abertura da rota do convite vigente, sem recriar a conta nem alterar seu papel.

Não há SMTP nem Edge HTTP em execução nesta stack. Os testes verificam o handler Deno com transportes controlados e a máquina de estados no PostgreSQL real; não comprovam entrega de e-mail. A implantação FLW continua possível com credenciais pendentes: teste é bloqueado com evidência persistida, capacidade permanece `CAPABILITY_NOT_VERIFIED`, e registro manual do ícone fica aguardando validação. Consulte [o relatório do Prompt 02](docs/etapas/prompt-02.md) para resultados e homologação.
