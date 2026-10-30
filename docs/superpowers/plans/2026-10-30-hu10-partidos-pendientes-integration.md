# HU-10: integración de partidos pendientes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mostrar en `/partidos` convocatorias reales y completar creación y unión de HU-06/HU-11 con persistencia compartida entre usuarios.

**Architecture:** Un partido pendiente referencia una reserva que bloquea la cancha y guarda nivel/estado; sus participantes se almacenan por usuario. Go expone consulta pública y creación/unión con JWT. Angular consume la API desde servicios tipados, conserva la pantalla existente y conecta los accesos de crear, detalle y unión.

**Tech Stack:** Angular, TypeScript, Go, `net/http`, PostgreSQL, pgx, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-30-hu10-partidos-pendientes-integration-design.md`

## Global Constraints

- Rama de trabajo: `hu-10-front-back-VerPartidoPendientes`.
- Crear y unirse requiere JWT; consultar partidos expone únicamente nombre visible, nivel y posición.
- Una reserva asociada permanece como fuente de ocupación y de conflictos horarios.
- No implementar pagos, baja, reemplazo, agenda administrativa ni exponer contacto personal.
- Sin commit, push, merge ni PR hasta revisión del usuario.
- Al terminar cambios, reconstruir y reiniciar todos los contenedores del proyecto.

## Review Focus

- Dos usuarios intentan tomar el último cupo: solo uno debe quedar inscripto.
- El organizador intenta unirse otra vez: no debe duplicar lugar.
- Un usuario sin sesión intenta crear o sumarse: API debe responder no autorizado.
- Un horario dejó de estar disponible entre consulta y envío: alta debe responder conflicto.
- Los errores de red/servidor deben conservar filtros y mostrar recuperación en la UI.

---

### Task 1: Persistencia del partido pendiente vinculada a reserva

**Files:**
- Create: `backend/migrations/008_pending_matches.sql`
- Modify: `backend/internal/database/migrate.go` solo si el runner requiere registro explícito.

**Interfaces:**
- La tabla `pending_matches` referencia una reserva única, almacena nivel buscado y estado abierto/completo.
- La tabla de participantes referencia partido y usuario, con unicidad por partido/usuario.

- [x] Crear migración compatible con registros existentes y restricciones para estados, cupo máximo de cuatro y referencias.
- [x] Revisar el esquema de migración para que una reserva existente no cambie de significado.
- [x] Confirmar que el migrador automático carga el SQL desde `backend/migrations/embed.go`.

### Task 2: Dominio y repositorio Go para consulta, creación y unión

**Files:**
- Create: `backend/internal/matches/model.go`
- Create: `backend/internal/matches/postgres.go`
- Create: `backend/internal/matches/service.go`
- Modify: `backend/cmd/api/routes.go`

**Interfaces:**
- Recurso de lectura: `Match` con complejo, cancha, fecha, inicio/fin, nivel buscado y participantes visibles; no hay precio en el esquema.
- Operaciones: `GET /api/v1/matches`, `GET /api/v1/public/complexes`, alta abierta en `/matches`, unión en `/players`, y avisos privados en `/match-notices`.
- La reserva completa de HU-06 reutiliza el endpoint `/reservations` actual.
- La consulta es pública; escritura queda bajo `auth.RequireUser`.

- [x] Implementar parsing y validación de fecha/filtros usando zona horaria y UUID existentes.
- [x] Crear reserva, partido y participante organizador dentro de una sola transacción.
- [x] Validar horario futuro, horario configurado y no solapamiento con la misma disciplina de reservas.
- [x] Implementar unión por usuario, protección transaccional del último cupo y transición a completo.
- [x] Mapear cuerpo inválido, no autorizado, inexistente, completo/duplicado, horario ocupado e internos a respuestas HTTP coherentes.
- [x] Exponer únicamente nombre, nivel y posición de cada jugador; no seleccionar email ni teléfono.
- [x] Al completar el grupo, persistir avisos para los participantes y permitir marcarlos como leídos.

### Task 3: Servicio Angular y modelo tipado de partidos

**Files:**
- Create: `frontend/src/app/matches/match-api.model.ts`
- Create: `frontend/src/app/matches/match-api.mapper.ts`
- Create: `frontend/src/app/matches/match-api.service.ts`
- Create: `frontend/src/app/bookings/reservation-api.service.ts`
- Modify: `frontend/src/app/landing/landing.data.ts`
- Modify: `frontend/src/app/landing/match-search.page.ts`

**Interfaces:**
- `MatchApiService` adapta consulta, opciones de complejos/canchas, disponibilidad, creación abierta, unión y notificaciones.
- El flujo “Partido completo” reutiliza `ReservationApiService` y el endpoint de reservas existente.
- `MatchPreview` conserva el modelo requerido por las tarjetas y el modal, con adaptación explícita desde DTO.

- [x] Validar la forma de respuesta en el borde HTTP y mapear IDs/fechas/jugadores mediante un adaptador tipado.
- [x] Cargar resultados reales al entrar y aplicar filtros locales compatibles con los campos disponibles.
- [x] Retirar el uso de `MATCHES` de la búsqueda; conservar los fixtures de Home.
- [x] Representar carga, error, reintento y lista vacía sin borrar el estado de filtros.
- [x] Mantener el acceso público a resultados y proteger creación/unión; `returnUrl` continúa tras iniciar sesión.

### Task 4: Flujo de unión desde el detalle de partido

**Files:**
- Modify: `frontend/src/app/landing/match-search.page.ts`
- Modify: `frontend/src/app/landing/match-search.page.html`
- Modify: `frontend/src/app/landing/match-detail-dialog.component.ts`
- Modify: `frontend/src/app/landing/match-detail-dialog.component.html`
- Modify: `frontend/src/app/auth/auth.guard.ts`
- Modify: `frontend/src/app/auth/login.page.ts`

- [x] Requerir sesión al ejecutar “Unirme”; redirigir a ingreso preservando `returnUrl` y respetarlo tras autenticar, sin cambiar el destino por defecto de otros roles.
- [x] Llamar al endpoint real y actualizar tarjeta, plantel y cupos con el partido devuelto.
- [x] Mostrar aviso comprensible para completo/duplicado, error de red y éxito; limpiar toast con temporizador.
- [x] Presentar diferencias de nivel como aviso sin bloquear la unión.

### Task 5: Flujo de creación HU-06 conectado a turnos reales

**Files:**
- Create: `frontend/src/app/matches/create-match-dialog.component.ts`
- Create: `frontend/src/app/matches/create-match-dialog.component.html`
- Create: `frontend/src/app/matches/create-match-dialog.component.scss`
- Modify: `frontend/src/app/landing/landing-header.component.ts`
- Modify: `frontend/src/app/landing/match-search.page.ts`
- Modify: `frontend/src/app/app.routes.ts` solo si la navegación elegida requiere ruta dedicada.

- [x] Mantener el modal “Nuevo Partido - Modal de Reserva - PádelMatch La Plata” compacto y responsive, con partido completo y abierto.
- [x] Cargar complejos/canchas y disponibilidad reales; permitir elegir horario libre.
- [x] Usar la sesión como organizador; solicitar teléfono solo para el grupo completo porque falta en el perfil.
- [x] En éxito, cerrar el modal, mostrar toast y refrescar búsqueda; en conflicto, conservar campos e informar.
- [x] Abrir el mismo flujo desde los accesos existentes de “Crear partido”.

### Task 6: Documentar, construir y dejar el entorno listo

**Files:**
- Create: `docs/phases/phase-hu10-partidos-pendientes.md`
- Create: `docs/phases/hu10-api-partidos-pendientes.md`
- Modify: `README.md` solo si hay que corregir pasos de inicio.

- [x] Documentar fases, archivos principales, límites de API/datos, decisiones de seguridad y pasos de prueba manual.
- [x] Documentar contratos usados y campos aún no disponibles (precio y teléfono de perfil).
- [x] Construir backend y frontend. Angular reportó avisos presupuestarios para el bundle inicial y dos hojas SCSS.
- [x] Reconstruir y reiniciar todos los contenedores definidos por Compose para aplicar la migración y publicar la UI.
- [x] Confirmar salud de los servicios y entregar URL/instrucciones para probar búsqueda, creación y unión.
- [ ] Recorrer alta y unión autenticadas con dos cuentas y revisar el diff/estado final; los cambios quedan sin commit ni push.

## Revisión del plan

- Persistencia, validación, conflictos y cupos quedan en las tareas 1–2.
- Consulta pública y filtros quedan en la tarea 3.
- Unión e identidad del jugador quedan en la tarea 4.
- Alta de partido abierto queda en la tarea 5.
- Docker y documentación quedan en la tarea 6.
- No se incluyen archivos de pruebas ni ejecución de suites en este plan; la verificación prevista cubre builds, salud de contenedores y recorrido manual.
