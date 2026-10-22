package courts

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

//go:embed testdata/valid.webp
var validWebP []byte

func tinyPNGDataURL() string {
	var content bytes.Buffer
	picture := image.NewRGBA(image.Rect(0, 0, 1, 1))
	picture.Set(0, 0, color.RGBA{R: 20, G: 120, B: 80, A: 255})
	if err := png.Encode(&content, picture); err != nil {
		panic(err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(content.Bytes())
}

const (
	testAdminID   = "00000000-0000-4000-8000-000000000001"
	testManagerID = "00000000-0000-4000-8000-000000000002"
	testOtherID   = "00000000-0000-4000-8000-000000000003"
	testComplexID = "00000000-0000-4000-8000-000000000010"
	testCourtID   = "00000000-0000-4000-8000-000000000011"
)

type fakeRoles struct{}

func (fakeRoles) IsAdmin(_ context.Context, id string) (bool, error) { return id == testAdminID, nil }

type fakeRepository struct {
	items       map[string]Court
	assigned    bool
	deleteCalls int
}

func newFakeRepository() *fakeRepository {
	return &fakeRepository{items: map[string]Court{}, assigned: true}
}
func (r *fakeRepository) authorized(actor string, admin bool) error {
	if !admin && (actor != testManagerID || !r.assigned) {
		return ErrForbidden
	}
	return nil
}
func (r *fakeRepository) List(_ context.Context, complexID, actor string, admin bool) ([]Court, error) {
	if complexID != testComplexID {
		return nil, ErrNotFound
	}
	if err := r.authorized(actor, admin); err != nil {
		return nil, err
	}
	out := []Court{}
	for _, item := range r.items {
		if item.ComplexID == complexID {
			out = append(out, item)
		}
	}
	return out, nil
}
func (r *fakeRepository) Create(_ context.Context, complexID, actor string, admin bool, d Draft) (Court, error) {
	if complexID != testComplexID {
		return Court{}, ErrNotFound
	}
	if err := r.authorized(actor, admin); err != nil {
		return Court{}, err
	}
	imageData, mimeType, err := decodeImage(d.ImageDataURL)
	if err != nil {
		return Court{}, err
	}
	item := Court{ID: testCourtID, ComplexID: complexID, Name: d.Name, Covered: d.Covered, Features: d.Features, ImageDataURL: dataURL(imageData, mimeType)}
	r.items[item.ID] = item
	return item, nil
}
func (r *fakeRepository) Update(_ context.Context, complexID, courtID, actor string, admin bool, d Draft) (Court, error) {
	if complexID != testComplexID {
		return Court{}, ErrNotFound
	}
	if err := r.authorized(actor, admin); err != nil {
		return Court{}, err
	}
	item, ok := r.items[courtID]
	if !ok {
		return Court{}, ErrNotFound
	}
	imageData, mimeType, err := decodeImage(d.ImageDataURL)
	if err != nil {
		return Court{}, err
	}
	item.Name = d.Name
	item.Covered = d.Covered
	item.Features = d.Features
	item.ImageDataURL = dataURL(imageData, mimeType)
	r.items[courtID] = item
	return item, nil
}
func (r *fakeRepository) Delete(_ context.Context, complexID, courtID, actor string, admin bool) error {
	if complexID != testComplexID {
		return ErrNotFound
	}
	if err := r.authorized(actor, admin); err != nil {
		return err
	}
	r.deleteCalls++
	return ErrReservationSourceUnavailable
}

func handlerForTest(repo Repository) http.Handler {
	secret := []byte(strings.Repeat("s", 32))
	return auth.RequireUser(secret, testUserLookup{}, NewService(repo, fakeRoles{}).Handler())
}

type testUserLookup struct{}

func (testUserLookup) FindUserByID(id string) (auth.User, error) { return auth.User{ID: id}, nil }
func signedToken(id string) string {
	return signedTokenWithSecret(id, []byte(strings.Repeat("s", 32)))
}

func signedTokenWithSecret(id string, secret []byte) string {
	encode := base64.RawURLEncoding.EncodeToString
	header, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	claims, _ := json.Marshal(map[string]any{"sub": id, "exp": time.Now().Add(time.Hour).Unix()})
	unsigned := encode(header) + "." + encode(claims)
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(unsigned))
	return unsigned + "." + encode(mac.Sum(nil))
}
func call(h http.Handler, method, path, actor, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	if actor != "" {
		r.Header.Set("Authorization", "Bearer "+signedToken(actor))
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestCourtCRUDContractPermissionsAndSafeDelete(t *testing.T) {
	repo := newFakeRepository()
	h := handlerForTest(repo)
	base := "/api/v1/complexes/" + testComplexID + "/courts"
	if got := call(h, "GET", base, "", "").Code; got != 401 {
		t.Fatalf("missing token status %d", got)
	}
	body := `{"name":"  Cancha 1 ","covered":true,"features":["lighting","wifi"],"imageDataUrl":null}`
	if got := call(h, "POST", base, testOtherID, body).Code; got != 403 {
		t.Fatalf("unassigned user status %d", got)
	}
	created := call(h, "POST", base, testAdminID, body)
	if created.Code != 201 {
		t.Fatalf("create status %d: %s", created.Code, created.Body)
	}
	var response struct {
		Court Court `json:"court"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Court.Name != "Cancha 1" || !response.Court.Covered || len(response.Court.Features) != 2 {
		t.Fatalf("unexpected response: %+v", response.Court)
	}
	if got := call(h, "GET", base, testManagerID, "").Code; got != 200 {
		t.Fatalf("assigned manager list status %d", got)
	}
	updated := call(h, "PUT", base+"/"+testCourtID, testManagerID, `{"name":"Cancha renovada","covered":false,"features":["acrylicSurface"],"imageDataUrl":null}`)
	if updated.Code != 200 || !strings.Contains(updated.Body.String(), "Cancha renovada") {
		t.Fatalf("update status %d: %s", updated.Code, updated.Body)
	}
	if got := call(h, "PUT", base+"/"+testCourtID, testOtherID, body).Code; got != 403 {
		t.Fatalf("foreign update status %d", got)
	}
	deleted := call(h, "DELETE", base+"/"+testCourtID, testAdminID, "")
	if deleted.Code != 503 {
		t.Fatalf("delete without source status %d: %s", deleted.Code, deleted.Body)
	}
	if repo.deleteCalls != 1 {
		t.Fatalf("delete repository calls=%d", repo.deleteCalls)
	}
	if got := call(h, "GET", "/api/v1/complexes/00000000-0000-4000-8000-000000000099/courts", testAdminID, "").Code; got != 404 {
		t.Fatalf("missing complex status %d", got)
	}
}

func TestRejectsInvalidCourtDrafts(t *testing.T) {
	for _, body := range []string{
		`{"name":"","covered":true,"features":[]}`, strings.Repeat(" ", 0) + `{"name":"` + strings.Repeat("x", 41) + `","covered":false,"features":[]}`,
		`{"name":"Cancha","covered":true,"features":["unknown"]}`, `{"name":"Cancha","covered":true,"features":["wifi","wifi"]}`,
		`{"name":"Cancha","covered":true,"features":[],"imageDataUrl":"data:image/png;base64,aGVsbG8="}`,
		`{"name":"Cancha","covered":true,"features":[],"imageDataUrl":"data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pWQAAAAASUVORK5CYII="}`,
	} {
		var draft Draft
		if err := json.Unmarshal([]byte(body), &draft); err != nil {
			t.Fatal(err)
		}
		if err := draft.Validate(); err == nil {
			if draft.ImageDataURL != nil {
				if _, _, err := decodeImage(draft.ImageDataURL); err == nil {
					t.Errorf("accepted invalid image draft: %s", body)
					continue
				}
			} else {
				t.Errorf("accepted invalid draft: %s", body)
			}
		}
	}
}

func TestDecodeImageAcceptsValidPNGAndRejectsOversize(t *testing.T) {
	valid := tinyPNGDataURL()
	if _, mimeType, err := decodeImage(&valid); err != nil || mimeType != "image/png" {
		t.Fatalf("valid png rejected: %q %v", mimeType, err)
	}
	tooLarge := base64.StdEncoding.EncodeToString(make([]byte, MaxImageSize+1))
	dataURLValue := "data:image/png;base64," + tooLarge
	if _, _, err := decodeImage(&dataURLValue); err == nil {
		t.Fatal("oversized image accepted")
	}
	webp := "data:image/webp;base64," + base64.StdEncoding.EncodeToString(validWebP)
	if _, mimeType, err := decodeImage(&webp); err != nil || mimeType != "image/webp" {
		t.Fatalf("valid webp rejected: %q %v", mimeType, err)
	}
}
