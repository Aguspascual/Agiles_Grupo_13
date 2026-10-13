# Diseño HU-00: landing pública y exploración de clubes

## Objetivo

Mejorar las pantallas públicas de PádelMatch para que sean legibles, atractivas y útiles al probar el frontend sin backend. Home y Buscar partidos deben conservar la dirección visual de Stitch, y Clubes debe ofrecer su propia pantalla pública.

## Alcance aprobado

- Aumentar aproximadamente un 20% la escala visual de Home y Buscar partidos, priorizando tipografía, ancho de contenido y espaciado. La escala se ajustará en tablet y móvil para evitar desbordes.
- En Home, cambiar `CLUBES ASOCIADOS LP` por `CLUBES ASOCIADOS`.
- Reemplazar la afirmación `NIVEL VERIFICADO APA` por la métrica informativa `CATEGORÍAS DISPONIBLES`, con rango `2da a 8va` acorde a los niveles que ofrece la demo.
- Quitar `A TU MEDIDA · Filtrado automático: 5ta División` y `MATCHMAKING EN VIVO EN LA PLATA`.
- Quitar del Home el componente visual `MODO DE PRUEBA · Accesos directos`.
- Agregar fotos de canchas/clubes a las tarjetas de Buscar partidos. Se reutilizarán imágenes locales incluidas en el frontend y se asignarán desde los datos de muestra.
- Crear la ruta pública `/clubes` siguiendo la pantalla `Clubes - PádelMatch La Plata` del proyecto Stitch, con tarjetas, imágenes y controles de exploración apropiados para los datos de muestra.
- Actualizar los accesos de navegación y de la pantalla Home para dirigir a `/clubes`.
- Agregar a la descripción de la tarjeta compartida de HU-00 en Trello una sección de accesos directos locales basada en `http://localhost:8080`, para que el equipo pueda copiar y abrir las rutas existentes.

## Enfoques considerados

1. **Mantener separadas las historias (seleccionado):** cambios de Home, Buscar partidos y la pantalla pública Clubes pertenecen a HU-00, cuya tarjeta ya contempla explorar clubes y partidos. Mis partidos queda en HU-17, en otra rama y entrega.
2. **Incluir todas las pantallas en HU-00:** permitiría revisarlas en una sola entrega, pero mezcla historias y dificulta el seguimiento por HU.

## Estructura prevista

- Mantener `LandingPage`, `MatchSearchPage`, `MatchCardComponent`, `ClubCardComponent` y los datos de muestra existentes como piezas reutilizables.
- Incorporar una pantalla y ruta pequeña para `/clubes`; extraer componentes solo cuando haya una interfaz realmente repetida entre Clubes y Home.
- Añadir a `MatchPreview` la referencia a una imagen local del club/cancha y renderizarla en `MatchCardComponent` con texto alternativo significativo.
- Quitar la tarjeta de accesos de Home. La lista de enlaces vive en la tarjeta Trello de HU-00, no en la experiencia del producto.
- No implementar inicio de sesión, persistencia ni llamadas HTTP para la navegación pública de Clubes.

## Datos y límites

Clubes y partidos continúan usando datos locales ilustrativos. El frontend no implementa APIs, endpoints, persistencia, autenticación real ni comportamiento de backend. Los accesos en Trello apuntan al entorno local del equipo en `localhost:8080`.

## Verificación prevista

- Compilar el frontend Angular.
- Ejecutar las pruebas existentes de Home, búsqueda y Clubes; agregar cobertura de ruta/elementos si falta.
- Probar en navegador Home, Buscar partidos y `/clubes`, validar filtros/navegación y revisar las imágenes.
- Revisar escritorio y móvil, incluidos desbordes y el layout de las tarjetas.
- Confirmar `prefers-reduced-motion` para cualquier transición que se toque.
- Comprobar la descripción de la tarjeta Trello HU-00 tras añadir los accesos directos.

## Fuera de alcance

- La pantalla Mis partidos pertenece a HU-17 y requiere su propia rama y documentación.
- Integración con backend, autenticación, favoritos persistentes, reservas, pagos o catálogo real de clubes.
- Cambios a HU-03, administración de canchas o infraestructura de servidor.
