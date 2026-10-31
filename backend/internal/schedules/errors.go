package schedules

import (
	"errors"
	"log"
	"net/http"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

func writeError(w http.ResponseWriter, err error) {
	status, message := 500, "no se pudo completar la operación"
	switch {
	case errors.Is(err, ErrInvalid):
		status, message = 400, "datos de horario o revisión inválidos"
	case errors.Is(err, ErrForbidden):
		status, message = 403, "sin permisos sobre este complejo"
	case errors.Is(err, ErrNotFound):
		status, message = 404, "complejo, cancha o día no encontrado"
	case errors.Is(err, ErrConflict):
		status, message = 409, "el día ya está configurado"
	case errors.Is(err, ErrFutureReservations):
		status, message = 409, "el cambio afecta reservas futuras vigentes"
	case errors.Is(err, ErrStaleRevision):
		status, message = 412, "el horario cambió; consultar nuevamente antes de editar"
	case errors.Is(err, ErrPreconditionRequired):
		status, message = 428, "If-Match es obligatorio"
	case errors.Is(err, ErrReservationSourceUnavailable):
		status, message = 503, "operación no disponible: la fuente real de reservas aún no está integrada"
	}
	if status == 500 {
		log.Printf("schedules: %v", err)
	}
	auth.WriteError(w, status, message)
}
