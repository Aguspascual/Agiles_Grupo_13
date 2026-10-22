package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type memoryRepo struct {
	users      map[string]User
	hashes     map[string]string
	acceptedAt time.Time
}

func newMemoryRepo() *memoryRepo {
	return &memoryRepo{users: map[string]User{}, hashes: map[string]string{}}
}
func (m *memoryRepo) CreateUser(name, email, hash, zone, level, position, hand string, acceptedAt time.Time) (User, error) {
	if _, ok := m.users[email]; ok {
		return User{}, ErrEmailTaken
	}
	u := User{ID: "user-1", Name: name, Email: email, Zone: zone, Level: level, Position: position, Hand: hand}
	m.users[email] = u
	m.hashes[email] = hash
	m.acceptedAt = acceptedAt
	return u, nil
}
func (m *memoryRepo) FindUserByEmail(email string) (User, string, error) {
	u, ok := m.users[email]
	if !ok {
		return User{}, "", ErrInvalidCredentials
	}
	return u, m.hashes[email], nil
}
func (m *memoryRepo) FindUserByID(id string) (User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return User{}, ErrInvalidCredentials
}
func TestRegisterLoginAndMeFlows(t *testing.T) {
	repo := newMemoryRepo()
	svc := NewService(repo, []byte(strings.Repeat("s", 32)))
	post := func(h http.Handler, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	body := `{"name":" Ana ","email":" ANA@Example.com ","password":"password123","zone":"Gonnet","level":"7ma","fairPlay":true}`
	w := post(svc.RegisterHandler(), body)
	if w.Code != http.StatusCreated {
		t.Fatalf("register status %d: %s", w.Code, w.Body)
	}
	if strings.Contains(w.Body.String(), "password_hash") || strings.Contains(w.Body.String(), "password123") {
		t.Fatalf("response leaks credentials: %s", w.Body)
	}
	hash := repo.hashes["ana@example.com"]
	if hash == "password123" || bcrypt.CompareHashAndPassword([]byte(hash), []byte("password123")) != nil {
		t.Fatal("password is not stored as valid bcrypt hash")
	}
	if repo.users["ana@example.com"].Email != "ana@example.com" {
		t.Fatal("email was not normalized before persistence")
	}
	if repo.acceptedAt.IsZero() {
		t.Fatal("fairPlay acceptance timestamp was not persisted")
	}
	if w = post(svc.RegisterHandler(), body); w.Code != http.StatusConflict {
		t.Fatalf("duplicate status %d", w.Code)
	}
	login := post(svc.LoginHandler(), `{"email":" ANA@Example.com ","password":"password123"}`)
	if login.Code != http.StatusOK {
		t.Fatalf("login status %d: %s", login.Code, login.Body)
	}
	var response struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(login.Body.Bytes(), &response); err != nil || response.Token == "" {
		t.Fatalf("login token missing: %v", err)
	}
	bad := post(svc.LoginHandler(), `{"email":"ana@example.com","password":"wrongpass"}`)
	if bad.Code != http.StatusUnauthorized {
		t.Fatalf("bad login status %d", bad.Code)
	}
	me := httptest.NewRecorder()
	svc.MeHandler().ServeHTTP(me, httptest.NewRequest(http.MethodGet, "/", nil))
	if me.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated me status %d", me.Code)
	}
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Authorization", "Bearer "+response.Token)
	me = httptest.NewRecorder()
	svc.MeHandler().ServeHTTP(me, r)
	if me.Code != http.StatusOK || !strings.Contains(me.Body.String(), `"email":"ana@example.com"`) || strings.Contains(me.Body.String(), "password_hash") {
		t.Fatalf("authenticated me response: %d %s", me.Code, me.Body)
	}
}

func TestRegisterRejectsPrimaryValidationFailures(t *testing.T) {
	cases := []struct{ name, body string }{{"name", `{"email":"a@b.com","password":"password123","zone":"Gonnet","level":"7ma","fairPlay":true}`}, {"email", `{"name":"A","email":"bad","password":"password123","zone":"Gonnet","level":"7ma","fairPlay":true}`}, {"password", `{"name":"A","email":"a@b.com","password":"short","zone":"Gonnet","level":"7ma","fairPlay":true}`}, {"zone", `{"name":"A","email":"a@b.com","password":"password123","zone":"La Plata","level":"7ma","fairPlay":true}`}, {"level", `{"name":"A","email":"a@b.com","password":"password123","zone":"Gonnet","level":"Pro","fairPlay":true}`}, {"fairPlay", `{"name":"A","email":"a@b.com","password":"password123","zone":"Gonnet","level":"7ma"}`}}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			NewService(newMemoryRepo(), []byte(strings.Repeat("s", 32))).RegisterHandler().ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(tc.body)))
			if w.Code != http.StatusBadRequest {
				t.Fatalf("status %d", w.Code)
			}
		})
	}
}

func TestRegisterCannotSetAdminRole(t *testing.T) {
	body := `{"name":"A","email":"a@b.com","password":"password123","zone":"Gonnet","level":"7ma","fairPlay":true,"role":"ADMIN"}`
	w := httptest.NewRecorder()
	NewService(newMemoryRepo(), []byte(strings.Repeat("s", 32))).RegisterHandler().ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("public role assignment status %d, body %s", w.Code, w.Body)
	}
}
