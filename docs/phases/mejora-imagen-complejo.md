# Imagen del complejo en administración

## Fases realizadas

1. Se agregó al formulario de alta y edición la selección de imágenes PNG, JPG y WebP, con vista previa, reemplazo y opción para quitarla. El límite del archivo es 5 MB.
2. Se amplió la API existente de complejos para validar y guardar la imagen junto con los demás datos, sin crear endpoints nuevos.
3. Se agregó una migración con almacenamiento binario y restricciones de formato/tamaño; el listado administrativo devuelve la imagen para volver a editar y mostrarla en la tarjeta. Nginx admite cuerpos de hasta 8 MB en el proxy de API para permitir imágenes base64 de hasta 5 MB.
4. Se extrajo la validación de imágenes a `backend/internal/media` y se reutiliza desde canchas y complejos.

## Archivos principales

- `frontend/src/app/complexes/complex-form.component.*`
- `frontend/src/app/complexes/complex-api.service.ts` y `complex.model.ts`
- `frontend/src/app/complexes/complex-card.component.*`
- `frontend/nginx.conf`
- `backend/internal/complexes/*`, `backend/internal/media/image.go`
- `backend/migrations/012_complex_images.sql`

## Validaciones

- `npm run build`: correcto; mantiene avisos de presupuesto de bundle/estilos.
- Prueba focalizada del formulario Angular: 3/3 correctas.
- `go test ./internal/complexes ./internal/courts`: correcto en contenedor Go.
- La prueba HTTP/PostgreSQL de creación y listado quedó agregada en `backend/cmd/api/routes_test.go`, pero no se ejecutó porque no está configurada `TEST_DATABASE_URL`.
- Docker reconstruido y recreado. La migración `012_complex_images.sql` quedó registrada; frontend respondió HTTP 200 y API HTTP 204.
- Playwright CLI no pudo instalarse/arrancar desde npm en este entorno; no se hizo una sesión visual interactiva.

## Alcance

- La imagen se guarda en PostgreSQL y no se pierde al cerrar el modal ni al recargar el listado de administración.
- No se cambia el endpoint público de clubes ni su diseño en esta tarea.
