# Edge Functions

`invitation-delivery` (Prompt 02) é o remetente separado de convites Auth. Recebe POST `{ "invitation": "UUID" }` com sessão do usuário, verifica autorização pela RPC `request_invitation_delivery`, obtém lease privado como servidor, chama `/auth/v1/invite` com redirect fixado por configuração e confirma o resultado no banco. Não utiliza payloads/URLs livres para o redirect nem retorna mensagens brutas do Auth.

Configuração somente no servidor: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` (incluindo base `/zetta-estetica`, sem barra final) e `APP_ORIGIN` (origem exata, sem path). Não use prefixo `VITE_` para segredos. `APP_URL` deve constar na allowlist de redirects Auth. SMTP é pré-requisito para entrega.

`npm run test:edge` executa cinco testes Deno do handler com transportes controlados. A suíte SQL/API exercita a máquina de estados real (pending/sending/failed/sent, lease e tentativas). Nenhum desses resultados comprova entrega SMTP. Não foi iniciado servidor Edge HTTP local. Publicação depende de confirmação do projeto e autorização remota.

Retry de falha é autorizado por usuário; lease ocupado impede concorrência e expira em dois minutos. Uma queda após aceitação pelo Auth e antes da confirmação SQL pode exigir retry e produzir outro e-mail. `sent` confirma aceitação pelo Auth, sem prometer entrega. Conta Auth já existente pode exigir orientação manual para login e aceite do convite vigente. Suspensão, revogação e expiração impedem novo claim; uma chamada externa já em curso não pode ser desfeita por PostgreSQL.


Prompt 03: `APP_URL` precisa ter a mesma origem exata de `APP_ORIGIN`, sem credenciais, query ou fragmento; HTTPS obrigatório fora de localhost. O destino enviado ao Auth é sempre `/convites/<UUID>` sob essa base. Aplique `supabase/templates/invite.html` no template Invite do projeto confirmado: contém código Auth e a URL aprovada, sem parâmetro livre de retorno. Configuração completa e limites em [Auth por ambiente](../../docs/auth-ambientes.md). Os testes Deno usam transportes controlados; a verificação de código nos testes API/E2E usa GoTrue real, sem comprovar SMTP.

## Adaptador FLW (Prompt 04)

`flw-adapter` aceita POST com JWT de usuário e `APP_ORIGIN` exata. Configuração usa os mesmos `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do cofre de secrets do servidor. Timeout de RPC: 5 s; operação: 8 s; lease: 30 s; lote: até dez itens; uma entrega por conexão, serializada no PostgreSQL. Nenhuma credencial FLW é lida nesta versão. `secret_ref` reserva somente uma referência ao cofre para implementação futura homologada.

- `{action:"request",tenant,unit,operation,entity,version,correlation,simulation:false}`: valida autoridade com a sessão, sem usar service role, registra intenção/evento/tarefa e retorna `CAPABILITY_NOT_VERIFIED`.
- `simulation:true`: fixture explicitamente sintética; nunca aciona FLW. Não usar como evidência de homologação.
- `{action:"work",tenant,unit}`: valida contexto pela RPC de usuário e processa até dez entregas sintéticas elegíveis. Claim/finish de serviço revalidam autoridade do emissor, tenant, unidade e módulo. Não há scheduler ativado nesta etapa.

`contract.ts` define interfaces Zetta de contato, card, cobrança e automação; `transport.ts` fornece exclusivamente simulação. Não há base URL, token, endpoint ou assinatura FLW presumidos. `flw-webhook` responde 501/`CAPABILITY_NOT_VERIFIED` sem ler o corpo, usar service role ou inserir inbox. Manter verificação JWT padrão do gateway: nenhum webhook público habilitado.

429 gera retry com backoff exponencial local (60–960 s; máximo cinco tentativas), sem presumir limites/Retry-After do fornecedor. Credencial expirada bloqueia a conexão; recuperação exige rotação autorizada pelo servidor. Interrupção/timeout/lease vencido gera `unknown`; não reenviar automaticamente. Replay exige operador com vínculo/permissão/unidade vigentes e `reconciled:true` para desconhecido. Falha na confirmação SQL preserva lease; tentativa posterior o classifica como desconhecido. Uma versão local ultrapassada termina em `dead/SUPERSEDED`. Não se presume ordenação nem reconciliação por webhook sem contrato.

Logs contêm apenas tenant/evento/correlação/código e marca de simulação. Não incluir headers, secrets, payloads, respostas brutas ou exceções. A ficha de teste contém somente dados previamente redigidos; não colar tokens ou conteúdo de pacientes. Detalhes, RPCs e homologação em [contrato FLW](../../docs/flw-adapter.md).
