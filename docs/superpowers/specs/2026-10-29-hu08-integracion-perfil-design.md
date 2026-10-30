# HU-08: integración del perfil propio

La pantalla existente `/perfil` dejará de guardar datos ficticios en `localStorage` y actualizará el perfil autenticado con `PUT /api/v1/auth/me`. El formulario enviará solo `name`, `zone`, `level`, `position` y `hand`, reflejará la respuesta del servidor en la sesión y conservará la navegación al inicio al guardar.

Se conservará Angular, el estilo actual y los controles reutilizables. Como el contrato no admite teléfono, apodo, estilo de juego, foto ni preferencias de privacidad, esos campos dejarán de presentarse como editables. La zona será única; el catálogo incluirá `Principiante` y excluirá `Los Hornos`; el correo será informativo y no editable. `/perfil` requerirá sesión válida. No se modificará backend ni se ampliará el contrato.

**Enfoques considerados:** mantener el perfil local (no integra ni persiste en el servidor); ampliar el contrato backend (fuera del alcance y contradice el contrato aprobado); adaptar el formulario al DTO existente (elegido porque integra la HU con el menor alcance y evita prometer campos no persistidos).

**Validación:** pruebas Angular del DTO, sesión y guard; build; verificación HTTP en el stack Docker. Las pruebas de backend solo verifican el contrato actual, sin cambiarlo.
