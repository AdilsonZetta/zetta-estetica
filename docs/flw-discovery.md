# Discovery FLW — Prompt 00

Data da revisão: 14/11/2026. Escopo: laboratório isolado com dados sintéticos; nenhuma operação autenticada na FLW foi executada. Evidência documental é distinta de capacidade homologada. Todas as operações FLW continuam `CAPABILITY_NOT_VERIFIED`.

## Inspeção e fundação

O índice Git contém a especificação, o snapshot público FLW e `scripts/local-stack/bootstrap.sql`. A árvore de trabalho já continha arquivos não rastreados do laboratório, fixtures, manifests, testes e workflow; foram preservados. Não havia AGENTS.md nem README próprios, aplicação React, `supabase/config.toml`, migrations ou Edge Functions. Também faltavam este Discovery e o relatório da etapa. AGENTS.md em node_modules pertence às dependências.

O laboratório usa TypeScript, Vite e supabase-js; não é a fundação SaaS. O ambiente tem Node 24, npm, Chromium/Playwright e a pilha local descrita em [ambiente-de-execucao.md](ambiente-de-execucao.md): Auth/PostgREST em localhost:54321, Postgres em localhost:54322, sem Docker e sem Storage HTTP. Chaves ficam no cofre local, nunca neste documento. `.env.example` descreve somente variáveis públicas do laboratório. Não há Supabase hospedado disponível.

Comandos existentes: `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`, `npm test`, `npm run test:api`, `npm run test:e2e`. O workflow de Pages é manual e executa lint, unitários e build; não substitui a suíte local com backend. Sem arquivo de stack local, Playwright registra somente os dois projetos independentes de backend; solicitar um projeto Auth ausente falha explicitamente com projeto inexistente. Testes API exigem a stack e não são omitidos silenciosamente.

Estrutura mínima proposta para o Prompt 01: `src/` (React 19, TypeScript, router e Tailwind v4), `supabase/config.toml`, `supabase/migrations/`, `supabase/functions/`, seed sintético, `scripts/db-reset.sh`, testes SQL/RLS/API/Storage e instruções em README/AGENTS.md. Manter a prova reaproveitável e separar fixtures de dados operacionais.

## Fontes e limites

A [documentação pública](https://docs.flw.chat/) foi acessada novamente nesta revisão. A matriz usa o snapshot pesquisado em 14/11/2026 em [spec/flw](spec/flw/), cujos arquivos conservam URLs oficiais. Respostas `ask_icone.md` e `ask_api.md` são pistas de pesquisa, não contratos de integração. Ausência de descrição no material consultado significa pendência, não prova de inexistência do recurso. URL base, emissão de token, permissões e limites por conta ainda precisam de documentação autorizada da FLW.

Fontes específicas:

- F1: [Integrações](https://docs.flw.chat/guide/documentacao/ajustes/integracoes.md), snapshot `guide_documentacao_ajustes_integracoes.md`.
- F2: [API CRM de Vendas](https://docs.flw.chat/guide/novidades-do-sistema/maio-de-2026/29-05-2026-api-crm-de-vendas.md), snapshot de mesmo título.
- F3: [Sequências via API](https://docs.flw.chat/guide/documentacao/apps/sequencia/sequencias-via-api.md).
- F4: [Solicitar Pagamento](https://docs.flw.chat/guide/documentacao/atendimento/ferramentas-de-interacao/solicitar-pagamento.md) e [ativação do app](https://docs.flw.chat/guide/documentacao/apps/pagamentos/ativar-app-de-pagamento.md).
- F5: [Filtros de Webhooks](https://docs.flw.chat/guide/novidades-do-sistema/marco-de-2026/12-03-2026-filtros-de-webhooks.md) e [datas em Webhooks/API](https://docs.flw.chat/guide/novidades-do-sistema/outubro-de-2026/09-10-2026-novo-padrao-de-datas-em-webhooks-e-api.md).
- F6: [API — janeiro](https://docs.flw.chat/guide/novidades-do-sistema/janeiro-de-2026/21-01-2026-api.md).
- F7: [Habilidades de agentes](https://docs.flw.chat/guide/documentacao/apps/agentes-inteligentes/habilidades.md) e [Pergunta Dinâmica](https://docs.flw.chat/guide/documentacao/apps/chatbot/enviar-pergunta/pergunta-dinamica.md).
- F8: [Carteirização via API](https://docs.flw.chat/guide/documentacao/crm/carteiras/funcionamento-da-carteirizacao/carteirizacao-via-api.md).

## Matriz por operação

Em todas as linhas: ambiente de evidência = documentação pública, sem sessão FLW; teste autenticado = não executado; resultado operacional = pendente. “Interface” descreve a documentação, sem observação direta em conta. Responsáveis são papéis propostos, ainda sem pessoa designada: administrador da clínica (AC), suporte FLW (FLW), engenharia Zetta (EZ).

| Operação | Interface documentada / evidência | API, rota e escopo documentados | Prova humana pendente | Alternativa manual / responsável |
| --- | --- | --- | --- | --- |
| Ícone Gestão Estética por conta | Não confirmado no material consultado; `ask_icone.md` | Instalação e escopo por conta não documentados | Confirmar instalação independente nas contas A/B e destino correto | Link aprovado salvo pelo operador / AC + FLW |
| Abertura em aba ou iframe e retorno | Acesso web não prova incorporação de app externo | Sem contrato de embed ou origens documentado | Observar aba, iframe, bloqueios de navegador e retorno nas duas contas | Abrir URL externa e retomar aba FLW / AC + EZ |
| SSO ou token formal | Não confirmado; OTP de WhatsApp não estabelece SSO Zetta | Emissor, audience, assinatura, expiração e troca não documentados | Obter contrato oficial antes de qualquer implementação | Supabase Auth independente / FLW + EZ |
| Consulta de contato | Habilidades podem ler campos do contato (F7) | Não há rota pública de consulta comprovada no snapshot; escopos pendentes | Ler apenas contato sintético da conta autorizada; provar isolamento | Localizar contato na conta e vincular referência revisada / AC + EZ |
| Leitura de painéis e cards | CRM e painéis descritos em F2 | `GET /v2/panel` (type SALES/MANAGEMENT), `GET /v2/cards` (statuses/includeDetails), `GET /v1/panels/{panelId}/lost-reasons`; base, autenticação e grants pendentes | Comparar leitura autenticada ao CRM em A/B, incluindo paginação e acesso negado | Consultar CRM e copiar referência / AC + EZ |
| Atualização de card | Estados de CRM descritos em F2 | `PUT /v3/panel/card/{id}`, status em fields; WON/LOST somente SALES; card finalizado não muda etapa sem reabrir. Grants pendentes | Alterar e conferir card sintético; rejeição de conta alheia e estado inválido | Atualizar manualmente o CRM / AC + EZ |
| Tarefas | Habilidade Criar Card no CRM admite tarefa, título, prazo e etiquetas (F7); módulo específico de tarefas não comprovado | Rota, payload e permissões não documentados | Confirmar existência e testar criar/consultar/concluir em conta autorizada | Tarefa manual acompanhada pela clínica / AC + FLW + EZ |
| Pagamento | App Pagamentos/Asaas e solicitação no atendimento (F4) | Token do provedor não demonstra API de cobrança da FLW; rota e escopos pendentes | Validar app habilitado, cobrança de teste e retorno de status sem cobrança real | Operador autorizado solicita e confere pagamento / financeiro da clínica + EZ |
| Webhooks recebidos da FLW | Configurações/filtros citados (F1/F5) | Eventos filtráveis e datas documentados; assinatura, retries, autenticação e vínculo por conta pendentes | Capturar evento sintético, validar origem, duplicação, ordem e roteamento A/B | Conferir mudanças no CRM e registrar tarefa / AC + EZ |
| Disparar fluxo/sequência | Sequências e contatos descritos (F3) | GET listar sequências/contatos; POST adicionar; DEL remover; ID de sequência + contato/telefone. Caminhos HTTP literais e escopos não fornecidos. Disparo genérico de fluxo não comprovado | Testar sequência fictícia e repetição sem duplicar inclusão; confirmar contrato de fluxo | Operador executa fluxo aprovado / AC + EZ |
| Enviar mensagem | Envio e identificação de atendente descritos em F6 | Operações “Mensagem → Enviar/Enviar Síncrono”; caminho e grants pendentes | Destinatário de teste autorizado, entrega e conta corretas | Enviar pelo atendimento FLW / AC + EZ |
| Agentes chamarem ferramentas externas | F7 descreve Acionar API (URL, método, headers e body), Acionar Fluxo e consulta a servidor MCP; Pergunta Dinâmica usa webhook POST | Chamadas externas configuráveis pelo agente são documentadas; a URL é a do sistema Zetta, não rota FLW. Headers de autenticação são configuráveis; identidade da conta, escopos e garantias operacionais precisam de prova | Configurar habilidade em A/B e testar método, headers, payload mínimo, timeout e conta correta; não presumir autorização pelo body | Agente encaminha para equipe humana / FLW + AC + EZ |
| Carteirização/distribuição | Carteiras e integração citadas em F8 | Operações Carteiras para adicionar/remover por ID de carteira e ID/telefone do contato; comportamento de equipe/atendente documentado; caminhos e grants pendentes | Confirmar contrato e testar atribuição na conta de homologação | Distribuir manualmente pela equipe / AC + EZ |

## Opção de abertura e identidade

A decisão provisória é URL externa em nova aba e Supabase Auth independente. O link transporta somente o slug sintético; não concede autorização. `VITE_FLW_RETURN_URL` é configuração aprovada HTTPS, sem credenciais, query ou fragmento. Parâmetros de SSO/token/retorno enviados à prova são descartados. Não há SSO implementado. Iframe é hipótese; detectar `window.self !== window.top` informa contexto, sem provar suporte pela FLW.

O laboratório possui os destinos `clinica-aurora` e `clinica-horizonte` (fixtures `simulated: true`), demonstra `CAPABILITY_NOT_VERIFIED`, login por senha sintética, persistência, checagem inicial de identidade no servidor, refresh e logout. `getUser()` confirma identidade aceita pelo Auth; não substitui membership/RLS nem garante revogação imediata de todo JWT já emitido. Validação de vínculo, convite e OTP pertencem ao Prompt 03. Falha no logout remoto encerra o estado local pelo SDK e informa que a revogação remota não foi confirmada.

A build entrega `dist/integration-lab/index.html`, além da raiz e do fallback 404. O servidor estático precisa suportar índice de diretório ou redirecionar `/integration-lab` para `/integration-lab/`; o fallback 404 não é evidência de HTTP 200. O preview local é coberto por testes; o host externo ainda exige verificação.

## Evidência local e pendências externas

Os resultados e comandos reproduzíveis estão em [etapas/prompt-00.md](etapas/prompt-00.md). A suíte cobre duas identidades GoTrue locais e duas clínicas fictícias; isso **não representa duas contas FLW**. O retorno de teste `flw.example.invalid` verifica somente a configuração do link. Screenshots herdados em `evidencias/prompt-00-desktop.png` e `prompt-00-mobile.png` ilustram o laboratório anterior; não são prova desta revisão ou de execução dentro da FLW.

Não existe URL de homologação externa autorizada disponível. GitHub Pages está indisponível no plano do repositório privado conforme o registro do ambiente (HTTP 422 herdado; não revalidado nesta revisão). O workflow manual apenas prepara o caminho caso o serviço seja habilitado. Não houve publicação nem mudança de plano, domínio ou permissões. Também faltam contas e credenciais FLW autorizadas e Supabase hospedado. Assim, destino pelo ícone, aba/iframe, retorno real, login/logout, expiração e mobile dentro da FLW estão todos **pendentes em A e B**.

## Roteiro humano de homologação

1. Zetta designa responsáveis, duas contas FLW de homologação, usuários e URL HTTPS autorizada com backend de homologação. Guardar credenciais no cofre; obter contrato de API com base, autenticação, grants, limites e payloads redigidos junto à FLW.
2. EZ publica o build no destino autorizado e verifica GET da rota direta, com e sem barra, query de cada clínica e reload com HTTP 200. Não usar localhost como prova de acesso pela FLW.
3. AC/FLW confirma se é possível instalar o ícone Gestão Estética em cada conta. Registrar conta redigida, instalador, data, versão, nome do ícone e URL exata. Se impossível, registrar limitação e aceitar explicitamente o link externo manual.
4. Em A e B, clicar no ícone e registrar destino, modo real (aba/iframe), comportamento de popup e ação de retorno. Validar que slug adulterado não concede vínculo quando a fundação e o Prompt 03 estiverem disponíveis.
5. Em ambas, entrar com identidade sintética independente, recarregar, sair e reabrir; expirar a sessão e observar refresh/reautenticação. Testar falha de rede, sessão rejeitada e logout remoto indisponível. Registrar qualquer bloqueio de storage/cookies em iframe; oferecer abertura externa se necessário.
6. Repetir abertura, retorno e ciclo de sessão em desktop, Android e iOS reais, anotando navegador, versão e dispositivo. Chromium com Pixel 7 emulado não valida Safari/iOS nem o aplicativo FLW.
7. Para cada linha da matriz, EZ e AC executam leitura/alteração apenas com dados sintéticos na conta correta, confrontam interface e API, testam conta alheia, limites e erros, coletam resultado redigido e restauram o dado de teste. Sem rota oficial ou credencial autorizada, manter a tarefa manual e a capacidade desabilitada. Nenhum envio ou pagamento real é autorizado por este roteiro.
8. Registrar por cenário: data, responsável, versão, conta redigida, URL sem segredos, dispositivo, esperado/observado, status (passou/falhou/pendente), screenshot/log redigido e alternativa manual aceita. Somente então habilitar a capacidade demonstrada.

## Critérios de entrada do Prompt 01

- Discovery e laboratório revisados, comandos locais verdes e limites de evidência explícitos.
- Usar a stack prevista no ambiente; preservar a prova e fixtures sintéticas. Criar fundação e migrations apenas no Prompt 01.
- Usar o backend local disponível, manter chaves privilegiadas fora do frontend e planejar portabilidade para Supabase hospedado.
- Implementar tenants/units/profiles/memberships e autoridade no banco com grants/RLS, referências compostas e testes negativos A/B, revogação e Storage conforme o Prompt 01.
- Aceitar a dependência externa documentada para avançar localmente; manter ícone, SSO, iframe e adaptador automático pendentes. A fundação não pode assumir que os testes FLW passaram. Homologação externa continua requisito antes de habilitar integração real.
