package complexes

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

const (
	adminID        = "00000000-0000-4000-8000-000000000001"
	managerID      = "00000000-0000-4000-8000-000000000002"
	otherManagerID = "00000000-0000-4000-8000-000000000003"
	complexID      = "00000000-0000-4000-8000-000000000010"
)

type testRepository struct {
	admins      map[string]bool
	complexes   map[string]Complex
	assignments map[string][]string
	users       map[string]Manager
}

func newTestRepository() *testRepository {
	return &testRepository{admins: map[string]bool{adminID: true}, complexes: map[string]Complex{}, assignments: map[string][]string{}, users: map[string]Manager{
		managerID: {ID: managerID, Name: "Ana", Email: "ana@example.com"}, otherManagerID: {ID: otherManagerID, Name: "Mateo", Email: "mateo@example.com"},
	}}
}
func (r *testRepository) IsAdmin(_ context.Context, id string) (bool, error) {
	return r.admins[id], nil
}
func (r *testRepository) HasAssignments(_ context.Context, id string) (bool, error) {
	for _, ids := range r.assignments {
		for _, candidate := range ids {
			if candidate == id {
				return true, nil
			}
		}
	}
	return false, nil
}
func (r *testRepository) List(_ context.Context, user string, admin bool) ([]Complex, error) {
	out := []Complex{}
	for id, c := range r.complexes {
		if admin || contains(r.assignments[id], user) {
			c.ManagerIDs = append([]string(nil), r.assignments[id]...)
			out = append(out, c)
		}
	}
	return out, nil
}
func (r *testRepository) Create(_ context.Context, d Draft) (Complex, error) {
	for _, id := range d.ManagerIDs {
		if _, ok := r.users[id]; !ok {
			return Complex{}, ErrInvalid
		}
	}
	c := Complex{ID: complexID, Name: d.Name, Address: d.Address, Zone: d.Zone, Phone: d.Phone, ImageDataURL: d.ImageDataURL}
	r.complexes[c.ID] = c
	r.assignments[c.ID] = append([]string(nil), d.ManagerIDs...)
	return c, nil
}
func (r *testRepository) Update(_ context.Context, id, actor string, admin bool, d Draft) (Complex, error) {
	c, ok := r.complexes[id]
	if !ok {
		return Complex{}, ErrNotFound
	}
	if !admin && !contains(r.assignments[id], actor) {
		return Complex{}, ErrForbidden
	}
	if !admin {
		a := append([]string(nil), r.assignments[id]...)
		b := append([]string(nil), d.ManagerIDs...)
		sort.Strings(a)
		sort.Strings(b)
		if strings.Join(a, ",") != strings.Join(b, ",") {
			return Complex{}, ErrForbidden
		}
	} else {
		for _, uid := range d.ManagerIDs {
			if _, ok := r.users[uid]; !ok {
				return Complex{}, ErrInvalid
			}
		}
		r.assignments[id] = append([]string(nil), d.ManagerIDs...)
	}
	c.Name, c.Address, c.Zone, c.Phone = d.Name, d.Address, d.Zone, d.Phone
	c.ImageDataURL = d.ImageDataURL
	r.complexes[id] = c
	return c, nil
}
func (r *testRepository) Delete(_ context.Context, id string) error {
	if _, ok := r.complexes[id]; !ok {
		return ErrNotFound
	}
	delete(r.complexes, id)
	delete(r.assignments, id)
	return nil
}
func (r *testRepository) AvailableManagers(_ context.Context) ([]Manager, error) {
	out := []Manager{}
	for _, m := range r.users {
		out = append(out, m)
	}
	return out, nil
}
func contains(items []string, value string) bool {
	for _, item := range items {
		if item == value {
			return true
		}
	}
	return false
}

type tokenUserLookup struct{}

func (tokenUserLookup) FindUserByID(id string) (auth.User, error) {
	return auth.User{ID: id, Name: "test", Email: "test@example.com"}, nil
}

func testToken(userID string) string {
	secret := []byte(strings.Repeat("s", 32))
	encode := base64.RawURLEncoding.EncodeToString
	header, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	claims, _ := json.Marshal(map[string]any{"sub": userID, "exp": time.Now().Add(time.Hour).Unix()})
	unsigned := encode(header) + "." + encode(claims)
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(unsigned))
	return unsigned + "." + encode(mac.Sum(nil))
}

func testImageDataURL() string {
	imageValue := image.NewRGBA(image.Rect(0, 0, 1, 1))
	imageValue.Set(0, 0, color.RGBA{R: 20, G: 120, B: 80, A: 255})
	var content bytes.Buffer
	if err := png.Encode(&content, imageValue); err != nil {
		panic(err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(content.Bytes())
}

func testHandler(repo *testRepository) http.Handler {
	return auth.RequireUser([]byte(strings.Repeat("s", 32)), tokenUserLookup{}, NewService(repo).Handler())
}
func request(handler http.Handler, method, path, actor, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	if actor != "" {
		r.Header.Set("Authorization", "Bearer "+testToken(actor))
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}

const validDraft = `{"name":"Club Gonnet","address":"Calle 14 y 501","zone":"San Carlos","phone":"221 555-0101","managerIds":["` + managerID + `","` + otherManagerID + `"]}`

func TestAdminCreatesComplexWithMultiplePersistedManagers(t *testing.T) {
	repo := newTestRepository()
	h := testHandler(repo)
	w := request(h, http.MethodPost, "/api/v1/complexes", adminID, validDraft)
	if w.Code != http.StatusCreated {
		t.Fatalf("status %d body %s", w.Code, w.Body)
	}
	if got := repo.assignments[complexID]; len(got) != 2 || !contains(got, managerID) || !contains(got, otherManagerID) {
		t.Fatalf("assignments not persisted: %v", got)
	}
	var response struct {
		Complex Complex `json:"complex"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil || response.Complex.ID != complexID {
		t.Fatalf("response %s; decode %v", w.Body, err)
	}
}

func TestComplexImageIsAcceptedAndInvalidImageRejected(t *testing.T) {
	imageURL := testImageDataURL()
	valid := strings.TrimSuffix(validDraft, "}") + `,"imageDataUrl":"` + imageURL + `"}`
	repo := newTestRepository()
	w := request(testHandler(repo), http.MethodPost, "/api/v1/complexes", adminID, valid)
	if w.Code != http.StatusCreated || repo.complexes[complexID].ImageDataURL == nil || *repo.complexes[complexID].ImageDataURL != imageURL {
		t.Fatalf("valid image status=%d body=%s stored=%v", w.Code, w.Body, repo.complexes[complexID].ImageDataURL)
	}

	invalid := strings.Replace(valid, imageURL, "data:image/png;base64,aGVsbG8=", 1)
	if got := request(testHandler(newTestRepository()), http.MethodPost, "/api/v1/complexes", adminID, invalid).Code; got != http.StatusBadRequest {
		t.Fatalf("invalid image status=%d", got)
	}
}

func TestRejectsInvalidAndDuplicateAssignments(t *testing.T) {
	for _, body := range []string{strings.Replace(validDraft, "San Carlos", "La Plata", 1), strings.Replace(validDraft, `"phone":"221 555-0101"`, `"phone":""`, 1), strings.Replace(validDraft, `","`+otherManagerID, `","`+managerID, 1)} {
		repo := newTestRepository()
		w := request(testHandler(repo), http.MethodPost, "/api/v1/complexes", adminID, body)
		if w.Code != http.StatusBadRequest {
			t.Errorf("status %d for %s", w.Code, body)
		}
	}
}

func TestAuthenticationRejectsMissingAndInvalidJWT(t *testing.T) {
	h := testHandler(newTestRepository())
	if got := request(h, http.MethodGet, "/api/v1/complexes", "", "").Code; got != http.StatusUnauthorized {
		t.Fatalf("missing token status %d", got)
	}
	r := httptest.NewRequest(http.MethodGet, "/api/v1/complexes", nil)
	r.Header.Set("Authorization", "Bearer invalid")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("invalid token status %d", w.Code)
	}
}

func TestInvalidAndMissingComplexIDs(t *testing.T) {
	repo := newTestRepository()
	h := testHandler(repo)
	if got := request(h, http.MethodPut, "/api/v1/complexes/not-a-uuid", adminID, validDraft).Code; got != http.StatusBadRequest {
		t.Fatalf("invalid id status %d", got)
	}
	missingID := "00000000-0000-4000-8000-000000000099"
	if got := request(h, http.MethodPut, "/api/v1/complexes/"+missingID, adminID, validDraft).Code; got != http.StatusNotFound {
		t.Fatalf("missing id status %d", got)
	}
}

func TestRoleAndManagerAuthorization(t *testing.T) {
	repo := newTestRepository()
	repo.complexes[complexID] = Complex{ID: complexID, Name: "Club", Address: "Calle", Zone: "Gonnet", Phone: "123"}
	repo.assignments[complexID] = []string{managerID}
	h := testHandler(repo)
	if got := request(h, http.MethodGet, "/api/v1/complexes", managerID, "").Code; got != http.StatusOK {
		t.Fatalf("assigned manager list: %d", got)
	}
	if got := request(h, http.MethodGet, "/api/v1/complexes", otherManagerID, "").Code; got != http.StatusForbidden {
		t.Fatalf("unassigned user list: %d", got)
	}
	update := `{"name":"Updated","address":"Calle","zone":"Gonnet","phone":"123","managerIds":["` + managerID + `"]}`
	if got := request(h, http.MethodPut, "/api/v1/complexes/"+complexID, managerID, update).Code; got != http.StatusOK {
		t.Fatalf("own complex update: %d", got)
	}
	if got := request(h, http.MethodPut, "/api/v1/complexes/"+complexID, otherManagerID, update).Code; got != http.StatusForbidden {
		t.Fatalf("foreign complex update: %d", got)
	}
	changed := strings.Replace(update, managerID, otherManagerID, 1)
	if got := request(h, http.MethodPut, "/api/v1/complexes/"+complexID, managerID, changed).Code; got != http.StatusForbidden {
		t.Fatalf("unauthorized assignment update: %d", got)
	}
	if got := request(h, http.MethodDelete, "/api/v1/complexes/"+complexID, managerID, "").Code; got != http.StatusForbidden {
		t.Fatalf("manager delete: %d", got)
	}
}

func TestAdminOperationsAndLogicalDeletion(t *testing.T) {
	repo := newTestRepository()
	h := testHandler(repo)
	w := request(h, http.MethodPost, "/api/v1/complexes", adminID, validDraft)
	if w.Code != 201 {
		t.Fatalf("create %d %s", w.Code, w.Body)
	}
	updated := strings.Replace(validDraft, "Club Gonnet", "Club Modificado", 1)
	w = request(h, http.MethodPut, "/api/v1/complexes/"+complexID, adminID, updated)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "Club Modificado") {
		t.Fatalf("edit %d %s", w.Code, w.Body)
	}
	if got := request(h, http.MethodGet, "/api/v1/complexes/available-managers", adminID, "").Code; got != 200 {
		t.Fatalf("available managers: %d", got)
	}
	if got := request(h, http.MethodDelete, "/api/v1/complexes/"+complexID, adminID, "").Code; got != http.StatusNoContent {
		t.Fatalf("delete: %d", got)
	}
	if got := request(h, http.MethodGet, "/api/v1/complexes", adminID, "").Code; got != 200 || len(repo.complexes) != 0 {
		t.Fatalf("logical delete/list status %d remaining %d", got, len(repo.complexes))
	}
}
