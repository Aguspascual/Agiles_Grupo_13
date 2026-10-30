package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/reservations"
)

// HU-16: persistencia, identidad de invitados, confirmaciÃ³n, vencimiento y liberaciÃ³n de grilla.
func TestHTTPFullMatchInvitationsFlow(t *testing.T) {
	f := newManualFixture(t)
	register := func(email string) (string, string) {
		t.Helper()
		body := fmt.Sprintf(`{"name":"Invitado","email":%q,"password":"TestPassword-123!","zone":"Gonnet","level":"7ma","fairPlay":true}`, email)
		data := expectManual(t, f.request(http.MethodPost, "/api/v1/auth/register", "", body), http.StatusCreated)
		var session struct {
			Token string `json:"token"`
			User  struct {
				ID string `json:"id"`
			} `json:"user"`
		}
		if err := json.Unmarshal(data, &session); err != nil {
			t.Fatal(err)
		}
		return session.User.ID, session.Token
	}
	playerA, tokenA := register("hu16-a@example.com")
	playerB, tokenB := register("hu16-b@example.com")
	playerC, tokenC := register("hu16-c@example.com")
	_, wrongToken := register("hu16-wrong@example.com")

	create := func(start string) (reservations.FullMatch, []string) {
		t.Helper()
		body := fmt.Sprintf(`{"date":%q,"startsAt":%q,"phone":"2215550123","invites":[`+
			`{"name":"A","userId":%q},{"name":"B","userId":%q},{"name":"C","userId":%q}]}`,
			f.date, start, playerA, playerB, playerC)
		data := expectManual(t, f.request(http.MethodPost, f.path("full-matches"), f.manager, body), http.StatusCreated)
		var response struct {
			Match reservations.FullMatch `json:"match"`
		}
		if err := json.Unmarshal(data, &response); err != nil {
			t.Fatal(err)
		}
		if len(response.Match.Invites) != 3 {
			t.Fatalf("invitations=%d", len(response.Match.Invites))
		}
		tokens := make([]string, 3)
		for i, invite := range response.Match.Invites {
			if invite.Token == "" {
				t.Fatalf("invitation %d has no one-time token", i)
			}
			tokens[i] = invite.Token
		}
		return response.Match, tokens
	}

	match, tokens := create("18:00")
	acceptPath := func(token string) string { return "/api/v1/full-match-invitations/" + token + "/accept" }
	if got := f.request(http.MethodPost, acceptPath(tokens[0]), wrongToken, "").status; got != http.StatusForbidden {
		t.Fatalf("wrong invitee status=%d, want 403", got)
	}
	first := expectManual(t, f.request(http.MethodPost, acceptPath(tokens[0]), tokenA, ""), http.StatusOK)
	var partial struct {
		Match reservations.FullMatch `json:"match"`
	}
	if err := json.Unmarshal(first, &partial); err != nil {
		t.Fatal(err)
	}
	if partial.Match.Status != "pending" {
		t.Fatalf("status after first accept=%s", partial.Match.Status)
	}
	// Retrying the same accepted link for the same account is idempotent and cannot add a seat.
	expectManual(t, f.request(http.MethodPost, acceptPath(tokens[0]), tokenA, ""), http.StatusOK)
	expectManual(t, f.request(http.MethodPost, acceptPath(tokens[1]), tokenB, ""), http.StatusOK)
	last := expectManual(t, f.request(http.MethodPost, acceptPath(tokens[2]), tokenC, ""), http.StatusOK)
	var completed struct {
		Match reservations.FullMatch `json:"match"`
	}
	if err := json.Unmarshal(last, &completed); err != nil {
		t.Fatal(err)
	}
	if completed.Match.Status != "full" {
		t.Fatalf("third acceptance status=%s", completed.Match.Status)
	}
	var persisted bool
	if err := f.db.QueryRow(f.ctx, `SELECT fm.status='full' AND r.status='reserved'
		AND (SELECT count(*) FROM full_match_invitations i WHERE i.match_id=fm.id AND i.status='accepted')=3
		AND (SELECT count(*) FROM full_match_invitations i WHERE i.match_id=fm.id AND octet_length(i.token_hash)=32)=3
		FROM full_matches fm JOIN reservations r ON r.id=fm.reservation_id WHERE fm.id=$1::uuid`, match.ID).Scan(&persisted); err != nil || !persisted {
		t.Fatalf("completed state persisted=%v err=%v", persisted, err)
	}

	expiring, expiryTokens := create("20:00")
	if _, err := f.db.Exec(f.ctx, `UPDATE full_matches SET created_at=now()-interval '31 minutes', expires_at=now()-interval '1 second' WHERE id=$1::uuid`, expiring.ID); err != nil {
		t.Fatal(err)
	}
	view := expectManual(t, f.request(http.MethodGet, "/api/v1/full-match-invitations/"+expiryTokens[0], "", ""), http.StatusOK)
	var expired struct {
		Match reservations.FullMatch `json:"match"`
	}
	if err := json.Unmarshal(view, &expired); err != nil {
		t.Fatal(err)
	}
	if expired.Match.Status != "expired" || expired.Match.Invites[0].Status != "expired" {
		t.Fatalf("expiry response status=%s invitation=%s", expired.Match.Status, expired.Match.Invites[0].Status)
	}
	grid := expectManual(t, f.request(http.MethodGet, "/api/v1/complexes/"+f.complexID+"/slots?date="+f.date, "", ""), http.StatusOK)
	var slots struct {
		Courts []struct {
			Slots []struct{ StartsAt, Status string } `json:"slots"`
		} `json:"courts"`
	}
	if err := json.Unmarshal(grid, &slots); err != nil {
		t.Fatal(err)
	}
	for _, court := range slots.Courts {
		for _, slot := range court.Slots {
			if slot.StartsAt == "20:00" && slot.Status == "AVAILABLE" {
				return
			}
		}
	}
	t.Fatalf("expired 20:00 reservation was not released in grid: %s", grid)
}
