# Plan de implementación — MVP de partidos abiertos de pádel

> **Actualización:** Trello es la fuente de verdad para la secuencia y alcance actual de HU-01 a HU-22. Este plan conserva decisiones generales del MVP y se ajusta gradualmente por historia; no usar la antigua numeración de HU como criterio de aceptación vigente.

## Base del plan

Este plan toma como fuente el [tablero Metodologias Agiles](https://trello.com/b/wm7mKo3m/metodologias-agiles), en especial la [idea del proyecto](https://trello.com/c/NLIIQKSX/27-idea-del-proyecto-partidos-abiertos-de-p%C3%A1del) y las historias HU-01 a HU-12, junto con el alcance detallado adjunto por el usuario. El repositorio se encontraba vacío al comenzar. Este documento y [el índice de fases](phases/README.md) describen trabajo futuro: **no se implementó código**.

El producto permitirá registrarse, declarar un perfil de jugador, consultar clubes, publicar y buscar partidos, ver detalles, sumarse y bajarse, detectar partidos completos, gestionar los partidos propios y compartirlos por WhatsApp. Se excluyen ranking, ELO, resultados, reservas, pagos, chat y las historias HU-13 en adelante.

## Arquitectura propuesta

- **Frontend:** Angular con TypeScript, Router, Reactive Forms, HttpClient y componentes standalone. Las páginas se organizarán por funcionalidad; los componentes visuales comunes y los modelos se reutilizarán.
- **Backend:** monolito modular en Go con API REST. Cada módulo separará recepción HTTP, reglas de negocio y acceso a datos.
- **Datos:** PostgreSQL será la fuente de verdad. Las migraciones versionadas crearán usuarios, perfiles, clubes, partidos, participantes y notificaciones.
- **Caché:** Redis se usará únicamente para búsquedas de partidos, con caducidad e invalidación tras cambios.
- **Ejecución:** Docker Compose orquestará frontend, backend, PostgreSQL y Redis. Nginx servirá Angular y soportará el refresco de rutas.
- **Seguridad:** contraseñas con hash seguro, JWT para sesión, autorización del organizador y rol ADMIN para gestionar clubes.
- **Concurrencia:** la ocupación de plazas se resolverá con transacción y bloqueo en PostgreSQL; la plaza final no podrá asignarse a dos personas.

## Orden y regla de avance

Se desarrollará **una fase por vez, de la 01 a la 12**. Antes de iniciar una fase se revisarán sus dependencias y criterios; al terminar se verificarán compilación, pruebas relevantes, endpoints, migraciones y arranque Docker que correspondan al trabajo realizado. El estado se actualizará en [el índice](phases/README.md) y en el archivo de la fase solamente cuando exista evidencia. Los estados iniciales son `PENDING`.

Cada fase tendrá una explicación de qué se implementó, archivos creados o modificados, endpoints, cambios de PostgreSQL, funcionamiento en Angular, decisiones y forma de probarlo. Durante el desarrollo se incorporará un changelog; no forma parte de esta entrega de planificación.

## Fases

### 01 — Project Setup

**Objetivo:** preparar la estructura inicial y las convenciones sin implementar historias de usuario.

- Crear el proyecto Angular standalone con Router, Reactive Forms y HttpClient.
- Crear el módulo Go y las carpetas por dominio: auth, users, clubs, matches, notifications, cache, database, middleware y config.
- Definir contratos JSON, formato uniforme de errores, estructura de componentes compartidos y configuración local.
- Añadir README con requisitos, comandos y secuencia de fases.

**Verificación:** ambos proyectos base compilan; el árbol del proyecto y la documentación coinciden. [Detalle de fase](phases/phase-01-project-setup.md).

### 02 — Infraestructura

**Objetivo:** disponer de un entorno reproducible.

- Definir Docker Compose para Angular/Nginx, Go, PostgreSQL y Redis.
- Crear Dockerfiles multietapa y configuración Nginx con redirección de rutas Angular.
- Preparar variables de entorno de ejemplo sin almacenar secretos reales.
- Configurar volumen persistente de PostgreSQL y Redis sin persistencia.

**Verificación:** `docker compose up --build` inicia los cuatro servicios y una ruta Angular se puede refrescar. [Detalle de fase](phases/phase-02-infrastructure.md).

### 03 — Base de datos

**Objetivo:** establecer el esquema e información de desarrollo.

- Crear migraciones versionadas de `users`, `player_profiles`, `clubs`, `matches`, `match_players` y `notifications`.
- Añadir claves foráneas, unicidad de email y de participante por partido, límite fijo de cuatro jugadores y validación de rango de niveles.
- Crear índices para consultas reales de estado/fecha, club, zona y participantes.
- Sembrar usuarios y perfiles ficticios, 2 o 3 clubes de La Plata y partidos abiertos, completos y cancelados.

**Verificación:** las migraciones se aplican en una base vacía y los seeds permiten probar el MVP. [Detalle de fase](phases/phase-03-database.md).

### 04 — Registro, sesión y perfil (HU-01 y HU-02)

**Objetivo:** identificar jugadores y exponer su nivel declarado.

- Implementar registro, login, hash seguro, JWT y middleware de autenticación.
- Implementar lectura y edición del perfil propio y lectura del perfil público de otro jugador.
- Crear pantallas de registro, login, perfil y edición; conectar formularios reactivos, servicio de autenticación, interceptor y guard.
- Mantener el nivel como dato manual: categorías Principiante y 8va a 1ra; posición Drive, Revés o Indistinto; zona.

**Endpoints:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/users/me`, `PUT /api/users/me`, `GET /api/users/:id`.

**Verificación:** registro, login, persistencia de sesión, autorización y edición del perfil. [Detalle de fase](phases/phase-04-auth-profile.md).

### 05 — Clubes (HU-03)

**Objetivo:** consultar clubes y permitir administración básica.

- Publicar listado y detalle de clubes.
- Crear, editar y eliminar clubes solo con rol ADMIN.
- Construir listado Angular con ClubCard y formulario administrativo simple, sin panel complejo.

**Endpoints:** `GET /api/clubs`, `GET /api/clubs/:id`, `POST /api/clubs`, `PUT /api/clubs/:id`, `DELETE /api/clubs/:id`.

**Verificación:** consulta pública y rechazo de mutaciones sin ADMIN. [Detalle de fase](phases/phase-05-clubs.md).

### 06 — Configurar horarios disponibles (HU-04)

**Objetivo:** permitir que un encargado configure horarios recurrentes por cancha, consulte una fecha por vez y bloquee/libere turnos puntuales.

- Editar varios intervalos no superpuestos por día y duración de turnos de 60 o 90 minutos.
- Autoguardar cambios válidos y migrar la demo local de `localStorage` v1 a v2.
- Calcular únicamente los turnos de la fecha seleccionada; avanzar sin límite de semanas.
- Guardar los bloqueos puntuales como excepciones locales, sin generar anticipadamente todos los turnos futuros.
- Mantener el flujo responsive y accesible, sin solicitudes al backend ni cambios de infraestructura.

**Verificación:** pruebas del generador, formularios, agenda, persistencia local y navegación; build Angular y build del contenedor frontend. La disponibilidad compartida, reservas reales y persistencia remota quedan pendientes de integración backend. [Detalle de fase](phases/phase-06-available-hours.md).

### 07 — Buscar partidos (HU-05)

**Objetivo:** encontrar partidos abiertos sin descargar toda la base al navegador.

- Implementar búsqueda de partidos futuros, abiertos y con plazas libres.
- Combinar filtros de zona, club, fecha y nivel declarado; ordenar por fecha y hora ascendentes.
- Incorporar paginación del backend: página de 20 por defecto, máximo 100.
- Crear MatchFilters, MatchCard y Pagination reutilizables; conservar filtros y página en query parameters.

**Endpoint:** `GET /api/matches`.

**Verificación:** filtros combinados, total y páginas correctos, y persistencia de URL al refrescar. [Detalle de fase](phases/phase-07-search-matches.md).

### 08 — Detalle y participación (HU-06, HU-07, HU-08 y HU-09)

**Objetivo:** ver quién juega, sumarse, completar el partido y liberar una plaza.

- Publicar detalle visible sin sesión: club, fecha, organizador, jugadores, niveles, posiciones y lugares.
- Advertir cuando el nivel declarado está fuera del rango y pedir confirmación antes de sumarse.
- Ejecutar join y leave bajo transacción; bloquear el partido antes de comprobar la última plaza.
- Al ingresar el cuarto jugador, pasar de OPEN a FULL, retirar el partido de búsqueda y avisar internamente a los cuatro jugadores.
- Al salir un jugador, liberar la plaza y pasar de FULL a OPEN; avisar al organizador y restantes.
- Impedir que el organizador abandone directamente el partido; podrá cancelarlo en la fase 09.
- Mostrar notificaciones internas mínimas en Angular.

**Endpoints:** `GET /api/matches/:id`, `POST /api/matches/:id/join`, `DELETE /api/matches/:id/leave` y lectura/marcado de notificaciones.

**Verificación:** duplicados, partido lleno, transiciones de estado y prueba de dos joins simultáneos sobre la última plaza. [Detalle de fase](phases/phase-08-match-detail-participation.md).

### 09 — Editar o cancelar partido (HU-10)

**Objetivo:** dar control al organizador sobre sus publicaciones.

- Permitir edición de club, fecha, horario, niveles y observaciones.
- Permitir cancelación; el partido cancelado deja de aparecer en búsqueda.
- Notificar a los anotados ante cambio de club, fecha u horario, y ante cancelación.
- Rechazar operaciones realizadas por alguien distinto del organizador.

**Endpoints:** `PUT /api/matches/:id`, `POST /api/matches/:id/cancel`.

**Verificación:** permisos, cambios, cancelación y avisos. [Detalle de fase](phases/phase-09-match-management.md).

### 10 — Mis partidos (HU-11)

**Objetivo:** reunir partidos organizados y partidos a los que el jugador se sumó.

- Listar próximos y pasados, incluyendo estados abierto, completo, cancelado y jugado.
- Evitar duplicar un partido donde el usuario sea organizador y participante.
- Reutilizar MatchCard y paginar los resultados cuando corresponda.

**Endpoint:** `GET /api/users/me/matches`.

**Verificación:** un usuario con partidos de distintos estados ve las secciones correctas. [Detalle de fase](phases/phase-10-my-matches.md).

### 11 — Compartir por WhatsApp (HU-12)

**Objetivo:** facilitar la difusión de un partido abierto.

- Crear desde el detalle un enlace `wa.me` con club, fecha, hora, rango de nivel y URL absoluta del partido.
- Asegurar que `/partidos/:id` abra sin autenticación; para sumarse, dirigir a login o registro.
- Verificar la URL al abrirla directamente y al refrescarla en Nginx.

**Verificación:** enlace codificado, detalle público y acceso protegido a join. [Detalle de fase](phases/phase-11-whatsapp-sharing.md).

### 12 — Caché y pruebas finales

**Objetivo:** acelerar búsqueda sin comprometer consistencia.

- Cachear `GET /api/matches` en Redis durante aproximadamente 60 segundos, incluyendo filtros, página y tamaño en la clave.
- Invalidar búsquedas al crear, editar, sumarse, bajarse o cancelar.
- Si Redis no está disponible, continuar leyendo PostgreSQL.
- Ejecutar pruebas de backend y frontend prioritarias, builds, migraciones y revisión de Docker Compose.
- Actualizar documentación final y marcar fases completas únicamente con evidencia.

**Verificación:** caché, invalidación, degradación y flujos de punta a punta. [Detalle de fase](phases/phase-12-cache-testing.md).

## Decisiones que deben documentarse al implementar

- **Niveles:** definir una representación estable para Principiante y 8va a 1ra que permita filtrar rangos sin convertirlos en ranking.
- **Zona horaria:** comparar fechas y horas de partidos con la hora local de La Plata.
- **Baja antes del partido:** Trello deja pendiente cuántas horas antes se puede salir. Para el MVP se aplicará una regla simple y se registrará explícitamente.
- **ADMIN:** definir cómo se crea la primera cuenta administradora en desarrollo sin permitir que un usuario se otorgue ese rol desde el registro público.
- **Partido pasado:** definir cómo se refleja PLAYED en Mis partidos sin agregar un flujo de resultados.

