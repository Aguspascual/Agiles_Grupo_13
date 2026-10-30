# HU-00 — Inicio conectado a datos persistidos

## Fases realizadas

1. Relevé los contratos frontend disponibles para complejos públicos y partidos abiertos.
2. Conecté Inicio a ambos servicios y agregué estados de carga, error con reintento y respuesta vacía.
3. Reemplacé clubes, partidos, fotografías, disponibilidad, puntuaciones y estadísticas de demostración por datos recibidos o métricas derivadas.
4. Conecté los filtros elegidos en Inicio con parámetros de búsqueda. Al abrir `/partidos` directamente, los filtros permanecen vacíos.
5. Documenté las validaciones y los límites del contrato actual.

## Archivos principales

- `frontend/src/app/landing/landing.page.ts` y `.html`: consulta de datos, estados de pantalla, tarjetas y métricas derivadas.
- `frontend/src/app/landing/club-card.component.ts` y `.scss`: tarjeta accesible basada en el modelo público de complejo.
- `frontend/src/app/landing/match-card.component.ts`: oculta la imagen de presentación cuando la respuesta no aporta una imagen real y enlaza a búsqueda.
- `frontend/src/app/landing/landing-footer.component.ts`: elimina clubes y funciones promocionadas que no tienen datos en el contrato.
- `frontend/src/app/landing/match-search.page.ts`: aplica únicamente filtros explícitos recibidos por query params.
- `frontend/src/app/landing/landing.integration.spec.ts` y `match-search.hu11.spec.ts`: pruebas de respuestas reales, estados y filtros.

## Servicios existentes utilizados

- `GET /api/v1/public/complexes`: nombre, dirección, zona e identificador del complejo.
- `GET /api/v1/matches`: partidos abiertos, complejo/cancha, fecha/horario, nivel, cupos faltantes, jugadores y características básicas de cancha.

No se modificó backend, base de datos, contratos HTTP ni infraestructura.

## Validaciones

- Pruebas enfocadas de `landing.integration.spec.ts` y `match-search.hu11.spec.ts`.
- Build Angular de producción.
- Verificación final de `git diff --check`, rama y alcance de los archivos.

## Límites del contrato

La API no entrega imágenes de complejos/canchas, puntajes, cantidad de turnos disponibles por complejo, jugadores activos globales ni estadísticas globales. Inicio no muestra esos datos. Las cifras visibles son conteos calculados únicamente sobre las respuestas recibidas en la pantalla; la suma de jugadores se etiqueta como inscripciones porque una persona puede aparecer en más de un partido. No se presentan como totales de toda la plataforma.
