package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TDD-0014: the club directory is public, ordered, excludes deleted complexes and exposes four fields.
func TestHTTPPostgresPublicComplexDirectory(t *testing.T) {
	db, ctx := httpTestPool(t)
	secret := []byte("only-for-http-integration-tests-at-least-32-bytes")
	server := httptest.NewServer(newHandler(db, secret))
	defer server.Close()

	get := func(path string) (int, []byte, http.Header) {
		response, err := server.Client().Get(server.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		body, err := io.ReadAll(response.Body)
		if err != nil {
			t.Fatal(err)
		}
		return response.StatusCode, body, response.Header
	}

	status, body, _ := get("/api/v1/public/complexes")
	if status != http.StatusOK || string(body) != "{\"complexes\":[]}\n" {
		t.Fatalf("empty directory status=%d body=%s", status, body)
	}

	for _, row := range []struct{ name, zone, deleted string }{
		{"Zeta Club", "Gonnet", "NULL"},
		{"Alfa Club", "City Bell", "NULL"},
		{"Baja Club", "Gonnet", "now()"},
	} {
		if _, err := db.Exec(ctx, `INSERT INTO complexes(name,address,zone,phone,deleted_at) VALUES($1,'Calle 1',$2,'221 555-0100',`+row.deleted+`)`, row.name, row.zone); err != nil {
			t.Fatal(err)
		}
	}

	status, body, header := get("/api/v1/public/complexes")
	if status != http.StatusOK || header.Get("Cache-Control") != "no-store" {
		t.Fatalf("status=%d cache=%q body=%s", status, header.Get("Cache-Control"), body)
	}
	var decoded struct {
		Complexes []map[string]any `json:"complexes"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil {
		t.Fatal(err)
	}
	if len(decoded.Complexes) != 2 || decoded.Complexes[0]["name"] != "Alfa Club" || decoded.Complexes[1]["name"] != "Zeta Club" {
		t.Fatalf("complexes=%v", decoded.Complexes)
	}
	for _, item := range decoded.Complexes {
		if len(item) != 4 || item["id"] == nil || item["address"] == nil || item["zone"] == nil || item["name"] == nil {
			t.Fatalf("unexpected fields=%v", item)
		}
	}

	if status, _, _ := get("/api/v1/public/complexes?zone=Gonnet"); status != http.StatusBadRequest {
		t.Fatalf("query status=%d", status)
	}
	// The administrative listing stays protected.
	if status, _, _ := get("/api/v1/complexes"); status != http.StatusUnauthorized {
		t.Fatalf("protected listing status=%d", status)
	}
}
