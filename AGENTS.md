# Acuerdos de desarrollo

- Este equipo trabaja únicamente en el frontend. No crear ni modificar backend, base de datos, endpoints o infraestructura de servidor salvo nueva instrucción explícita del usuario.
- Mantener los cambios de cada historia de usuario por separado.
- Los mensajes de commit deben indicar la HU correspondiente y estar escritos en español, por ejemplo: `HU-01: implementar registro e inicio de sesión en el frontend`.
- Mantener componentes enfocados, reutilizables y fáciles de revisar; evitar archivos extensos y duplicación de interfaz.
- Documentar en un archivo Markdown las fases realizadas, archivos principales, validaciones y límites de alcance.
- Dockerizar solo el frontend cuando la historia requiera ejecución en contenedor; nunca agregar servicios de backend sin autorización.
- Toda animación debe respetar `prefers-reduced-motion` y mantener transiciones breves que no bloqueen la interacción.
