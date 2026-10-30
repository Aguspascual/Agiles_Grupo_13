# Reglas de negocio

Reglas definidas por el equipo mediante WhatsApp, reuniones presenciales y Trello. Se comparten entre backend y frontend; cada funcionalidad las vincula con su TDD y sus pruebas.

## Acuerdos

| ID | Regla | Historias relacionadas |
| --- | --- | --- |
| RN-01 | Un grupo completo puede reemplazar un partido pendiente que ocupa el turno solo cuando faltan menos de 4 horas para su inicio; a las 4 horas exactas todavía no se permite. | [HU-12](https://trello.com/c/xfaPiCES). |
| RN-02 | La reserva puede cancelarse si faltan al menos 4 horas para el inicio, incluyendo el instante exacto del límite. | [HU-14](https://trello.com/c/kWBU1esU). |
| RN-03 | Un jugador puede bajarse si faltan al menos 2 horas para el inicio, incluyendo el instante exacto del límite. | [HU-13](https://trello.com/c/C1HTIYGW). |
| RN-04 | Los acompañantes del organizador ocupan cupos sin cuenta ni identificación individual. | [HU-09](https://trello.com/c/Mq4bFH1B), [HU-11](https://trello.com/c/WMX61wS4). |
| RN-05 | Un partido incompleto se cancela y libera la cancha 4 horas antes del inicio. | HU-09, HU-11, HU-13; [vencimiento de partidos](https://trello.com/c/I7MvkEz6). |
| RN-06 | Reprogramar una reserva requiere aceptación de sus reservantes. No cambiarla unilateralmente. | [HU-04](https://trello.com/c/PfnE8VXU), [HU-07](https://trello.com/c/wNViLVXu); [reprogramación](https://trello.com/c/rJEWN9lR). |
| RN-07 | Los plazos se calculan con el reloj del servidor y la hora de La Plata: `America/Argentina/Buenos_Aires`. | HU-04 a HU-17, cuando manejan fechas o disponibilidad. |
| RN-08 | Cancelación y vencimiento deben persistir el cambio y liberar el turno de forma atómica. Repetir una operación no duplica sus efectos ni los avisos a los afectados. | HU-09, HU-13, HU-14 y vencimiento. |
| RN-09 | La configuración recurrente de una cancha se administra por día de la semana, con sus franjas y duración de turno. Dar de alta, modificar o dar de baja un día no reemplaza la configuración de los demás días. | HU-04. |
| RN-10 | Si un cambio de configuración afecta reservas vigentes, se rechaza íntegramente y se conserva la configuración anterior hasta resolver las reservas afectadas. No modificar ni cancelar esas reservas desde la configuración de horarios. | HU-04; RN-06 y reprogramación. |
| RN-11 | Por ahora, cada franja recurrente debe empezar y terminar dentro del mismo día. No se admiten franjas que crucen medianoche. | HU-04. |
| RN-12 | Los horarios de una cancha pueden administrarlos el encargado asignado a su complejo y el administrador general. El encargado no puede operar horarios de otros complejos. | HU-04. |
| RN-13 | Deshabilitar un día impide nuevas reservas y conserva sus franjas y duración para reactivarlo. Se permite aunque existan reservas futuras: se mantienen vigentes y se juegan normalmente, sin cambios de horario o duración. Dar de baja elimina la configuración y requiere una nueva alta, sujeto a RN-15. Ninguna acción borra reservas; se aplica RN-10 a cambios que las afecten. | HU-04; disponibilidad HU-05. |
| RN-14 | Los turnos pueden durar 60 o 90 minutos. Cada día configurado tiene una única duración para nuevas reservas, común a todas sus franjas. Se permite cambiarla aunque haya reservas futuras: las existentes conservan sus horarios y duración originales. Los nuevos turnos no pueden solaparse con esas reservas. | HU-04; disponibilidad HU-05 y reservas. |
| RN-15 | No se puede dar de baja la configuración de un día mientras haya reservas futuras vigentes para ese día y cancha, aunque esté deshabilitado. Se conserva la configuración; puede deshabilitarse para impedir nuevas reservas hasta resolver las existentes. | HU-04. |
| RN-16 | Un partido completo con tres invitados queda reservado durante 30 minutos desde su creación. Si las tres invitaciones no se aceptan antes del vencimiento, el servidor cancela la reserva y libera el turno de forma atómica. Al confirmarse las tres, el partido pasa a completo y ya no vence. La búsqueda autenticada de invitados requiere 6 caracteres como mínimo y vincula la invitación a la cuenta elegida; las invitaciones manuales pueden validarse por correo o enlace. El correo se prepara desde el frontend con el cliente del usuario. | HU-16. |

Los permisos del encargado para cancelar fuera de plazo y la baja del organizador deben definirse expresamente; no se deducen de los plazos del reservante. Una regla documentada no significa que la funcionalidad esté implementada o verificada.

Para un turno a las 20:00, se permite cancelar exactamente a las 16:00 y bajarse exactamente a las 18:00; cualquier instante posterior queda fuera del plazo. Comparar los instantes sin redondear.

## Pendientes por prioridad

La prioridad indica cuándo resolver la decisión respecto de la HU afectada; no bloquea trabajo independiente.

| Prioridad | Decisión pendiente | Vinculación e impacto en Sprint 2 |
| --- | --- | --- |
| **Crítica** | Si un partido completo pierde un jugador entre 4 y 2 horas antes, ¿se reabre o se cancela? ¿Puede crearse uno incompleto cuando faltan menos de 4 horas? | [HU-09](https://trello.com/c/Mq4bFH1B), [HU-11](https://trello.com/c/WMX61wS4), [HU-13](https://trello.com/c/C1HTIYGW). La tarjeta de [vencimiento](https://trello.com/c/I7MvkEz6) está en Backlog: acordar cómo incorporar RN-05 a estas HUs antes de implementar sus transiciones. |
| **Alta** | ¿Cómo se agregan/liberan los cupos de acompañantes y quién recibe los avisos por ellos? | HU-09 y HU-11, Sprint 2. Resolver ocupación y notificaciones antes de confirmar cuatro jugadores. |
| **Alta** | ¿Quién debe aceptar una reprogramación, en qué plazo y qué ocurre ante rechazo o falta de respuesta? | HU-04 y HU-07. En HU-04 se aplica RN-10: rechazar cambios que afecten reservas, sin habilitar reprogramaciones. El flujo completo de [reprogramación](https://trello.com/c/rJEWN9lR) está en Backlog; cerrar estos detalles antes de habilitarlo, sin incorporarlo automáticamente al sprint. |
| **Alta** | ¿El encargado puede cancelar fuera de plazo? ¿El organizador puede bajarse o debe cancelar la reserva? | [HU-07](https://trello.com/c/wNViLVXu), HU-13 y HU-14, Sprint 2. Precisar permisos y efectos antes de habilitar esas acciones. |
| **Posterior** | ¿Cómo afectan los cupos sin identidad al registro de ausencias y a la reputación? | [HU-19](https://trello.com/c/kDMIu3T8) y [HU-20](https://trello.com/c/m3l1tc5m), Sprint 3. No bloquea Sprint 2 si no se atribuye historial a acompañantes sin cuenta. |

Los ajustes de tarjetas se acuerdan con el equipo antes de modificar Trello. Los criterios y casos de borde se concretan en el TDD de cada funcionalidad.
