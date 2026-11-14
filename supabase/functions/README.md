# Edge Functions

Nenhuma integração externa é habilitada no Prompt 01. Autorização e transações estão nas funções PostgreSQL versionadas em `../migrations/`. Integrações futuras devem ser criadas aqui, com identidade verificada, escopo validado no banco e segredos exclusivamente no servidor. O envio de convite Auth está manual e pendente de SMTP; não há remetente automático nesta etapa.
