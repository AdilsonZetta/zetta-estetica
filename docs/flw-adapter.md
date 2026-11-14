# Contrato do adaptador FLW v1

Esta etapa não dispõe de conta/credencial FLW nem de prova autenticada. Todas as capacidades permanecem `pending/CAPABILITY_NOT_VERIFIED`, inclusive quando uma ficha de teste é registrada. `read_only/supported` são estados preparados no schema; não existe RPC para habilitá-los nem transporte real nesta versão. Uma futura habilitação exige revisão, contrato oficial e prova no projeto confirmado, além de implementação específica do transporte.

## Contrato interno e autoridade

Interfaces `ContactPort.lookup`, `CardPort.update`, `ChargePort.create` e `AutomationPort.trigger` representam respectivamente `contact.lookup`, `card.update`, `charge.create`, `automation.trigger`. Não são rotas FLW. Recebem IDs internos/correlação e marca `simulated`; nenhum payload clínico é armazenado. A entidade referenciada nesta etapa é uma intenção de integração UUID, sem antecipar tabelas de agenda, propostas ou recebíveis. A conclusão manual não liquida recebível, não altera card nem prova pagamento.

Permissão `integrations.manage` é exclusiva do admin clínico e exige módulo `core`, tenant ativo, vínculo ativo e unidade atribuída/ativa. Papéis globais não conferem acesso. As operações atuais registram intenções do núcleo; futuras operações de módulos deverão validar também a permissão e o entitlement específicos na transação de negócio. Slug, conta FLW e metadados Auth não autorizam. Worker revalida o emissor com os mesmos critérios antes de cada claim. Operações já iniciadas seguem a semântica transacional; revogação posterior não desfaz efeito externo em andamento.

Todas as tabelas ficam em `private`, com RLS sem políticas públicas e sem grants diretos para anon/authenticated/service_role. Somente RPCs específicas expõem projeções redigidas ou efetuam mutações autorizadas. Schema privado não é publicado. Funções definer usam `search_path=''` e nomes qualificados. Claim/finish exigem `auth.role()='service_role'` e EXECUTE exclusivo desse papel. Usuários chamam somente RPCs operacionais com sua sessão.

| Relação | Chave fixada pelo contrato |
| --- | --- |
| `tenant_integrations` | `(tenant_id,provider)`; conta comprovada `(provider,account_ref)` exclusiva, inicialmente nula |
| `integration_capabilities` | `(tenant_id,integration_id,capability)` |
| `outbox_events` | `(tenant_id,integration_id,operation,entity_id,entity_version)`; contrato v1 |
| `integration_deliveries` | `(tenant_id,event_id,rule_key,integration_id)`; regra `zetta.v1` |
| `webhook_inbox` | `(tenant_id,integration_id,provider_event_id)`; reservado, sem ingresso habilitado |
| `integration_manual_tasks` | `(tenant_id,event_id)` |

Todas as relações possuem tenant obrigatório e FKs compostas. IDs históricos de ator/correlação não autorizam. Repetir intenção retorna evento, entrega e correlação originais; trocar unidade ou simulação usando a mesma chave é recusado. Tarefa, evento, entrega e auditoria são criados na mesma transação. Futuras RPCs de negócio devem gravar seus eventos nessa mesma transação, sem depender de segundo POST do navegador.

## Operação manual

Entre como admin da clínica, selecione a unidade e abra **Administrar equipe → Integração FLW · modo manual**. Registre contato, card, cobrança ou automação. A equipe executa a ação na conta FLW correta e conclui a tarefa com um identificador opaco (letras, números, `_` e `-`, até 100 caracteres). Não inserir URL com token, telefone, mensagem ou dado clínico. O registro conserva `CAPABILITY_NOT_VERIFIED` e não alega execução automática. Outros papéis podem encaminhar a demanda ao admin; não recebem autorização implicitamente.

RPCs com sessão de usuário:

- `request_flw_operation(tenant,unit,operation,entity,version,correlation,simulation=false)` cria a intenção; no modo padrão sempre manual.
- `flw_work_candidates(tenant,unit)` valida a autoridade e seleciona até dez simulações elegíveis, das mais antigas às recentes: respeita backoff, tentativas, emissor e conexão; leases vencidos entram somente para reconciliação pelo claim.
- `flw_operations(tenant,unit)` lista entregas/tarefas dessa unidade, sem credenciais/payloads.
- `complete_flw_manual_task(tenant,task,reference)` registra conclusão e vínculo com auditoria, idempotente.
- `flw_capabilities(tenant,unit)` lista cinco capacidades pendentes e a ficha redigida do último teste.
- `record_flw_capability_test(tenant,unit,capability,account_label,scope,limits_summary,sample_summary,documentation,proof,result)` registra conta redigida, escopo, limites, amostra redigida, URL oficial sem query/segredos, prova opaca, resultado `blocked/failed/passed`, data e responsável autenticado. Registrar `passed` exige prova humana real; não habilita automaticamente nada. O último snapshot é substituído; auditoria conserva ator/data/resultado, e a referência de prova deve apontar para o registro redigido versionado da equipe.
- `replay_flw_delivery(tenant,delivery,reconciled=false)` permite replay de retry/dead/credential_expired e unknown reconciliado. Uma entrega real continua manual; simulação volta a pending. Replay não é oferecido automaticamente pela UI.

## Worker e falhas

A Edge Function preserva JWT do usuário ao validar o contexto antes de usar service role. O worker é acionado por `action:work`, sem scheduler. Lote limitado a dez; lock da conexão e lease impedem claims concorrentes. Backoff local exponencial e máximo de cinco tentativas evitam loop. Timeout de RPC usa AbortSignal; timeout da porta registra resultado desconhecido. Não há promessa de exatamente uma execução externa. Reconciliação deve determinar o efeito antes de autorizar replay. Replay não cria tarefa manual para simulações, recusa `SUPERSEDED` e exige recuperar conexões desabilitadas ou com credencial expirada. Falhas de RPC registram tenant, ação e IDs disponíveis, sem exceções brutas.

`unknown` nunca volta a retry por expiração do lease. A próxima reivindicação normaliza leases vencidos; até então podem aparecer como sending. Uma conexão não executa duas entregas simultâneas. Versões antigas de uma mesma entidade/operação são descartadas quando já existe versão superior, sem presumir sequência externa. Se o resultado depende de estado remoto, a consulta autenticada ou intervenção humana permanece obrigatória até haver capacidade comprovada.

O recebimento FLW permanece recusado. Uma futura implementação deve primeiro autenticar bytes originais/origem conforme contrato oficial, aplicar validade/antirreplay e derivar tenant da conexão e da conta autenticadas. Só então deve inserir inbox, confirmar após commit, deduplicar e reconciliar ordem ambígua consultando estado atual quando autorizado. Não confiar no tenant/account enviados no body. As constraints locais testadas não homologam assinatura, entrega ou retries da FLW.

## Homologação externa pendente

1. Confirmar explicitamente projeto/ref, URL, ambiente e autorização antes de ação remota. O ambiente informa `ijjhtfryawtjoxvprjix` em sa-east-1; nenhuma operação remota foi feita nesta etapa.
2. Obter duas contas FLW autorizadas e documentação oficial de base URL, credencial/cofre, escopos, verbos/rotas, payloads, limites, idempotência, erros, paginação e autenticação de webhook. Não transportar segredos no navegador.
3. Testar cada capacidade exata em dados sintéticos A/B, provar isolamento de conta, expiração, 429, interrupção e consulta/reconciliação. Registrar ficha com conta/escopo/limites/amostra redigidos, capability, data, responsável e prova. Evidência documental e resultado operacional são distintos.
4. Somente após revisão dessa prova implementar transporte da capacidade disponível, guardar segredo no cofre e vincular conta comprovada à conexão no servidor. Anotação administrativa ou state no banco isoladamente não habilitam chamadas no código atual.
5. Antes de habilitar webhook, demonstrar validação de origem e vínculo de conta, repetição/ordem/validade e transação de inbox. Enquanto isso usar tarefa manual ou consulta realmente autorizada; nenhuma consulta FLW foi comprovada aqui.
6. Publicar Edge/migration no projeto confirmado; testar gateway JWT/CORS, secrets, concorrência, expiração de lease e logs por tenant/correlação sem conteúdo privado. Repetir Storage HTTP com sessões reais conforme etapas anteriores. SMTP/SSO/iframe/mobile FLW permanecem dependências externas anteriores.
