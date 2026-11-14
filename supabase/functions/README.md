# Edge Functions

`invitation-delivery` (Prompt 02) é o remetente separado de convites Auth. Recebe POST `{ "invitation": "UUID" }` com sessão do usuário, verifica autorização pela RPC `request_invitation_delivery`, obtém lease privado como servidor, chama `/auth/v1/invite` com redirect fixado por configuração e confirma o resultado no banco. Não utiliza payloads/URLs livres para o redirect nem retorna mensagens brutas do Auth.

Configuração somente no servidor: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL` (incluindo base `/zetta-estetica`, sem barra final) e `APP_ORIGIN` (origem exata, sem path). Não use prefixo `VITE_` para segredos. `APP_URL` deve constar na allowlist de redirects Auth. SMTP é pré-requisito para entrega.

`npm run test:edge` executa cinco testes Deno do handler com transportes controlados. A suíte SQL/API exercita a máquina de estados real (pending/sending/failed/sent, lease e tentativas). Nenhum desses resultados comprova entrega SMTP. Não foi iniciado servidor Edge HTTP local. Publicação depende de confirmação do projeto e autorização remota.

Retry de falha é autorizado por usuário; lease ocupado impede concorrência e expira em dois minutos. Uma queda após aceitação pelo Auth e antes da confirmação SQL pode exigir retry e produzir outro e-mail. `sent` confirma aceitação pelo Auth, sem prometer entrega. Conta Auth já existente pode exigir orientação manual para login e aceite do convite vigente. Suspensão, revogação e expiração impedem novo claim; uma chamada externa já em curso não pode ser desfeita por PostgreSQL.


Prompt 03: `APP_URL` precisa ter a mesma origem exata de `APP_ORIGIN`, sem credenciais, query ou fragmento; HTTPS obrigatório fora de localhost. O destino enviado ao Auth é sempre `/convites/<UUID>` sob essa base. Aplique `supabase/templates/invite.html` no template Invite do projeto confirmado: contém código Auth e a URL aprovada, sem parâmetro livre de retorno. Configuração completa e limites em [Auth por ambiente](../../docs/auth-ambientes.md). Os testes Deno usam transportes controlados; a verificação de código nos testes API/E2E usa GoTrue real, sem comprovar SMTP.
