# Prompt 01 — Fundação SaaS com Supabase

Implementação local em 14/11/2026. Somente Prompt 01; sem commit/push ou aplicação remota. Autoridade multiempresa implementada e validada no PostgreSQL local real. Pendências HTTP de Storage e envio de e-mail estão separadas dos testes aprovados.

## Arquivos entregues e preservação

- `supabase/migrations/202611140001_foundation.sql`: tenants, units, profiles, vínculos, unidades dos vínculos, convites, base `core` de entitlements, autoridade administrativa privada, papéis/permissões, trigger Auth, auditoria, RLS, grants por coluna e RPCs autorizadas; bucket privado e políticas de objetos.
- `supabase/migrations/202611140002_invitation_lifecycle.sql`: histórico de aceite compatível com exclusão Auth, emissor do convite, validação de autoridade vigente e revogação de convites associados. Índices de escopo.
- `supabase/migrations/202611140003_unit_scopes.sql`: consulta de equipe e eventos de auditoria restritos à unidade; grants explícitos de objetos Storage.
- `supabase/config.toml`, `supabase/seed.sql`, `supabase/functions/README.md`: configuração portável, dados sintéticos separados das migrations e fronteira das futuras Edge Functions. As funções desta etapa são PostgreSQL e estão nas migrations; nenhuma integração externa foi habilitada.
- `scripts/db-reset.sh`, `scripts/local-stack/start.sh`, `scripts/seed-local.mjs`, `scripts/generate-types.mjs`, `scripts/test-db.mjs`: reset exclusivamente local, reaproveitamento de serviços, cadastro público desabilitado, identidades pela API Admin, geração de tipos e executor pgTAP que falha em erro SQL/plano/assertiva.
- `src/entry.ts`, `src/main.tsx`, `src/style.css`, `src/database.types.ts`: shell React autenticado, contextos de clínica/unidade, proteção de administração, estados de carregamento/vazio/erro, convite e aceite. Design branco, orbes escuros, vidro, lima, fontes Inter/Inter Tight e redução de movimento/transparência. Tipos gerados do banco local, somente schema público.
- `tests/foundation-support.mjs`, `tests/foundation-api.test.mjs`, `tests/foundation-concurrency.test.mjs`, `supabase/tests/foundation.sql`, `tests/e2e/shell.spec.ts`, `tests/e2e/shell-offline.spec.ts`: novas suítes e fixtures de sessões de usuário.
- `README.md`, `AGENTS.md`, `.env.example`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `.github/workflows/deploy.yml`: inicialização, convenções, dependências, entradas separadas shell/laboratório e pipeline.
- `tests/e2e/lab.spec.ts`: o cenário de troca de destino passa a abrir explicitamente a rota do laboratório, pois a raiz agora é a aplicação. As demais verificações anteriores foram mantidas. O fallback SPA reconhece também o link antigo sem barra final.

O status Git inicial estava limpo. Durante a execução, `docs/ambiente-de-execucao.md` recebeu uma atualização externa sobre Pages público e o novo projeto Supabase; essa alteração foi lida e preservada. Conforme sua instrução, o workflow passou a aceitar push em main e chave publishable, mantendo workflow_dispatch e apenas lint/unitários/build no CI. Não houve publicação nesta etapa.

## Modelo e evidência de autorização

Duas clínicas fictícias (Aurora e Horizonte), três unidades (incluindo uma restrita), quatro identidades demo distintas. `a@example.com` administra Aurora/Centro; `b@example.com` administra Horizonte/Centro; `multi@example.com` tem dois vínculos de gerente; `revogado@example.com` possui vínculo revogado. Senha demo `Demo@123456`. Não foi criada conta para o e-mail administrativo real.

O banco verifica `auth.uid()`, tenant ativo, vínculo ativo, permissão privada, entitlement vigente e unidade atribuída/ativa. Papel global Zetta não concede vínculo operacional. A whitelist privada só promove automaticamente o e-mail autorizado após confirmação no Auth. O teste do bootstrap usa um endereço sintético em transação revertida; não cadastra o endereço real. Metadados Auth não promovem usuários.

Todas as relações operacionais possuem tenant obrigatório e referências compostas. Não há views expostas. Schemas administrativos não são publicados na Data API; authenticated possui somente USAGE para helpers com execução restrita, sem acesso direto às tabelas privadas. Funções SECURITY DEFINER fixam search_path vazio e validam escopo; funções trigger não são executáveis pelo cliente. INSERT/DELETE diretos em autoridade e mudanças de papel, vínculo, tenant_id, estado e entitlement são negados. UPDATE de nome da unidade e nome próprio usa grants por coluna e RLS com WITH CHECK. RPCs de convite/revogação e seus eventos são transacionais; aceite usa bloqueio de linha e é idempotente. Não há rotina pública de reativação/promoção global.

A/B e revogados foram exercitados via PostgREST com JWTs obtidos do Auth real. A suíte mantém o mesmo access_token depois de revogar um novo vínculo e prova: SELECT vazio, UPDATE sem linhas, RPC negada e permissão Storage falsa. B continua autorizado. No SQL, a revogação também remove o acesso A de um usuário com dois vínculos sem afetar seu acesso B. Alterar módulo, expiração, estado do tenant ou unidade bloqueia o mesmo contexto sem reemitir token.

## Comandos executados e resultados

| Comando | Resultado final |
| --- | --- |
| `git status --short`, `git log -3 --oneline`, leituras de instruções, manifests, CI e especificação | Inspeção concluída; sem alterações iniciais; atualização externa preservada |
| `npm install react@19 react-dom@19 react-router-dom tailwindcss@4 @tailwindcss/vite@4` e instalação de tipos/plugin React/Supabase CLI | Dependências instaladas, lock atualizado; audit com 0 vulnerabilidades |
| `psql ... -v ON_ERROR_STOP=1 -f supabase/migrations/...` e `notify pgrst, 'reload schema'` | Aplicação local incremental real durante desenvolvimento |
| `npm run db:reset` | Passou na validação final: banco local recriado, três migrations em ordem, quatro identidades e seed aplicados |
| `npm run db:types` | Tipos gerados do PostgreSQL local; CLI 3.1 informa depreciação futura de `--db-url`, sem impedir geração |
| `npm run test:db` | **72/72** assertivas pgTAP passaram; inclui SELECT/INSERT/UPDATE/DELETE, RPC, grants, RLS, FK composta, unidades, autoridade global, entitlements e Storage |
| `npm run test:api` | **16/16** resultados passaram (2 testes principais + 14 subtestes), incluindo os 7 resultados Auth anteriores |
| `npm run test:concurrency` | **1/1** teste passou: 12 aceites simultâneos geram um vínculo/atribuição, 6 revogações e 6 reaceites não restauram acesso |
| `npm test` | **7/7** testes unitários anteriores passaram |
| `npm run build` | Passou: TypeScript, Vite, shell, laboratório e `dist/404.html` |
| `npm run lint` | Passou, sem warnings |
| `npx playwright test tests/e2e/lab.spec.ts tests/e2e/auth.spec.ts --project=desktop --project=auth-local` | **12/12** testes afetados passaram após corrigir o fallback |
| `npx playwright test tests/e2e/auth.spec.ts --project=auth-mobile-chromium -g 'falha remota'` | **1/1** passou em 4,7 s após timeout na execução completa anterior |
| `npm run test:e2e` | **36/36** passaram em 52,5 s: 24 cenários anteriores + 12 do shell, desktop e Pixel 7 emulado |
| `git diff --check` | Passou na revisão final (arquivos rastreados e novos) |

Falhas encontradas e corrigidas: o seed inicial revelou ausência de identificador de evento para entitlement (incluída module_key); a primeira escrita de assertivas SQL precisava de CTE de alteração no nível superior; cleanup Auth revelou FK de convite que impedia exclusão de usuário (corrigida para SET NULL, preservando accepted_at); o processo local precisava sobreviver ao terminal (setsid). A primeira execução E2E teve 22 falhas por fallback do laboratório e 14 sucessos; após corrigir a entrada, os 12 cenários desktop afetados passaram. A execução seguinte teve 35 sucessos e um timeout de 30 s no teste anterior de logout mobile, sem erro funcional identificado; o teste isolado passou. O resultado consolidado final consta na tabela, sem omitir essas ocorrências.

## Storage: aprovado e bloqueado

Bucket `foundation-test` privado, limite 1 MiB e MIME text/plain. Prefixo `<tenant UUID>/<unit UUID>/<arquivo>`. pgTAP executou SELECT equivalente à autorização de download, INSERT/upload, UPDATE e DELETE como authenticated com claims dos usuários reais de teste. Confirmou: A e B operam objetos próprios; objetos do outro tenant e da unidade não atribuída são negados; mover objeto entre escopos falha no WITH CHECK; após revogação, SELECT/download e INSERT são bloqueados. DELETE/UPDATE cruzados não alcançam linhas.

**HTTP Storage não homologado:** a stack fornecida só tem tabela/storage emulada e não tem API Storage HTTP. A requisição autenticada real a `/storage/v1/object/authenticated/...` retornou **404**, e o teste registra exatamente esse bloqueio. Não houve upload/download de bytes, teste de link assinado ou servidor Storage simulado. É necessário repetir essa matriz no Supabase com Storage real usando sessões de usuário, nunca service_role.

## Dependências e pendências

Dependências novas: React/React DOM 19, react-router-dom, Tailwind 4, plugin Tailwind/Vite, plugin React/Vite, tipos React e CLI Supabase 3.1 no lock. PostgreSQL 17, pgTAP 1.3.3, GoTrue 2.197, PostgREST, proxy local, psql e Chromium são dependências do ambiente. Chaves locais continuam no cofre, sem valores reais em `.env.example` ou código do navegador.

- Envio real de convite: não há SMTP local. O shell registra convite e informa envio pendente. Testes geram link Auth via API Admin apenas para preparar a identidade, verificam o token pelo Auth e aceitam com sessão pública. A entrega de e-mail e redirects externos continuam pendentes.
- Fluxo inicial permite convidar, aceitar e revogar; mudança de papel, novas atribuições a vínculo existente e reativação exigem revisão administrativa no servidor e não foram expostas ao cliente. Não há provisionamento/planos/console completo do Prompt 02.
- Aplicação remota depende do orquestrador: o ambiente informa projeto `ijjhtfryawtjoxvprjix`, sa-east-1, mas não houve conexão remota nem confirmação/aplicação por este agente.
- Pages foi liberado no arquivo do ambiente durante a etapa. Workflow atualizado e fallback gerado; execução hospedada e redirects Auth ainda não verificados por este agente.
- Sem conta FLW: ícone Gestão Estética, iframe/SSO, retorno e comunicação automática permanecem pendentes conforme Discovery. Nenhuma capacidade externa foi habilitada. Mobile é Chromium Pixel 7 emulado, não aparelho físico.

## Instruções de homologação

1. Reproduzir os comandos do README na stack local e entrar com A/B/multi/revogado. Confirmar unidade restrita ausente e tentar as rotas `/clinicas/clinica-horizonte/admin` como A e `/admin` como admin da clínica: negar. Use a conta multi para alternar clínicas.
2. Antes de qualquer operação remota, confirmar projeto/ref, região e autorização com o responsável. Aplicar somente `supabase/migrations/*.sql` em ordem; **não** executar bootstrap emulado nem seed demo em produção. As migrations não dependem de tabelas/funções exclusivas da emulação.
3. Configurar URL/chave pública e SMTP/redirects Auth do projeto confirmado. Manter signup público desabilitado. Registrar convite no shell; operador autorizado enviar via Auth no servidor com redirect exato `/convites/<id>`. Abrir link, definir senha e aceitar. Testar e-mail diferente, expiração, revogação e reaceite. Nunca compartilhar tokens ou chaves privilegiadas como evidência.
4. Criar identidades sintéticas A/B/multi/revogada no ambiente de homologação autorizado e repetir RLS/API com JWTs de usuário. Verificar que não existem políticas Storage amplas de outro módulo que autorizem o bucket de teste por OR.
5. No Storage real, repetir upload, download (conferir bytes), update e remove para A/B/revogado e unidade não atribuída. Revogar um vínculo preservando seu JWT; repetir operações e confirmar bloqueio imediato para novas requisições, preservando B. Não emitir URL pública nem considerar URL assinada ainda válida como prova de revogação por RLS.
6. Executar workflow Pages e validar fallback SPA, login/retorno Auth e mobile reais. Homologação FLW segue roteiro separado do Discovery. Registrar resultados externos sem substituir estes resultados locais.

## Revisão Gemini

Revisor informado: **gemini-4-hydrogen / gemini-4-hydrogen**. Revisão em 14/11/2026 sobre a árvore completa, incluindo arquivos não rastreados. As alterações preexistentes foram preservadas; sem commit/push, publicação ou acesso ao projeto hospedado. Correções SQL em `supabase/migrations/202611140004_review_hardening.sql`, sem reescrever as três migrations anteriores.

1. **Corrigido — FKs da auditoria.** Removidas somente as duas FKs de `audit_logs` para tenant/unidade. A auditoria preserva UUIDs e eventos após exclusão administrativa, inclusive os eventos AFTER DELETE. As demais FKs operacionais continuam protegendo dependências; o cliente não ganhou DELETE. pgTAP exclui uma unidade e seu tenant sem dependências e confirma ambos os eventos históricos.

2. **Corrigido — unidade ativa e auditoria de equipe.** `private.is_allowed(t,null,...)` passa a exigir pelo menos uma unidade atribuída ativa. SELECT de tenant/entitlement/auditoria e administração deixam de funcionar quando não há atribuições vigentes. Eventos de `tenant_memberships` registram `scope_unit_ids`, um snapshot das unidades; a leitura exige `audit.read` em todas elas. Eventos antigos ou sem escopo exigem permissão em todas as unidades do tenant. Isso protege também auditores, sem exigir indevidamente `members.manage`, e mantém o histórico protegido depois da remoção de atribuições. Eventos de configuração do tenant/entitlement continuam disponíveis como metadados compartilhados do tenant; eles não contêm dados de equipe. Testes cobrem admin/auditor Centro versus Restrita, remoção de atribuições e desativação de unidades.

3. **Corrigido — reaceite de convite revogado.** Revogação, tenant/unidade ativos, core vigente e autoridade do emissor são conferidos antes do retorno idempotente. Esse retorno exige vínculo ativo e atribuição à unidade original. Um convite pendente expirado é negado; expirar o prazo de um convite já aceito não desfaz o aceite concluído, mas nenhum reaceite ignora revogação ou bloqueio atual. API e concorrência agora exigem explicitamente erro **42501** após revogação, além de confirmar ausência de acesso; pgTAP cobre bloqueios individuais.

4. **Descartado — fallback SPA supostamente ausente.** O `package.json` já executava `node scripts/spa-fallback.mjs` depois do Vite; esse script copia `dist/index.html` para `dist/404.html`. O workflow chama esse build e publica `dist`. Build e comparação byte a byte confirmam a geração. No GitHub Pages, o documento personalizado de erro pode servir a aplicação com status HTTP 404; a cópia permite carregar a rota SPA, sem prometer status 200 nem provar homologação externa.

5. **Corrigido — chave anon Base64URL.** Extraída a validação para `src/public-key.ts`, convertendo `-`/`_` e repondo padding antes de `atob`. Regressões usam payload com ambos os caracteres e sem padding; também verificam rejeição de service_role/payload inválido e aceitação de publishable. É validação de configuração pública, não verificação criptográfica de JWT nem autorização.

6. **Descartado — proprietário diferente não prova falha de policies/grants.** O Supabase recomenda [políticas SQL em storage.objects](https://supabase.com/docs/guides/storage/security/access-control). Sua [configuração oficial do PostgreSQL](https://github.com/supabase/postgres/blob/develop/ansible/files/postgresql_config/supautils.conf.j2) concede a `postgres` administração dessas policies por `supautils.policy_grants`, mesmo sem ownership. A [documentação de privilégios gerenciados](https://supabase.com/kb/troubleshooting/revoking-privileges-on-storage-pg_cron-vault-and-extension-objects-has-no-effect-916576) distingue ownership de privilégios com grant option. Portanto, não se retiraram policies das migrations nem se alterou o proprietário/papel interno. A árvore aplica tudo localmente; **não** se verificaram privilégios específicos do MCP/projeto `ijjhtfryawtjoxvprjix`. A homologação remota deve conferir papel de deploy, configuração `supautils.policy_grants`, ACLs e grants efetivos antes de aplicar. Se o ambiente diferir do padrão, o operador deve resolver a permissão administrativa, sem omitir silenciosamente políticas. O teste local não comprova permissões hospedadas.

7. **Corrigido — senha obrigatória e formulários sem recuperação.** Senha opcional no aceite: em branco, não chama `updateUser`. Definição de senha continua disponível para conta recém-convidada. Invitation e MemberAdmin usam `try/catch/finally`; falhas liberam os botões e exibem mensagem. E2E cobre nova senha, aceite sem alterar senha existente e falhas de transporte seguidas de nova tentativa nos dois formulários.

8. **Corrigido — tratamento assíncrono e erro persistente.** Home/Platform têm proteção de desmontagem e catch; a checagem de permissão da Clinic trata tanto erro retornado quanto rejeição. Logout trata exceção/erro, tenta remover a sessão local e sempre limpa o estado; sessão válida no callback Auth limpa a mensagem anterior. Os builders PostgREST são PromiseLike, portanto usam `Promise.resolve` antes de catch. **Descartada a generalização** de que toda falha de rede rejeita a promise: o SDK instalado normalmente retorna `{ error }` e repete GETs com backoff; os estados anteriores já tratavam vários desses erros. E2E comprova estados finais de erro e logout com armazenamento local limpo seguido de novo login sem mensagem antiga.

9. **Corrigido — vínculo existente e erro 23505.** Emissão recusa e-mail já vinculado ao tenant, inclusive revogado. Aceite recusa vínculo preexistente com **42501**, sem mudar papel/estado. Advisory lock transacional por tenant/usuário serializa convites distintos, além do bloqueio de linha do convite; violação de unicidade na inserção do vínculo também é convertida em erro genérico. Testes API cobrem vínculos ativos/revogados e convites emitidos antes do vínculo existir; concorrência disputa dois convites da mesma identidade e exige um sucesso e uma negação 42501.

10. **Corrigido — bootstrap e reativação automática.** O trigger dispara em INSERT ou UPDATE de e-mail/confirmação, não em qualquer atualização Auth. `ON CONFLICT DO NOTHING` mantém decisões administrativas posteriores. Removido o evento manual adicional: o trigger de `platform_memberships` gera um único INSERT auditado no bootstrap. pgTAP usa whitelist sintética em rollback, exige um evento e confirma que atualização Auth não promove nem reativa papel rebaixado/inativo. O e-mail real autorizado não foi cadastrado.

11. **Corrigido — reinício após SIGTERM.** Reset aguarda encerramento dos PIDs locais por até 10 segundos, considera processo zumbi já encerrado e aborta antes de recriar o banco se algum serviço continuar vivo. Não inicia servidor concorrente nem usa SIGKILL. Reset completo exercitado com os serviços existentes e reaplicação das quatro migrations; `bash -n` também passou.

12. **Corrigido — formato mínimo de e-mail.** RPC exige parte local/domínio, ponto no domínio e ausência de espaços/@ extras, com erro 42501. Constraint adicional aplica o mesmo formato às novas escritas administrativas; `NOT VALID` preserva possíveis registros legados, sem desabilitar a verificação em novas escritas/updates. Não pretende validar entrega nem toda a RFC. API recusa `@`, `a @ b` e `a@b`; pgTAP confirma a constraint.

### Validação desta revisão

A primeira execução de verificação encontrou duas assertivas novas que contavam também eventos antigos legitimamente visíveis, além de um erro TypeScript por catch em PromiseLike. As assertivas foram delimitadas ao escopo restrito e os builders envolvidos passaram a `Promise.resolve`. A primeira chamada API do novo validador encontrou ambiguidade entre argumento/coluna `email`; o argumento foi qualificado. A primeira suíte E2E terminou com 40 sucessos e duas falhas do teste novo de falha de GET: a espera padrão de 5 s era menor que o backoff automático de 1+2+4 s do SDK. Ajustada para 15 s nesse ponto; a execução isolada desktop/mobile passou **2/2** em 21,6 s. Esses resultados intermediários não são apresentados como aprovação final.

A segunda execução completa terminou com **41/42** aprovados e timeout em um cenário anterior do laboratório mobile (configuração ausente). Sem alterar esse teste, ele passou isoladamente em **300 ms** (comando em 3,2 s); a execução completa subsequente passou **42/42** em **1,1 min**. Não foi identificada falha funcional nesse timeout, que permanece registrado como instabilidade observada.

| Verificação final | Resultado |
| --- | --- |
| `npm run db:reset` | Passou; quatro migrations aplicadas em ordem, Auth/seed locais prontos; um processo Auth e um PostgREST após o reinício |
| `npm run db:types` | Passou; tipos públicos atualizados com `scope_unit_ids`; aviso da CLI sobre futura depreciação de `--db-url` |
| `npm run test:db` | **96/96** assertivas pgTAP: 72 anteriores + 24 novas; inclui Storage SQL/RLS |
| `npm run test:api` | **17/17** resultados aprovados, sem skips; Auth/PostgREST reais e sessões de usuário |
| `npm run test:concurrency` | **2/2** aprovados; 12 aceites idempotentes, 6 revogações/reaceites negados e disputa entre convites distintos |
| `npm test` | **9/9** aprovados: 7 anteriores + 2 de chave pública |
| `npm run build` | Passou: TypeScript/Vite e geração de fallback SPA |
| `cmp dist/index.html dist/404.html` | Passou; arquivos idênticos |
| `npm run lint` | Passou, sem warnings |
| `npm run test:e2e` | **42/42** aprovados em 1,1 min; quatro projetos desktop/mobile, incluindo os cenários anteriores |
| `bash -n scripts/db-reset.sh` | Passou |
| `git diff --check` e verificação equivalente dos arquivos não rastreados | Passaram |

Continuam pendentes **Storage HTTP real, SMTP/entrega de convites, aplicação hospedada/ACLs do projeto e navegação externa no Pages/FLW**. A ausência de API Storage local permanece explicitamente verificada como 404; a aprovação de Storage refere-se às políticas SQL e não a upload/download HTTP. Nenhuma operação remota, commit ou push foi realizada.
