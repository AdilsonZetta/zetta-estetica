# Agenda e reservas

A agenda fica em **Clínica → Agenda**, no módulo `agenda`. Admin, gerente e recepção leem e operam. Profissional, financeiro e auditor só consultam a grade. O papel global não concede acesso. Desligar o módulo preserva o histórico e nega novas RPCs.

A consulta do catálogo continua informativa. Quem grava ocupação é a RPC de reserva.

## O que ocupa o horário

Cada recurso — profissional, sala ou equipamento — tem uma identidade por clínica. A reserva ativa guarda `tstzrange [)` já expandido pelos buffers da versão do serviço. A exclusão GiST em `(tenant_id, resource_id, period)` impede dois intervalos ativos do mesmo recurso, em qualquer unidade. Intervalos contíguos passam. Bloqueio rígido entra na mesma restrição.

Estados que ocupam: `held`, `confirmed`, `checked_in`. Estados que liberam: `expired`, `cancelled`, `no_show`. Reagendamento troca os intervalos na mesma transação; se a nova alocação conflita, o horário e a versão anteriores permanecem.

Hold vencido é encerrado sob lock dentro da RPC, antes de inserir a nova ocupação. `expire_agenda_holds` faz o mesmo para a unidade autorizada. Se `pg_cron` existir, a migration agenda `zetta-expire-agenda-holds` a cada cinco minutos chamando `private.expire_agenda_holds_job`. Sem a extensão, a função continua chamável pelo banco e pelas RPCs.

A reserva temporária dura de 1 a 30 minutos; o padrão é 10. Confirmar, faltar, cancelar ou reagendar um confirmado grava tarefa manual com `CAPABILITY_NOT_VERIFIED`. Não há chamada FLW.

## Regras da vaga

Nova reserva exige a versão publicada atual na unidade, exatamente um profissional habilitado, cobertura da jornada (com buffers) por uma janela de turno ou exceção, e ausência de folga/feriado. Exigências de sala/equipamento seguem o catálogo: capacidade não cria várias identidades. Profissional sem vínculo de equipe pode ser reservado; se houver membership, ele precisa estar ativo na unidade.

Reagendamento usa a versão já gravada no agendamento, não a versão atual do catálogo. Check-in só sai de confirmado. Falta só sai de confirmado. Cancelamento sai de hold, confirmado ou check-in e pede motivo.

A lista de espera guarda cliente, versão, prioridade, janelas e profissionais aceitos. Oferecer ou aceitar um encaixe chama `agenda_reserve`. Aceite confirmado marca a entrada como `accepted`. Cancelar uma oferta devolve a entrada para `waiting` e libera o hold.

## API

Somente RPCs `SECURITY DEFINER`, `search_path=''`, autorização no corpo e `EXECUTE` para `authenticated`. Tabelas privadas, RLS ligada, sem grant ao navegador nem à service role.

| RPC | Uso |
| --- | --- |
| `agenda_grid` | Dia ou semana, recursos, agendamentos e bloqueios |
| `agenda_availability` | Candidatos e motivo (livre, sem jornada, folga, ocupado) |
| `agenda_openings` | Até 12 inícios locais, de 15 em 15 minutos |
| `agenda_reserve` | Hold ou confirmação; encaixe pelo mesmo caminho |
| `agenda_transition` | `confirm`, `check_in`, `cancel`, `no_show` |
| `agenda_reschedule` | Troca atômica de horário e recursos |
| `agenda_block` / `agenda_release_block` | Bloqueio rígido |
| `agenda_waitlist_join` / `agenda_waitlist` / `agenda_waitlist_cancel` | Fila |
| `expire_agenda_holds` | Limpeza autorizada da unidade |

Chave idempotente: 8 a 80 caracteres `[A-Za-z0-9_.:-]`. A mesma chave e o mesmo conteúdo devolvem o resultado gravado. Outro conteúdo na mesma chave responde `22023`. Conflito de ocupação responde `23P01`. Versão obsoleta responde `40001`. Escopo negado responde `42501`.

Eventos na outbox da agenda, na mesma transação: `appointment.held.v1`, `appointment.confirmed.v1`, `appointment.checked_in.v1`, `appointment.rescheduled.v1`, `appointment.cancelled.v1`, `appointment.no_show.v1`, `appointment.expired.v1`, `agenda.block.created.v1`, `agenda.block.released.v1`, `waitlist.joined.v1`, `waitlist.offered.v1`, `waitlist.accepted.v1`, `waitlist.cancelled.v1`. O `entity_id` é o agendamento, a entrada ou o bloqueio. O payload leva IDs, estado e horários, sem telefone nem texto clínico.

## Exemplo

O seed local confirma Mariana · exemplo em 16/11/2026, 10h–10h30, na avaliação de exemplo, com buffers 5/10. Não aplicar o seed no projeto hospedado.
