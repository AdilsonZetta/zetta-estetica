# Catálogo, profissionais e recursos

Acesso em **Clínica → Catálogo**, por unidade. Catálogo integra o módulo `core`; ter Agenda no plano não concede configuração. Admin e gerente configuram; recepção, profissional, financeiro e auditor consultam. Todos dependem de vínculo ativo, unidade atribuída/ativa, tenant ativo e entitlement vigente. Papel global não concede acesso operacional.

## Serviços

Publicar cria uma versão imutável com UUID próprio, número sequencial, categoria, duração inteira em minutos (1–1440), buffers inteiros (0–1440), preço inteiro em centavos (0–999999999999), código de moeda de três letras maiúsculas, preparo administrativo, estado, unidades, recursos nominados e exigências de capacidades/quantidades. O frontend apresenta moeda BRL por padrão; o código deve representar a moeda contratada, sem conversão cambial.

A versão anterior permanece legível por `catalog_service_history`, inclusive após inativação ou retirada de uma unidade da versão atual. A leitura histórica continua limitada à unidade que constava naquela versão. Agendamentos e propostas futuros devem referenciar `(tenant_id, version_id, unit_id)` de `catalog_service_units`; não resolver registros históricos pela versão atual. O UUID do serviço é estável; o UUID da versão muda em cada publicação. Não há exclusão física de serviços na API: inativar cria uma nova versão. Versões inativas ou superadas não podem alimentar a consulta de novas disponibilidades.

A edição exige a versão esperada e escopo de escrita em **todas** as unidades da versão atual e da nova. Recursos nominados devem existir no mesmo tenant/unidade e estar ativos, com vínculo de equipe vigente quando houver. Inativar permite conservar referências já desabilitadas. Um serviço pode ser publicado durante a preparação do catálogo sem profissional habilitado; não terá profissionais elegíveis até receber uma nova versão com a habilitação correspondente.

## Identidade, localização e equipe

`catalog_resources` representa profissional, sala ou equipamento por identidade única na clínica. `catalog_resource_units` associa unidades, localização e capacidade. O mesmo profissional/equipamento compartilhado usa o mesmo UUID entre unidades. Não cadastrar uma cópia por unidade. O vínculo opcional à equipe é único por tenant e exige equipe ativa com todas as unidades de atuação atribuídas. O cadastro operacional não cria usuário nem concede papel/permissão. Qualificação é administrativa; não constitui comprovação sanitária ou prontuário.

Editar um recurso exige versão esperada e escopo em todas as unidades antigas e novas. O tipo é imutável. Inativação é a exclusão lógica; vínculos de versões e janelas históricas impedem retirar fisicamente a atribuição correspondente. Capacidade informa a aptidão da sala/equipamento e não representa várias identidades físicas independentes. A futura agenda reservará a identidade física uma única vez por intervalo.

## Jornada e consulta

Configure **janelas por data**, sem recorrência implícita: turno, folga, feriado ou exceção de abertura. Para outra data, grave outra janela. Feriados/folgas são registrados por recurso; para bloquear toda a unidade, configure cada recurso afetado. A exceção abre um intervalo adicional; para substituir um turno sobreposto, edite a janela existente. Edição substitui a janela atomicamente; ID anterior deixa de ser editável. Remoção de janela é auditada.

Cada unidade tem fuso IANA, inicialmente `America/Sao_Paulo`. A RPC converte os horários locais para `tstzrange [)` com instantes `timestamptz`, preservando também horário local e fuso usados. Alterar o fuso da unidade não desloca janelas existentes; revise-as explicitamente. Horários locais inexistentes por mudança de fuso são recusados. Horários ambíguos seguem a resolução padrão do PostgreSQL; revise instantes na homologação de unidades com horário de verão. Intervalos devem ser positivos e ter até 31 dias.

A exclusão GiST por `(tenant_id, resource_id, period)` impede turnos/exceções simultâneos, inclusive em unidades diferentes, tanto para profissionais quanto para itens físicos. Intervalos contíguos são aceitos. Folgas e feriados podem sobrepor turno e bloqueiam a identidade compartilhada em todas as unidades naquele instante.

**Encontrar recursos livres** verifica a cobertura integral por uma janela aberta e ausência de folga/feriado. Com serviço selecionado, exige versão publicada atual na unidade, duração igual à versão, expande o intervalo pelos buffers, filtra profissionais nominados com vínculo vigente e recursos compatíveis com capacidades/quantidades. Recursos físicos nominados restringem os candidatos daquele tipo. O resultado lista candidatos individuais: deve ser escolhido um conjunto que atenda a todas as exigências. Não confirma uma alocação nem considera reservas (Prompt 07); não substitui validação transacional da agenda. Janelas adjacentes não são unidas implicitamente na consulta: configure um turno contínuo se precisar cobrir todo o período com uma janela.

## API e integridade

Todas as tabelas ficam no schema privado, com RLS habilitada e nenhum grant de tabela ao navegador/service role. Somente RPCs `SECURITY DEFINER`, `search_path=''`, autorização no corpo e EXECUTE para `authenticated`. Há FKs compostas em todas as associações de tenant/unidade. Slug e metadados Auth não autorizam.

| RPC | Operação |
| --- | --- |
| `list_catalog` | Listas de serviços atuais, recursos ou janelas, busca por nome, cursor UUID, 30 por página |
| `catalog_service_history` | Versões da unidade, cursor por número decrescente, 30 por página |
| `catalog_team_options` | Seletor de vínculos ativos com escopo administrativo integral; nome (e-mail como identificação alternativa) e papel traduzido, sem metadados Auth |
| `save_catalog_resource` | Criação/edição/inativação, unidades, capacidades e vínculo à equipe |
| `publish_catalog_service` | Nova versão publicada/inativa; criação do serviço quando não há ID |
| `set_catalog_window` / `delete_catalog_window` | Criação, substituição atômica e remoção de janela |
| `set_catalog_timezone` | Fuso validado da unidade, sem grant direto por coluna |
| `catalog_availability` | Candidatos, capacidades e disponibilidade configurada, cursor UUID, 30 por página |

Operações de configuração usam lock transacional por tenant para serializar recursos compartilhados, publicações e janelas. Edições de serviço/recurso também usam versão otimista; concorrência obsoleta retorna `40001`. Sobreposição retorna `23P01`; escopo negado, `42501`; integridade/validação aborta toda a operação. Auditoria com ator, tenant, unidade e referência ocorre na mesma transação. Não há nova integração externa, Storage ou Edge Function nesta etapa.

## Exemplos para a agenda

`supabase/seed.sql` entrega **duas clínicas sintéticas**, cada uma com avaliação de 30 minutos, buffers 5/10, BRL 15000 centavos, profissional habilitado, sala e equipamento com capacidade `avaliacao`, preparo administrativo e janela em **16/11/2026, 09h–12h**, no fuso da unidade. Aurora compartilha o mesmo profissional com sua segunda unidade, **13h–17h**. Não atribui acesso à segunda unidade às contas anteriores.

IDs terminam em `101` (profissional), `102` (sala), `103` (equipamento), `201` (serviço) e `211` (versão), com o prefixo UUID do tenant. A versão de Aurora é `10000000-0000-0000-0000-000000000211`; a de Horizonte, `20000000-0000-0000-0000-000000000211`. São fixtures de demonstração, sem agendamento e sem conta FLW. Seeds não pertencem às migrations e não devem ser aplicados automaticamente no projeto hospedado.
