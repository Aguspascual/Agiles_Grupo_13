# Reglas de negocio

Reglas definidas por el equipo mediante WhatsApp, reuniones presenciales y Trello. Se comparten entre backend y frontend; cada funcionalidad las vincula con su TDD y sus pruebas.

## Acuerdos

| ID | Regla | Historias relacionadas |
| --- | --- | --- |
| RN-01 | Un grupo completo no puede reemplazar un partido incompleto que ocupa el turno. | [HU-12](https://trello.com/c/xfaPiCES). |
| RN-02 | La reserva puede cancelarse si faltan al menos 4 horas para el inicio, incluyendo el instante exacto del límite. | [HU-14](https://trello.com/c/kWBU1esU). |
| RN-03 | Un jugador puede bajarse si faltan al menos 2 horas para el inicio, incluyendo el instante exacto del límite. | [HU-13](https://trello.com/c/C1HTIYGW). |
| RN-04 | Los acompañantes del organizador ocupan cupos sin cuenta ni identificación individual. | [HU-09](https://trello.com/c/Mq4bFH1B), [HU-11](https://trello.com/c/WMX61wS4). |
| RN-05 | Un partido incompleto se cancela y libera la cancha 4 horas antes del inicio. | HU-09, HU-11, HU-13; [vencimiento de partidos](https://trello.com/c/I7MvkEz6). |
| RN-06 | Reprogramar una reserva requiere aceptación de sus reservantes. No cambiarla unilateralmente. | [HU-04](https://trello.com/c/PfnE8VXU), [HU-07](https://trello.com/c/wNViLVXu); [reprogramación](https://trello.com/c/rJEWN9lR). |
| RN-07 | Los plazos se calculan con el reloj del servidor y la hora de La Plata: `America/Argentina/Buenos_Aires`. | HU-04 a HU-17, cuando manejan fechas o disponibilidad. |
| RN-08 | Cancelación y vencimiento deben persistir el cambio y liberar el turno de forma atómica. Repetir una operación no duplica sus efectos ni los avisos a los afectados. | HU-09, HU-13, HU-14 y vencimiento. |

Los permisos del encargado y la baja del organizador deben definirse expresamente; no se deducen de los plazos del reservante. Una regla documentada no significa que la funcionalidad esté implementada o verificada.

Para un turno a las 20:00, se permite cancelar exactamente a las 16:00 y bajarse exactamente a las 18:00; cualquier instante posterior queda fuera del plazo. Comparar los instantes sin redondear.

## Pendientes por prioridad

La prioridad indica cuándo resolver la decisión respecto de la HU afectada; no bloquea trabajo independiente.

| Prioridad | Decisión pendiente | Vinculación e impacto en Sprint 2 |
| --- | --- | --- |
| **Crítica** | HU-12 permite reemplazar un partido, pero RN-01 lo impide. Alinear o retirar ese comportamiento. | [HU-12](https://trello.com/c/xfaPiCES), Sprint 2. No implementar la sustitución con los criterios actuales. |
| **Crítica** | Si un partido completo pierde un jugador entre 4 y 2 horas antes, ¿se reabre o se cancela? ¿Puede crearse uno incompleto cuando faltan menos de 4 horas? | [HU-09](https://trello.com/c/Mq4bFH1B), [HU-11](https://trello.com/c/WMX61wS4), [HU-13](https://trello.com/c/C1HTIYGW). La tarjeta de [vencimiento](https://trello.com/c/I7MvkEz6) está en Backlog: acordar cómo incorporar RN-05 a estas HUs antes de implementar sus transiciones. |
| **Alta** | ¿Cómo se agregan/liberan los cupos de acompañantes y quién recibe los avisos por ellos? | HU-09 y HU-11, Sprint 2. Resolver ocupación y notificaciones antes de confirmar cuatro jugadores. |
| **Alta** | ¿Quién debe aceptar una reprogramación, en qué plazo y qué ocurre ante rechazo o falta de respuesta? | HU-04 y HU-07: preservar reservas es necesario en Sprint 2. El flujo completo de [reprogramación](https://trello.com/c/rJEWN9lR) está en Backlog; acordar su alcance antes de habilitarlo, sin incorporarlo automáticamente al sprint. |
| **Alta** | ¿El encargado puede cancelar fuera de plazo? ¿El organizador puede bajarse o debe cancelar la reserva? | [HU-07](https://trello.com/c/wNViLVXu), HU-13 y HU-14, Sprint 2. Precisar permisos y efectos antes de habilitar esas acciones. |
| **Posterior** | ¿Cómo afectan los cupos sin identidad al registro de ausencias y a la reputación? | [HU-19](https://trello.com/c/kDMIu3T8) y [HU-20](https://trello.com/c/m3l1tc5m), Sprint 3. No bloquea Sprint 2 si no se atribuye historial a acompañantes sin cuenta. |

Los ajustes de tarjetas se acuerdan con el equipo antes de modificar Trello. Los criterios y casos de borde se concretan en el TDD de cada funcionalidad.
