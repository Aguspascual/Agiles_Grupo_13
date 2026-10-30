package reservations

import (
	"errors"
	"net/http"
	"net/url"
	"time"
	_ "time/tzdata"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

const BasePath = "/api/v1/complexes/{complexId}/courts/{courtId}/reservations"
const ManualPath = "/api/v1/complexes/{complexId}/courts/{courtId}/manual-reservations"
const OwnPath = "/api/v1/reservations"

type Service struct {
	repository *Repository
	location   *time.Location
}

func NewService(repository *Repository) (*Service, error) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		return nil, err
	}
	return &Service{repository: repository, location: location}, nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST "+BasePath, s.create)
	mux.HandleFunc("POST "+ManualPath, s.createManual)
	mux.HandleFunc("POST "+OwnCancelPath, s.cancelOwn)
	mux.HandleFunc("POST "+ManagerCancelPath, s.cancelAsManager)
	mux.HandleFunc("GET "+OwnPath, s.listOwn)
	mux.HandleFunc("GET "+MyPath, s.listMine)
	mux.HandleFunc("GET "+NoticesPath, s.listNotices)
	return mux
}

func (s *Service) listOwn(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	query, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	start, end, err := parseOwnReservationsDate(query, s.location)
	if err != nil {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	items, err := s.repository.ListOwn(r.Context(), actor, start, end, s.location)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar las reservas")
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{"reservations": items})
}

func (s *Service) create(w http.ResponseWriter, r *http.Request) {
	s.createReservation(w, r, false)
}

func (s *Service) createManual(w http.ResponseWriter, r *http.Request) {
	s.createReservation(w, r, true)
}

func (s *Service) createReservation(w http.ResponseWriter, r *http.Request, manual bool) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, 401, "no autorizado")
		return
	}
	complexID, courtID := r.PathValue("complexId"), r.PathValue("courtId")
	if !auth.ValidUUID(complexID) || !auth.ValidUUID(courtID) || r.URL.RawQuery != "" {
		auth.WriteError(w, 400, "solicitud inválida")
		return
	}
	var input Request
	if !auth.DecodeJSON(w, r, &input) {
		return
	}
	start, err := input.validate(time.Now(), s.location)
	if err == nil {
		var result Reservation
		if manual {
			result, err = s.repository.CreateManual(r.Context(), complexID, courtID, actor, input, start)
		} else {
			result, err = s.repository.Create(r.Context(), complexID, courtID, actor, input, start)
		}
		if err == nil {
			auth.WriteJSON(w, 201, map[string]any{"reservation": result})
			return
		}
	}
	switch {
	case errors.Is(err, ErrInvalid):
		auth.WriteError(w, 400, "solicitud inválida")
	case errors.Is(err, ErrConflict):
		auth.WriteError(w, 409, "turno no disponible")
	case errors.Is(err, ErrNotFound):
		auth.WriteError(w, 404, "recurso no encontrado")
	case errors.Is(err, ErrForbidden):
		auth.WriteError(w, 403, "sin permisos")
	default:
		auth.WriteError(w, 500, "no se pudo crear la reserva")
	}
}
