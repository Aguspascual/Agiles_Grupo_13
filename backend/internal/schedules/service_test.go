package schedules

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

const testComplex = "11111111-1111-4111-8111-111111111111"
const testCourt = "22222222-2222-4222-8222-222222222222"
const testActor = "33333333-3333-4333-8333-333333333333"
const testRevision = "44444444-4444-4444-8444-444444444444"
const testBase = "/api/v1/complexes/" + testComplex + "/courts/" + testCourt + "/weekly-schedule/days"

var testSecret = []byte("test-only-secret-at-least-thirty-two-bytes")

type contractRepository struct {
	calls int
	err   error
	draft Draft
	days  []Day
}

func (f *contractRepository) result() (Day, error) {
	f.calls++
	return Day{Weekday: 1, Enabled: true, DurationMinutes: 60, Revision: testRevision, Intervals: []Interval{}}, f.err
}
func (f *contractRepository) List(context.Context, string, string, string, bool) ([]Day, error) {
	f.calls++
	return f.days, f.err
}
func (f *contractRepository) Get(context.Context, string, string, string, bool, int) (Day, error) {
	return f.result()
}
func (f *contractRepository) Create(_ context.Context, _, _, _ string, _ bool, d Draft) (Day, error) {
	f.draft = d
	return f.result()
}
func (f *contractRepository) Update(_ context.Context, _, _, _ string, _ bool, _ string, d Draft) (Day, error) {
	f.draft = d
	return f.result()
}
func (f *contractRepository) Delete(context.Context, string, string, string, bool, int, string) error {
	f.calls++
	return f.err
}

type contractIdentity struct{}

func (contractIdentity) FindUserByID(id string) (auth.User, error)     { return auth.User{ID: id}, nil }
func (contractIdentity) IsAdmin(context.Context, string) (bool, error) { return true, nil }

func signedTestToken(id string) string {
	encode := base64.RawURLEncoding.EncodeToString
	header := encode([]byte(`{"alg":"HS256","typ":"JWT"}`))
	claims, _ := json.Marshal(map[string]any{"sub": id, "exp": time.Now().Add(time.Hour).Unix()})
	unsigned := header + "." + encode(claims)
	mac := hmac.New(sha256.New, testSecret)
	_, _ = mac.Write([]byte(unsigned))
	return unsigned + "." + encode(mac.Sum(nil))
}

// These are isolated HTTP contract tests, not proof of reservation integration.
// TDD-0001 CA-01/03/04, 0002 CA-04, 0003 CA-03/05, 0004 CA-02/03.
func TestHTTPContracts(t *testing.T) {
	post := `{"weekday":1,"enabled":true,"durationMinutes":60,"intervals":[{"opensAt":"09:00","closesAt":"13:00"}]}`
	put := `{"enabled":false,"durationMinutes":60,"intervals":[{"opensAt":"09:00","closesAt":"13:00"}]}`
	tests := []struct {
		name, method, path, body, match string
		err                             error
		status, calls                   int
	}{
		{"create", "POST", testBase, post, "", nil, 201, 1},
		{"missing enabled", "POST", testBase, strings.Replace(post, `"enabled":true,`, "", 1), "", nil, 400, 0},
		{"null enabled", "POST", testBase, strings.Replace(post, "true", "null", 1), "", nil, 400, 0},
		{"missing weekday", "POST", testBase, strings.Replace(post, `"weekday":1,`, "", 1), "", nil, 400, 0},
		{"null intervals", "POST", testBase, `{"weekday":1,"enabled":false,"durationMinutes":60,"intervals":null}`, "", nil, 400, 0},
		{"missing duration", "POST", testBase, `{"weekday":1,"enabled":true,"intervals":[]}`, "", nil, 400, 0},
		{"unknown field", "POST", testBase, strings.Replace(post, `"weekday":1`, `"unexpected":1,"weekday":1`, 1), "", nil, 400, 0},
		{"client interval id", "POST", testBase, strings.Replace(post, `"opensAt"`, `"id":"client","opensAt"`, 1), "", nil, 400, 0},
		{"invalid type", "POST", testBase, strings.Replace(post, `"weekday":1`, `"weekday":"1"`, 1), "", nil, 400, 0},
		{"trailing json", "POST", testBase, post + " {}", "", nil, 400, 0},
		{"invalid intervals", "POST", testBase, strings.Replace(post, "13:00", "09:00", 1), "", nil, 400, 0},
		{"overnight interval", "POST", testBase, strings.Replace(post, "13:00", "02:00", 1), "", nil, 201, 1},
		{"duplicate day", "POST", testBase, post, "", ErrConflict, 409, 1},
		{"update", "PUT", testBase + "/1", put, `"` + testRevision + `"`, nil, 200, 1},
		{"partial update", "PUT", testBase + "/1", `{"enabled":false}`, `"` + testRevision + `"`, nil, 400, 0},
		{"weekday in update", "PUT", testBase + "/1", strings.Replace(put, "{", `{"weekday":1,`, 1), `"` + testRevision + `"`, nil, 400, 0},
		{"missing revision", "PUT", testBase + "/1", put, "", nil, 428, 0},
		{"wildcard revision", "PUT", testBase + "/1", put, "*", nil, 400, 0},
		{"weak revision", "PUT", testBase + "/1", put, `W/"` + testRevision + `"`, nil, 400, 0},
		{"stale revision", "PUT", testBase + "/1", put, `"` + testRevision + `"`, ErrStaleRevision, 412, 1},
		{"unavailable reservation source", "PUT", testBase + "/1", put, `"` + testRevision + `"`, ErrReservationSourceUnavailable, 503, 1},
		{"reservation conflict", "PUT", testBase + "/1", put, `"` + testRevision + `"`, ErrFutureReservations, 409, 1},
		{"delete", "DELETE", testBase + "/1", "", `"` + testRevision + `"`, nil, 204, 1},
		{"delete requires revision", "DELETE", testBase + "/1", "", "", nil, 428, 0},
		{"delete body rejected", "DELETE", testBase + "/1", "{}", `"` + testRevision + `"`, nil, 400, 0},
		{"deleted day", "DELETE", testBase + "/1", "", `"` + testRevision + `"`, ErrNotFound, 404, 1},
		{"weekly empty", "GET", testBase, "", "", nil, 200, 1},
		{"head week", "HEAD", testBase, "", "", nil, 200, 0},
		{"head existing day", "HEAD", testBase + "/1", "", "", nil, 200, 0},
		{"head absent day", "HEAD", testBase + "/7", "", "", ErrNotFound, 200, 0},
		{"individual", "GET", testBase + "/1", "", "", nil, 200, 1},
		{"missing individual", "GET", testBase + "/1", "", "", ErrNotFound, 404, 1},
		{"unknown query", "GET", testBase + "?date=today", "", "", nil, 400, 0},
		{"invalid weekday", "GET", testBase + "/8", "", "", nil, 400, 0},
		{"ambiguous weekday", "GET", testBase + "/01", "", "", nil, 400, 0},
		{"invalid court id", "GET", strings.Replace(testBase, testCourt, "bad", 1), "", "", nil, 400, 0},
		{"forbidden", "GET", testBase, "", "", ErrForbidden, 403, 1},
		{"database failure", "GET", testBase, "", "", errors.New("sensitive SQL"), 500, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &contractRepository{err: tt.err}
			handler := auth.RequireUser(testSecret, contractIdentity{}, NewService(repo, contractIdentity{}).Handler())
			req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))
			req.Header.Set("Authorization", "Bearer "+signedTestToken(testActor))
			if tt.match != "" {
				req.Header.Set("If-Match", tt.match)
			}
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != tt.status || repo.calls != tt.calls {
				t.Fatalf("status=%d body=%s calls=%d; want %d/%d", rec.Code, rec.Body, repo.calls, tt.status, tt.calls)
			}
			if tt.status == 204 && rec.Body.Len() != 0 {
				t.Fatal("DELETE must have no body")
			}
			if tt.status == 201 || (tt.status == 200 && tt.path == testBase+"/1" && tt.method != "HEAD") {
				if rec.Header().Get("ETag") != `"`+testRevision+`"` {
					t.Fatalf("ETag=%q", rec.Header().Get("ETag"))
				}
			}
			if tt.method == "HEAD" && (rec.Body.Len() != 0 || rec.Header().Get("ETag") != "" || rec.Header().Get("Content-Type") != "") {
				t.Fatalf("HEAD changed legacy response: headers=%v body=%s", rec.Header(), rec.Body)
			}
			if tt.status == 201 && rec.Header().Get("Location") != testBase+"/1" {
				t.Fatal("missing day Location")
			}
			if tt.method == "GET" && tt.status == 200 && rec.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("missing no-store")
			}
			if tt.name == "weekly empty" && strings.TrimSpace(rec.Body.String()) != `{"days":[]}` {
				t.Fatalf("empty weekly=%s", rec.Body)
			}
			if strings.Contains(rec.Body.String(), "sensitive SQL") {
				t.Fatal("internal error leaked")
			}
		})
	}
	t.Run("authentication required", func(t *testing.T) {
		repo := &contractRepository{}
		handler := auth.RequireUser(testSecret, contractIdentity{}, NewService(repo, contractIdentity{}).Handler())
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest("GET", testBase, nil))
		if rec.Code != http.StatusUnauthorized || repo.calls != 0 {
			t.Fatalf("status=%d calls=%d", rec.Code, repo.calls)
		}
	})
}
