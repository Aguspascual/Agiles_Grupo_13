# HU-00 · Inicio con datos reales

## Intención

La página Inicio debe mostrar clubes y partidos existentes en la base de datos, para que el jugador encuentre información vigente y pueda navegar a clubes, buscar partidos o iniciar la creación de uno.

## Objetivos

- Reemplazar las colecciones de demostración usadas por Inicio con los datos de `GET /api/v1/public/complexes` y `GET /api/v1/matches`.
- Mantener el diseño y la navegación actuales; agregar estados de carga, error recuperable y ausencia de resultados.
- Calcular las cifras de Inicio únicamente desde los clubes y partidos recibidos; nombrarlas para que describan el conjunto medido.
- No mostrar fotografías, calificaciones ni cantidades de turnos por club que el API no entrega.
- Mantener los filtros de Inicio conectados con `/partidos`: una búsqueda enviada explícitamente puede llevar filtros; una visita directa a `/partidos` permanece sin filtros.

## No objetivos

- Cambiar o ampliar el backend, la base de datos, contratos API o infraestructura.
- Simular clubes, partidos, jugadores, imágenes, calificaciones, cupos, valoraciones o cifras globales cuando la API no las provee.
- Rediseñar la página Buscar partidos o el directorio completo de clubes.

## Restricciones

- Trabajo solo en frontend Angular y reutilización de `ComplexApiService` y `MatchApiService`.
- Los endpoints existentes son públicos y leen clubes/partidos persistidos.
- Un club público expone id, nombre, dirección y zona. Un partido expone club, cancha, fecha, horarios, nivel y jugadores.
- No existe en estos contratos una imagen de club/cancha, rating, total global de jugadores ni turnos libres por club.
- Los textos de interfaz (títulos, etiquetas y mensajes de estado) permanecen en frontend; no representan datos simulados.

## Enfoques considerados

1. Conectar solo el directorio de clubes y mantener las tarjetas restantes como demostración. Se descarta porque dejaría mockups visibles en Inicio.
2. Alimentar Inicio con clubes y partidos de los endpoints existentes, derivar métricas del conjunto recibido y omitir atributos ausentes. **Elegido**, porque elimina los datos falsos sin ampliar el backend.
3. Crear un endpoint agregado de Home con fotos y estadísticas. Se descarta en esta HU porque requiere cambios de backend y contratos fuera del alcance frontend actual.

## Diseño aprobado por el usuario

- Todo dato de dominio que se muestra en Inicio proviene del backend conectado a la base de datos; no se deja contenido de demostración.
- Los resúmenes se calculan a partir de la respuesta real y se etiquetan como métricas de partidos abiertos/clubes devueltos, no como cifras globales.
- Donde la API no entrega un dato visual o comercial, la interfaz lo omite y conserva un estado vacío claro, sin sustituirlo por un fixture.
- Una búsqueda enviada desde Inicio puede pasar filtros intencionales a `/partidos`; la ruta abierta directamente no preselecciona ninguno.

## Archivos previstos

- `frontend/src/app/landing/landing.page.ts` y `landing.page.html`: consulta paralela, estado de carga/error/datos vacíos, datos derivados y render condicional.
- `frontend/src/app/landing/club-card.component.ts` y estilos: tarjeta basada en `PublicComplex`, sin rating, imagen ni disponibilidad ficticia.
- `frontend/src/app/landing/landing.data.ts`: retirar fixtures de Home que dejen de utilizarse.
- `frontend/src/app/landing/landing.page.spec.ts`: pruebas con respuestas API reales simuladas por el test, incluyendo vacío/error y ausencia de fixtures en la UI.
- `frontend/src/app/landing/match-search.page.ts`: aceptar query params de filtros enviados expresamente desde Inicio, manteniendo defaults vacíos.
- `docs/phases/hu-00-inicio-datos-reales.md`: fases, archivos, validaciones y límites.

## Riesgos y decisiones pendientes para implementación

- La API no entrega fotos de clubes/canchas; la portada y las tarjetas no podrán mostrar imágenes específicas hasta que el backend las exponga.
- El listado de partidos devuelve partidos abiertos vigentes; las recomendaciones se obtendrán de ese mismo conjunto y del nivel del jugador cuando tenga sesión.
- Las pruebas de otras HU pueden conservar expectativas de fixtures anteriores; se actualizarán solo las pruebas de Inicio que cubra este cambio.
