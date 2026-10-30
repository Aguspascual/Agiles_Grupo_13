package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func TestDecodeJSONWithLimit(t *testing.T) {
	for _, tt := range []struct {
		name, body        string
		limit             int64
		invalid, trailing bool
	}{
		{"valid", `{"name":"ok"}`, 64, false, false},
		{"unknown field", `{"extra":"x"}`, 64, true, false},
		{"malformed", `{`, 64, true, false},
		{"second document", `{"name":"ok"} {}`, 64, true, true},
		{"trailing garbage", `{"name":"ok"} x`, 64, true, true},
		{"limit exceeded", `{"name":"too long"}`, 8, true, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			var value struct {
				Name string `json:"name"`
			}
			req := httptest.NewRequest("POST", "/", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			err := DecodeJSONWithLimit(rec, req, &value, tt.limit)
			if (err != nil) != tt.invalid || errors.Is(err, ErrTrailingJSON) != tt.trailing {
				t.Fatalf("error=%v", err)
			}
			if rec.Body.Len() != 0 || rec.Code != 200 {
				t.Fatal("decoder must not write a response")
			}
		})
	}
}

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
func (m *memoryRepo) UpdateProfile(_ context.Context, id, name, zone, level, position, hand string) (User, error) {
	for email, u := range m.users {
		if u.ID == id {
			u.Name, u.Zone, u.Level, u.Position, u.Hand = name, zone, level, position, hand
			m.users[email] = u
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

func TestUpdateProfileHandlerValidatesCompleteProfileAndAuthorization(t *testing.T) {
	repo := newMemoryRepo()
	repo.users["ana@example.com"] = User{ID: "11111111-1111-4111-8111-111111111111", Name: "Ana", Email: "ana@example.com", Zone: "Gonnet", Level: "7ma", Position: "Drive", Hand: "Diestro"}
	svc := NewService(repo, []byte(strings.Repeat("s", 32)))
	validToken, err := svc.issueToken("11111111-1111-4111-8111-111111111111")
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name, token, body string
		want              int
	}{
		{"missing token", "", `{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive","hand":"Diestro"}`, http.StatusUnauthorized},
		{"invalid token", "invalid", `{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive","hand":"Diestro"}`, http.StatusUnauthorized},
		{"unknown protected field", validToken, `{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive","hand":"Diestro","email":"other@example.com"}`, http.StatusBadRequest},
		{"missing required field", validToken, `{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive"}`, http.StatusBadRequest},
		{"null field", validToken, `{"name":"Ana","zone":"Gonnet","level":"6ta","position":null,"hand":"Diestro"}`, http.StatusBadRequest},
		{"invalid value", validToken, `{"name":"Ana","zone":"Gonnet","level":"pro","position":"Drive","hand":"Diestro"}`, http.StatusBadRequest},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPut, "/api/v1/auth/me", strings.NewReader(tc.body))
			if tc.token != "" {
				req.Header.Set("Authorization", "Bearer "+tc.token)
			}
			w := httptest.NewRecorder()
			svc.ProfileUpdateHandler().ServeHTTP(w, req)
			if w.Code != tc.want {
				t.Fatalf("status=%d want=%d body=%s", w.Code, tc.want, w.Body)
			}
		})
	}
}

func TestUpdateProfileHandlerUpdatesOnlyAuthenticatedUserAndAllowsClearingOptionals(t *testing.T) {
	repo := newMemoryRepo()
	first := User{ID: "11111111-1111-4111-8111-111111111111", Name: "Ana", Email: "ana@example.com", Zone: "Gonnet", Level: "7ma", Position: "Drive", Hand: "Diestro"}
	second := User{ID: "22222222-2222-4222-8222-222222222222", Name: "Beto", Email: "beto@example.com", Zone: "Tolosa", Level: "8va", Position: "Revés", Hand: "Zurdo"}
	repo.users[first.Email], repo.users[second.Email] = first, second
	secret := []byte(strings.Repeat("s", 32))
	svc := NewService(repo, secret)
	token, err := svc.issueToken(first.ID)
	if err != nil {
		t.Fatal(err)
	}
	body := `{"name":"  Ana Pérez  ","zone":"City Bell","level":"6ta","position":"","hand":""}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/auth/me", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	svc.ProfileUpdateHandler().ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body)
	}
	updated, err := repo.FindUserByID(first.ID)
	if err != nil || updated.Name != "Ana Pérez" || updated.Zone != "City Bell" || updated.Level != "6ta" || updated.Position != "" || updated.Hand != "" {
		t.Fatalf("updated=%+v err=%v", updated, err)
	}
	unchanged, err := repo.FindUserByID(second.ID)
	if err != nil || unchanged != second {
		t.Fatalf("other user changed: %+v err=%v", unchanged, err)
	}
	if strings.Contains(w.Body.String(), `"token"`) {
		t.Fatalf("update unexpectedly issued token: %s", w.Body)
	}
}
