package catalog

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type repositoryStub struct {
	courts []Court
	image  Image
	err    error
}

func (r repositoryStub) ListCourts(context.Context) ([]Court, error)         { return r.courts, r.err }
func (r repositoryStub) ComplexImage(context.Context, string) (Image, error) { return r.image, r.err }
func (r repositoryStub) CourtImage(context.Context, string) (Image, error)   { return r.image, r.err }

const validID = "8b1f0000-0000-4000-8000-000000000001"

func TestCourtsHandlerListsPublicCourtsWithoutCaching(t *testing.T) {
	service := NewService(repositoryStub{courts: []Court{{ID: validID, Name: "Cancha 1", Covered: true, Features: []string{"wifi"}, ComplexName: "Club Norte"}}})
	response := httptest.NewRecorder()
	service.CourtsHandler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/courts", nil))

	if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("status=%d cache=%q", response.Code, response.Header().Get("Cache-Control"))
	}
	var body struct {
		Courts []map[string]any `json:"courts"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Courts) != 1 || body.Courts[0]["complexName"] != "Club Norte" {
		t.Fatalf("body=%s", response.Body.String())
	}
	if _, leaked := body.Courts[0]["imageUrl"]; leaked {
		t.Fatalf("a court without picture must not expose imageUrl: %s", response.Body.String())
	}
}

func TestCourtsHandlerReturnsEmptyListAndRejectsQueries(t *testing.T) {
	service := NewService(repositoryStub{})
	response := httptest.NewRecorder()
	service.CourtsHandler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/courts", nil))
	if response.Body.String() != "{\"courts\":[]}\n" {
		t.Fatalf("body=%q", response.Body.String())
	}
	response = httptest.NewRecorder()
	service.CourtsHandler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/courts?zona=Gonnet", nil))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("query status=%d", response.Code)
	}
}

func TestImageHandlerServesBytesWithCacheAndContentType(t *testing.T) {
	service := NewService(repositoryStub{image: Image{Data: []byte("png-bytes"), MimeType: "image/png"}})
	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/public/courts/{id}/image", service.CourtImageHandler())
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/courts/"+validID+"/image", nil))

	if response.Code != http.StatusOK || response.Header().Get("Content-Type") != "image/png" ||
		response.Header().Get("Cache-Control") != "public, max-age=300" || response.Body.String() != "png-bytes" {
		t.Fatalf("status=%d headers=%v body=%q", response.Code, response.Header(), response.Body.String())
	}
}

func TestImageHandlerRejectsInvalidIDAndMissingImages(t *testing.T) {
	missing := NewService(repositoryStub{err: ErrNotFound})
	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/public/complexes/{id}/image", missing.ComplexImageHandler())

	for _, id := range []string{"no-es-un-uuid", validID} {
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/complexes/"+id+"/image", nil))
		if response.Code != http.StatusNotFound {
			t.Fatalf("id=%q status=%d", id, response.Code)
		}
	}
}
