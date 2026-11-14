# Cadastro e identidade do cliente

Acesse **Clínica → Clientes** (`/clinicas/:slug/clientes`). O UUID Zetta identifica o cadastro; nome, telefone, e-mail e IDs FLW não concedem acesso nem provam identidade. Todo cliente pertence a uma unidade. Esta versão usa o escopo mais restrito: leitura e escrita sempre exigem atribuição vigente à unidade, tenant ativo e módulo `core` vigente. Não há prontuário nem campos clínicos nesta etapa.

| Papel clínico | Leitura na unidade | Cadastro/vínculos | Merge |
| --- | --- | --- | --- |
| Admin clínica, gerente | Sim | Sim | Sim |
| Recepção | Sim | Sim | Não |
| Profissional, financeiro, auditor | Sim | Não | Não |
| Global Zetta sem vínculo clínico | Não | Não | Não |

## Banco e contratos

Migrations `202611140011_clients.sql` e `202611140012_clients_review.sql`: tabelas privadas `clients`, `client_links`, `client_events`, com RLS e sem grants diretos. Schema privado permanece fora da API. RPCs públicas são concedidas somente a `authenticated`, validam autoridade no corpo, com `SECURITY DEFINER` e `search_path=''`.

- `search_clients(tenant, unit, query='', after_id=null)`: nome sem distinção de caixa ou dígitos do telefone, removendo espaços externos da consulta; página de até 50, ordenada por UUID, cursor `after_id`. Inclui arquivados, identificados na tela. Não consulta outras unidades.
- `save_client(...)`: nome obrigatório, telefone/e-mail opcionais; telefone bruto e normalizado separados. Número nacional de 10/11 dígitos com DDD explícito recebe +55; internacional com + e 8–15 dígitos conserva país. Não inventa DDD/nono dígito. Número incompleto fica bruto, com revisão obrigatória. Homônimo, telefone ou e-mail repetidos exigem `reviewed=true`; nunca se fundem automaticamente. A recepção consulta a pesquisa e confirma a intenção na caixa de revisão. Edições exigem `expected_version`; conflito retorna `40001`.
- `set_client_link(...)`: contato ou card na conexão FLW do tenant, referência opaca e origem obrigatórias. Pendente, confirmado manualmente ou encerrado. ID externo único por tenant/conexão/tipo enquanto não encerrado. Pode haver vários cards da mesma pessoa. Nova referência exige encerrar a anterior ou editar explicitamente o vínculo por RPC. Eventos preservam o snapshot anterior, autoria e carimbo. A versão do cliente muda também ao revisar vínculo. Editar vínculo existente exige `expected_version` igual à versão revisada da ficha; ausência ou divergência retorna `40001`.
- `client_detail(...)`: ficha, vínculos, eventos cadastrais (inclusive origens arquivadas por merges anteriores) e módulos autorizados/instalados. As abas Agenda/Pacotes aparecem conforme entitlement/permissão. Não existem registros desses módulos nesta etapa; a UI informa a indisponibilidade do histórico operacional, sem criar eventos fictícios. Eventos de cadastro não são prontuário.
- `merge_clients(...)`: admin/gerente prepara e confere ambas as fichas, UUIDs, versões, contatos, contagem de vínculos e motivo. Confirmação explícita obrigatória. Serializa operações por tenant/unidade e trava clientes por UUID em ordem crescente. Revalida versões e estado; move apenas `client_links` da mesma unidade, registra efeitos/contagens e preserva eventos anteriores. O sobrevivente conserva seus próprios campos de contato. Origem arquivada com FK composta para sobrevivente; nenhuma exclusão. Repetição para o mesmo sobrevivente ativo retorna os efeitos originais somente com as versões originais registradas no evento (mesmo após novas edições do sobrevivente). Versões diferentes ou ausentes recusam a origem já arquivada com `22023`; num merge novo, versões obsoletas retornam `40001`. Destino arquivado, unidade/tenant divergente, autor não permitido ou versão obsoleta abortam tudo. Nenhuma FK de módulos futuros é movida automaticamente; esses módulos deverão estender explicitamente o contrato de merge e seus testes.

`client_events` e `audit_logs` são gravados com a operação, na mesma transação. A auditoria geral contém somente ação/UUID/unidade; snapshots de vínculos ficam no histórico privado do cliente, visível apenas por RPC autorizada. Auth metadata, slug e papel global não substituem estas verificações.

## FLW e importação

Sem conta/autenticação/deep link comprovados: `crm_url=null`, `CAPABILITY_NOT_VERIFIED`, botão **Abrir no CRM FLW · indisponível**, identificador copiável e instrução de localização manual na conta/conexão correta. Não se constrói URL a partir do ID nem se usa o retorno geral à FLW como link do card. O schema prevê modo `synchronized` com carimbo de origem, mas nenhuma RPC de usuário habilita esse modo. Registrar evidência ou confirmar um vínculo não homologa integração.

A prévia `preview_client_import(tenant,unit,rows)` aceita **até 100 linhas / 100 KB** em JSON. Mapeamento `clients.manual.v1`: `name`, `phone`, `email`, `source_ref`. Rejeita campos extras, tipos inválidos, falta de nome/origem e contatos inválidos. Mostra candidatos somente da unidade autorizada. Nome/telefone/e-mail coincidentes no banco, ou nome/telefone/e-mail/origem repetidos na amostra, exigem revisão. Não escolhe um candidato automaticamente. A prévia não persiste PII nem cria clientes/vínculos. A clínica pode baixar o relatório de linhas, origem, normalização, candidatos e rejeições. Não há execução de lote/corte nesta etapa.

Amostra exclusivamente sintética: [clientes-amostra.json](../fixtures/importacao/clientes-amostra.json). Resultado real da RPC local: [prévia e rejeições](evidencias/prompt-05-previa-clientes.json), três linhas, duas em revisão e uma rejeitada; nenhuma gravação. O campo `dry_run` identifica ensaio manual, não resposta simulada do fornecedor.

Para homologar leitura/sincronização futuramente: confirmar projeto/ambiente e duas contas FLW; comprovar autenticação, isolamento de conta, atributos permitidos, base e URL do card, paginação/cursor, carimbo de origem, limites, expiração e retomada idempotente. Versionar o mapeamento e transporte Edge com credencial no servidor. Até lá não há chamada FLW, sincronização, habilitação automática de capacidade ou importação definitiva.
