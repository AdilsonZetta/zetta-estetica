# Zetta Estética com FLW Chat e Supabase

## Prompts para o Codex

Versão 3.1 • 14 de novembro de 2026

Abra a raiz do repositório no Codex. Cole o Prompt Mestre como contexto e envie apenas o Prompt 00 para começar.
Para o piloto, execute os prompts 00 a 12 e depois o 15. Os prompts 13 e 14 têm cronogramas próprios.

### 24 Prompt Mestre

```text
Você é o agente de engenharia do Zetta Estética. Trabalhe no repositório aberto no Codex. Antes de editar, leia AGENTS.md, README, manifests e CI, confira git status e preserve alterações existentes. Use a stack do projeto. Se o repositório estiver vazio, proponha React, TypeScript e Vite no Discovery e use essa base no Prompt 01. A clínica abre o módulo pelo ícone Gestão Estética da FLW Chat após homologação. A FLW cuida de WhatsApp, atendimento, agentes de IA e CRM. A Zetta implementa agenda, propostas, pacotes, sessões, recebíveis e gestão multiempresa.

Use o Supabase da Zetta como backend. Trabalhe localmente e confirme o projeto antes de operações remotas de homologação autorizadas. Use PostgreSQL para dados e transações, Auth para identidade, Storage privado para arquivos e Edge Functions para integrações. No navegador, use chave publishable e sessão do usuário. Guarde credenciais e chaves privilegiadas no servidor. Documente variáveis em .env.example sem valores reais.

Modele um SaaS com vários tenants por ambiente. Valide vínculo ativo, escopo de unidade, permissão e módulo no banco. Use tenant_id obrigatório, referências compostas, RLS e grants estritos. O slug só indica o destino. Separe papéis globais dos papéis da clínica. Estruture o núcleo para receber outros nichos por módulo, configuração e templates versionados.

Implemente reservas, aceite, consumo e conciliação com transações, restrições e idempotência. Grave eventos com a operação no PostgreSQL. O adaptador FLW habilita somente operações autenticadas e demonstradas. Use vínculos e tarefas manuais para as demais operações. Para abrir o aplicativo, comece com Supabase Auth. SSO, iframe e envio automático dependem dos testes do Discovery.

Edite, teste e revise o diff da etapa solicitada. Versione migrations e funções. Valide com dados sintéticos de duas clínicas e use pgTAP, API, Storage e testes de concorrência conforme a etapa. No final, entregue arquivos, comandos executados e seus resultados, dependências, pendências e instruções de homologação. Se o ambiente bloquear um teste, registre a causa e conclua o trabalho local disponível. Execute apenas o prompt solicitado. O primeiro é o Prompt 00.
```

### Prompt 00 Discovery FLW e prova de abertura

```text
Execute apenas o Discovery. Inspecione AGENTS.md, README, git status, manifests, pastas, arquivos do Supabase, migrations, configuração de testes e CI. Informe o que existe, os comandos disponíveis, a referência do ambiente sem segredos e o que falta. Se a pasta estiver vazia, defina a estrutura mínima para a fundação e prepare o roteiro com o que é verificável agora.

Consulte https://docs.flw.chat/ e construa uma matriz por operação. Verifique ícone por conta, modo de abertura, SSO ou token formal, consulta de contato, leitura e atualização de card, tarefas, pagamento, webhooks, disparo de fluxo ou mensagem e suporte para agentes FLW chamarem ferramentas externas. Registre documentação, rota e escopo oficiais quando disponíveis, evidência de teste, ambiente, resultado, alternativa manual e responsável. Separe presença na interface de acesso por API. Trate exemplos como simulação até haver prova.

Com um aplicativo existente, prepare /integration-lab com dados sintéticos. Se o repositório estiver vazio, use uma página de prova isolada e reaproveitável. Rode localmente e use uma URL de homologação autorizada e acessível pela FLW para testar o ícone Gestão Estética em duas contas. Registre destino, aba ou iframe, volta à FLW, login e logout, expiração e mobile. Deixe para o Prompt 03 a validação final de vínculo quando depender da fundação.

Use somente conta e credencial de homologação autorizadas e mantenha os valores no cofre. Registre quais operações requerem teste humano e como realizá-lo. Em caso de documentação ou acesso indisponível, conclua o laboratório local e deixe explicitamente pendentes as hipóteses que ainda precisam ser testadas.

Registre em docs/flw-discovery.md, ou no caminho equivalente do repositório, a matriz, evidências redigidas, opção de abertura e login, alternativas manuais e critérios do Prompt 01. Informe o que foi testado localmente e o que depende de acesso externo. Trabalhe no código de prova e em homologação com dados fictícios.
```

### Prompt 01 Fundação SaaS com Supabase

```text
Implemente a fundação multiempresa no repositório. Inicialize a stack e a configuração local do Supabase se faltarem. Crie migrations aditivas para tenants, units, profiles, tenant_memberships, membership_units, tenant_invitations, papéis globais e auditoria. Inclua duas clínicas fictícias com usuários de teste distintos e um usuário com dois vínculos. Use auth.users para identidade e tabelas privadas para autoridade administrativa.

Implemente membros ativos e revogáveis, autorização por tenant e unidade, RBAC e a base de entitlements usada no Prompt 02. Defina políticas RLS de consulta e escrita, WITH CHECK, grants explícitos, escopos mínimos para views e RPCs, e referências compostas por tenant para relações operacionais. Use validação por coluna ou rotinas autorizadas para impedir mudanças diretas de papéis, vínculo ou estado da plataforma.

Separe papéis Zetta de papéis da clínica. Use auth.uid() e memberships atuais. Se uma função SECURITY DEFINER for necessária, valide o escopo em seu corpo, fixe search_path vazio, qualifique nomes e restrinja execução. Evite recursão de políticas. Aplique autenticação ao shell web e às rotas de administração. Use Auth por convite como ponto de partida.

Prepare um bucket privado de teste e regras que só autorizem objetos do escopo permitido. Teste SELECT, INSERT, UPDATE, DELETE, RPC e download usando identidades A e B e um usuário revogado. Inclua unidade, rota e objeto de outro tenant na suíte. Para testes de APIs e Storage, use sessões de usuário, pois a chave de serviço tem acesso privilegiado.

Documente a inicialização local e .env.example no README. Registre em AGENTS.md as convenções persistentes se faltar uma seção equivalente. Gere os tipos TypeScript do esquema local quando aplicável. Entregue migrations e resultados de RLS, API e Storage. Demonstre que revogar um vínculo bloqueia novas operações.
```

### Prompt 02 Console Zetta e catálogo de módulos

```text
Implemente o console Zetta com telas de empresas, onboarding, catálogo de módulos, instalações de ícone, conexões, assinaturas SaaS e suporte. Registre plano, unidades, marca, limites, último teste da integração e trilha. Apresente estados de conexão e ícone com evidências e mensagens úteis.

Modele module_catalog, plans, plan_modules e tenant_entitlements com dependências, vigência e overrides. Aplique entitlements tanto às telas quanto a RLS e RPCs. A clínica pode configurar módulos habilitados dentro da alçada de administrador. Use estado temporário para teste de módulo e revisão antes de publicar uma ativação.

Crie provisionamento idempotente que grave tenant, primeira unidade e configuração numa transação. Convite via Auth/e-mail é uma ação separada com estado e retry. Na ativação de membro, valide e-mail verificado e convite vigente, associando o vínculo de forma única. Audite suspensão, reativação, plano, mudança de escopo e concessão de suporte.

Adicione política de suspensão que bloqueie ações operacionais e jobs, com canal de exportação autorizada conforme contrato. Permita a implantação com credenciais FLW pendentes, distinguindo teste da conexão, estado da capacidade e estado da configuração do ícone. Restrinja diagnósticos de suporte a dados redigidos e grants temporários.

Mostre com a clínica A que Agenda e Pacotes serão autorizados e com a B que apenas Agenda será autorizada. Se a vertical ainda não tiver a tela de Pacotes, use uma permissão de teste e cubra também a RPC protegida. Teste tentativa de escalada pelo admin da clínica, quota concorrente e retry de convite.
```

### Prompt 03 Abertura pela FLW e Supabase Auth

```text
Implemente /launch e /launch/:slug no aplicativo. O link da clínica aponta para o tenant de destino e o Supabase Auth autentica o usuário. Valide membership ativa no servidor/banco e navegue para a clínica autorizada. No link genérico com vários vínculos, abra o seletor. No link específico sem vínculo, mostre acesso indisponível e a ação de retorno apropriada.

Implemente convite e acesso por código de e-mail com Supabase Auth. Controle criação de conta pelo fluxo de convite e desabilite criação automática no login OTP. Valide o destino após login e configure template de e-mail, SMTP, domínios e redirects por ambiente. Trate convites expirados, reutilizados e revogados. Use URLs de retorno derivadas de configuração aprovada. Ao trocar contexto ou sair, limpe cache, previews de documentos e subscriptions do tenant anterior.

No console, permita copiar o link, registrar nome do ícone, conta FLW, modo desejado, instalador, evidência redigida e status. Instale manualmente nos ambientes de teste disponíveis. Comece em aba externa quando comprovada. Adapte a interface a iframe apenas após verificação de sessão e origens exatas, com ação de abertura externa. SSO fica condicionado a contrato oficial e prova formal, registráveis como evolução.

Teste desktop, Android e iOS, recarregar, logout, token expirado, convite encaminhado, trocar slug e cruzar vínculo entre duas contas FLW. Teste usuário que realmente pertence a duas clínicas e mudança de acesso após revogação. Documente o que foi observado em cada dispositivo e a opção de abertura em caso de falha.
```

### Prompt 04 Adaptador FLW por capacidades

```text
Implemente o adaptador FLW com interfaces de contato, card, cobrança e automação. Separe o contrato interno Zetta do transporte do fornecedor. Configure tenant_integrations, integration_capabilities, webhook_inbox, outbox_events e integration_deliveries com acesso privado, estados, correlação e chaves únicas fixadas pelo contrato.

Conecte endpoints somente com documentação autorizada e prova em homologação. Registre conta, escopo, limites, amostra redigida, capability e data do teste. Retorne CAPABILITY_NOT_VERIFIED para operação pendente e disponibilize tarefa ou vínculo manual. Use fixtures claramente marcadas para o modo simulação.

Implemente as funções em supabase/functions/ conforme a estrutura existente. Use cofre, timeout, limite por conexão e logs redigidos. Propague o contexto nas integrações de usuário e valide a autoridade antes de usar o cliente de serviço. Em webhook comprovado, valide origem e vínculo da conta antes de gravar inbox. Para mecanismos pendentes, mantenha a operação manual ou a consulta autorizada.

Modele worker e entrega com lease, retry, deduplicação e estado para resultado desconhecido. Aplique replay por operador autorizado. Trate 429, interrupção, credencial expirada, evento repetido e mudança de ordem. Implemente chamadas externas apenas da capacidade disponível nesta etapa.

Entregue relatório do que foi realmente testado, operações pendentes, comportamento manual e testes automatizados de roteamento e falhas. A equipe deve conseguir identificar a clínica de um erro sem expor token ou conteúdo privado.
```

### Prompt 05 Cadastro e identidade do cliente

```text
Implemente o cadastro operacional de clientes no Supabase com UUID interno, tenant_id e campos mínimos de contato. Modele vínculos tipados para contato e card FLW por conexão. Inclua estado do vínculo, modo manual ou sincronizado, carimbo de atualização e referência do registro de origem. Controle leitura por papel e unidade onde a clínica exigir.

Crie tela com pesquisa por nome e telefone, ficha resumida, referência do CRM e abas de histórico operacional ligadas aos módulos instalados. Mostre ação Abrir no CRM FLW com deep link verificado. Onde não houver URL comprovada, apresente identificador e instrução para localizar o card na FLW.

Se a leitura de contatos estiver homologada, sincronize só os atributos previstos no mapeamento, com paginador/cursor e carimbo de origem. Caso contrário, use cadastro mínimo com vínculo manual revisável. Normalize telefone em E.164 quando possível, trate homônimos e telefone compartilhado, e exija revisão para correspondência ambígua.

Implemente merge supervisionado por RPC. Trave registros em ordem consistente, preserve o histórico de vínculos, mova apenas referências autorizadas, registre os efeitos e deixe o registro anterior arquivado com referência ao sobrevivente. Valide integridade e isolamento por tenant em toda referência.

Teste clientes com mesmo nome, telefone repetido em duas clínicas, dados incompletos, mudança de número, vínculo duplicado, merge que falha e link FLW indisponível. Entregue prévia de importação com amostra e relatório de rejeições, além das telas.
```

### Prompt 06 Catálogo profissionais e recursos

```text
Implemente serviços versionados com categoria, duração em minutos, buffers antes e depois, preço em centavos, moeda, unidades disponíveis, profissionais habilitados e exigências de sala/equipamento. O formulário registra preparo administrativo e estado publicado/inativo. Mantenha referências históricas ao publicar nova versão.

Crie cadastro de profissionais ligado à equipe quando aplicável, unidades de atuação, qualificação operacional, turnos, folgas, feriados e exceções. Modele profissional como recurso único da clínica para compartilhar ocupação entre unidades. Salas e equipamentos têm localização e capacidades. Se um item físico for compartilhado, use identidade única e configure janelas e unidade de uso coerentes.

Implemente CRUD com RLS, alçada, paginação, auditoria e regras de integridade para vínculos serviço/unidade/profissional/recurso. Use o fuso IANA de cada unidade para configurar jornadas. Valide intervalos e sobreposição de turnos onde forem conflitantes. Um serviço inativado continua disponível para leitura em registros históricos.

Na UI, priorize criar e publicar serviço, ver profissionais elegíveis, configurar jornada e encontrar recursos livres. Inclua uma prévia de preço, duração e buffer associados à versão. Separe a configuração do catálogo da concessão de permissões de acesso.

Teste inconsistência de preço, duração inválida, equipe sem escopo, vínculo cruzado de recursos, mudança de versão e profissional atuando em duas unidades. Entregue dados de exemplo com avaliação, sala e equipamento para usar na etapa de agenda.
```

### Prompt 07 Agenda e reservas transacionais

```text
Implemente agenda por dia/semana, grade de profissionais, salas e equipamentos, seleção por unidade, disponibilidade, reserva temporária, confirmação, check-in, reagendamento, cancelamento, no-show e lista de espera. Armazene instantes em timestamptz e converta conforme o fuso da unidade.

Modele reservas de recurso em PostgreSQL. Use tstzrange [) com buffers e btree_gist para restrição de exclusão GiST por tenant, recurso e intervalo ativo. Utilize o mesmo recurso global do profissional para todas as unidades dele. Aplique a ocupação também a bloqueios rígidos de agenda. Confirme suporte à extensão em homologação.

Crie RPCs com autorização, estado, versão, validação da jornada, recursos, duração e chave idempotente. No reagendamento, bloqueie o agendamento e recursos, substitua os intervalos atomicamente e trate erro de exclusão como conflito de negócio. Preserve o horário original se a nova alocação falhar. Trate holds vencidos na RPC com locks e programe limpeza de apoio em Cron. Defina quais transições liberam a alocação. Retire da interface a escrita direta nas reservas. Use a mesma operação de reserva para um encaixe aceito.

Inclua mensagens de erro úteis, retorno do horário atualizado, explicação de conflito e seleção de novo horário. Grave eventos operacionais na outbox na mesma transação. Vincule execução e prompts seguintes por IDs estáveis.

Adicione um teste de integração reproduzível com duas sessões e conexões simultâneas. Cubra profissional multiunidade, sala/equipamento, intervalos contíguos, buffers, expiração de hold, fuso, cancelamento e reagendamento inválido. Relate as respostas das duas chamadas e o estado final gravado no banco.
```

### Prompt 08 Avaliações propostas e aceite

```text
Implemente avaliação comercial com referência ao cliente e agendamento opcionais, profissional responsável, objetivos de contratação e próximo passo. Limite campos a conteúdo comercial. Vincule à proposta, ao card FLW quando houver e à unidade, com histórico de mudanças.

Implemente propostas em versões, itens com preço contratado em centavos, número de sessões, validade, desconto e alçada. Grave snapshots de catálogo, política, modelo do documento e condições de contratação. Permita prévia e PDF privado. Use aceite interno autenticado e auditado como padrão, com registro de quem aceitou e por qual canal. Se houver compartilhamento externo de proposta, use entrega autorizada com token opaco de curta validade, escopo só daquela versão e opção de revogação.

Na RPC de aceite, valide status, validade e versão, aplique alçada e idempotência, crie uma venda única, parcelas mínimas e direitos contratados por item. Escreva o evento proposal.accepted.v1 na mesma transação. Antes do módulo de pacotes, preserve os direitos da venda como pendências de ativação rastreáveis. Registre o desenho para o Prompt 09 materializá-los uma única vez.

Se a mudança de etapa FLW estiver comprovada e mapeada, enfileire a ação pelo adaptador. Disponibilize tarefa manual para os demais casos. Mantenha versionamento mesmo quando o preço de catálogo mudar depois da emissão.

Teste aceite duplicado e concorrente, prazo vencido, alteração de preço, mudança simultânea de versão, chave reutilizada com outro conteúdo, limite de desconto e isolamento do arquivo. Entregue leitura da proposta aceita, venda gerada e evidência de autoria.
```

### Prompt 09 Pacotes sessões e extrato

```text
Implemente packages, package_ledger e sessions, com vínculos compostos a tenant, venda, cliente, procedimento, unidade e agendamento. Modele elegibilidade, validade e política para ativação no aceite ou após sinal. Distinga direito contratado, crédito concedido, saldo disponível, saldo consumido e ajuste. Materialize os direitos históricos uma única vez por origem e conecte as novas concessões à transação de venda ou de confirmação do sinal, conforme regra.

Implemente ledger de créditos, consumo, expiração e ajuste compensatório. Bloqueie o pacote em ajustes e consumos. Use chave de negócio única por origem/evento. Finalize sessão e anexe débito na mesma transação, com validação do profissional autorizado, sessão em estado correto e saldo suficiente por procedimento. Registre estorno por movimento compensatório e justificativa, com aprovação adicional se a política da clínica exigir.

Na interface, exiba saldo, validade, lista de sessões e extrato. A recepção faz check-in dentro do escopo. O profissional autorizado registra conclusão. A operação trata cancelamento, falta e ajustes com regras versionadas. Dê preferência a uma tarefa de renovação quando o saldo cruza o limiar configurado. Emita eventos administrativos de saldo baixo, pacote esgotado e expiração.

Teste retry e consumo duplicado, duas sessões disputando o último crédito, pacote vencido, pacote pendente de sinal, estorno e reversão de movimento, profissional de outra unidade e migração de vendas aceitas antes do ledger. Compare a carteira ao total do extrato.
```

### Prompt 10 Recebíveis pagamentos e conciliação

```text
Implemente receivables, payment_intents, payment_movements e alocações, com valores em centavos e moeda explícita. Exiba vencimento, contratado, valor pago, saldo, estorno e referência de origem. Escolha um modo de cobrança por clínica e intenção: manual, FLW Pagamentos por API comprovada ou PSP homologado. O faturamento da assinatura da Zetta usa domínio administrativo próprio.

Em cobrança integrada, persista intenção local única e use referência/idempotência do provedor. Após resultado desconhecido, reconcilie antes de criar nova cobrança. Verifique webhook ou consulte o provedor autenticado e confira conta, referência, moeda, valor e status antes de liquidar. Grave processamento e movimento em transação. Use redirect do navegador só para acompanhar o andamento.

No modo manual, registre evidência, data, forma, valor e responsável, com comprovante opcional em Storage privado. Diferencie visualmente origem e status da conciliação. Trate parcial, excedente e estorno, registrando compensação. Ao conciliar registro manual com evento do provedor, vincule evidências sem lançar caixa novamente. Habilite pacote condicionado ao sinal na mesma operação que confirma a regra, com efeito único.

Teste callbacks repetidos e fora de ordem, timeout, pagamento parcial, diferença de valor, reembolso parcial ou total, alocação, concorrência, origem manual e pacote liberado uma vez. Em ambiente de teste, use PSP sandbox ou fixtures marcadas. Entregue tela de diferenças e roteiro de conciliação.
```

### Prompt 11 Automações e tarefas com FLW

```text
Implemente catálogo de regras para lembrete, reagendamento, no-show, proposta pendente, renovação, inadimplência e reativação. Mantenha o estado da regra, seleção da unidade, evento ou periodicidade, dono, janela, limite de frequência, autorização de comunicação, condição de parada e política de retry.

Crie tarefa local como saída de operação manual. Para um destino habilitado, consuma a outbox com worker em lotes e chaves únicas por evento, regra e destino. Reavalie a situação recente antes da entrega, incluindo proposta aceita, agendamento cancelado, opt-out e limite de horário. Use o adaptador FLW para fluxos comprovados ou n8n autorizado como orquestrador de passos, com autenticação e payload mínimo.

Adicione simulação que mostra volume, motivos de exclusão, ação e destino, sem chamadas de envio. Exija ativação explícita do gestor autorizado. Registre processamento, resultado, métricas, desligamento por regra e alternativa manual. Trate timeout com resultado desconhecido antes de decidir entre consultar e retry.

Ao aprovar um novo fluxo, documente origem, destinatário, modelo, tipo de ação, retorno e custo ou limite quando aplicável. Dê à recepção uma fila por unidade, prazo, prioridade e dono. Permita assumir a tarefa, registrar a ação humana e encerrá-la com motivo.

Teste regra desativada, janela silenciosa, opt-out depois de enfileirar, chave repetida, limite de frequência, cancelamento antes do lembrete, provedor indisponível e replay. Registre contagens de elegíveis, tarefas geradas, pendências, entregas confirmadas e erros.
```

### Prompt 12 Indicadores e painel gerencial

```text
Implemente painéis por perfil para agenda, comparecimento, no-show, propostas, conversão, saldo de pacotes, ocupação de recursos, recebido bruto e líquido, contratado, inadimplência e falhas de integração. Acrescente agrupamentos por unidade, profissional, procedimento e período quando houver permissão.

Defina dicionário de métricas com origem, campos, fórmula, coorte, timezone, período e exclusões. Mostre zero quando a contagem é zero e indisponível quando não houver dado ou o denominador for zero. Exiba referência de atualização da FLW quando o indicador incluir dado sincronizado. Use snapshots comerciais e movimentos financeiros para reconciliar valores históricos.

Use RPCs de leitura ou views com autorização equivalente à origem, filtro e paginação nos detalhamentos e índices nas consultas frequentes. Views expostas devem operar com escopo correto, incluindo security_invoker quando aplicável. Controle exportação por papel e escopo, com trilha e limites de volume. Use geração assíncrona e entrega privada para relatórios que excedam o limite interativo.

Para recepção, priorize encaixes, avaliações do dia e propostas sem retorno. Para gerência, mostre ocupação, conversão, renovação e alertas. Para financeiro, priorize vencimentos, diferenças de conciliação e estornos. Inclua filtragem do período e um recorte comparável ao período anterior para a gestão.

Teste cálculo com base sintética de duas clínicas e compare cada agregado a registros de referência. Valide filtros de unidade, período local, reembolso, cancelamento, taxa com base vazia, exclusões e usuário sem acesso financeiro. Demonstre o caminho do card de resumo até o registro de origem.
```

### Prompt 13 Estoque e comissões

```text
Implemente estoque por unidade, item, lote, validade e unidade de medida. Controle entrada, ajuste, transferência, consumo e estorno com ledger. Vincule insumos ao serviço por versão e valide disponibilidade por lote, validade e unidade. Use quantidade decimal quando a unidade exigir e ajuste autorizado caso exista diferença física.

Implemente comissões por profissional, regra e vigência. A clínica escolhe o evento de venda, execução ou pagamento que gera o direito. Grave base de cálculo, percentual, versão da regra, evento e dimensão de unidade. Calcule efeitos de estornos com movimentos compensatórios e mantenha aprovação de fechamento.

Proteja as operações por alçada e escopo. Reutilize eventos idempotentes e bloqueios do PostgreSQL. Aplique chaves por origem para impedir dupla entrada de estoque ou comissão repetida. Planeje alertas de vencimento, saldo mínimo e divergências com tarefas que a gestão possa acompanhar.

Na saída de estoque, use lote selecionado pelo usuário autorizado ou sugira o de validade mais próxima conforme política. Registre origem quando o consumo estiver ligado a uma sessão. Na comissão, registre equipe, desconto, base líquida ou bruta aprovada e estado de repasse. Use política única de arredondamento.

Teste consumo concorrente por lote, itens vencidos, devolução, transferência entre unidades, profissional multiunidade, reembolso parcial, mudança de regra e replay. Entregue relatório que reconcilie estoque e cálculo individual de comissão sem incluir valores de terceiros fora da permissão.
```

### Prompt 14 Área clínica condicionada

```text
Verifique se há decisão documentada da Zetta e da clínica para a área clínica. Confirme responsável, finalidades e bases legais, retenção, dados necessários, normas aplicáveis, modelos revisados, autorização de acesso, incidentes e exercício de direitos do titular. Se a aprovação estiver pendente, entregue o checklist e mantenha o módulo indisponível em produção.

Com aprovação, implemente formulários de anamnese versionados, evolução com fechamento e adendos, documentos e fotos privadas. Separe permissões clínicas das comerciais e da administração geral. Restrinja por clínica, unidade, vínculo profissional e atendimento, com MFA onde exigido. As operações clínicas usam controles próprios no banco e no Storage.

Registre leitura, alteração, exportação e download autorizados. Use política de retenção por classe e processo de descarte com evidência. Quando houver exigência de revogação ou auditoria de leitura a cada acesso, use entrega intermediada e checagem da sessão em cada requisição. Use autorização de imagem e assinatura conforme finalidade aprovada e vincule o termo à versão correspondente.

Aceite somente payload operacional mínimo em eventos comerciais. Envie conteúdo clínico exclusivamente aos fluxos autorizados do módulo. Use dados sintéticos para testar permissões, exportação e descarte, revogação e recuperação de arquivos. Teste recepção, financeiro, profissional não vinculado, usuário de outra clínica e operador de suporte.

Entregue resultado do checklist, evidência de testes negativos, plano de restauração e trilha de acesso. A ativação é individual por clínica e exige homologação funcional e de segurança.
```

### Prompt 15 Homologação e lançamento piloto

```text
Execute a homologação ponta a ponta com duas clínicas fictícias, usuários de recepção, profissional, gerente, financeiro e Zetta. Valide ícone FLW, login, troca de clínica, logout, acesso negado, catálogo, agenda, cliente, proposta, venda, recebíveis, pacote, sessão, indicadores e tarefas.

Rode build, lint, testes de política SQL e requisições de teste para Auth, RLS, RPC e Storage. Valide concorrência para horário, aceite, último crédito e cobrança, além de eventos duplicados e reprocessamento. Registre resultados em desktop e nos dispositivos móveis de teste, o que foi comprovado em cada conta FLW e os cenários que exigem execução humana.

Ensaie deploy da versão, recuperação de banco e arquivos em ambiente isolado, segredos por ambiente, correlação de logs e resposta a incidentes. Registre objetivos de tempo e perda tolerada de dados. Use plano de reversão da aplicação e migrations compatíveis. Preserve a rastreabilidade dos registros já gravados caso uma integração precise ser temporariamente desativada. Meça latência, tempo de fila e duração da reconciliação sob carga sintética próxima à esperada no piloto.

Produza GO/NO-GO no repositório com versão, cenário, evidência, resultado, responsável e pendência. Registre modos manuais aceitos, monitoramento e responsáveis pela primeira semana. Revise o diff, migrations, arquivos de configuração e roteiro de release. Defina critérios de pausa por integridade de reserva, saldo, financeiro ou isolamento.

Antes da virada, confira totais de clientes, serviços, agenda futura, pacotes e recebíveis importados. Compare fluxos críticos em uma amostra com a clínica. Repita o roteiro depois de aplicar a migration em homologação e preserve a versão validada.
```
