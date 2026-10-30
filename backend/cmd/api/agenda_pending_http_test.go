package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/agenda"
)

func (f *manualFixture) agendaByID(t *testing.T, token string) map[string]agenda.Reservation {
	t.Helper()
	body := expectManual(t, f.request("GET", f.agendaPath(f.complexID, "date="+f.date), token, ""), 200)
	out := map[string]agenda.Reservation{}
	for _, court := range decodeAgenda(t, body).Courts {
		for _, r := range court.Reservations {
			out[r.ID] = r
		}
	}
	return out
}

func (f *manualFixture) agendaRaw(t *testing.T) string {
	t.Helper()
	return string(expectManual(t, f.request("GET", f.agendaPath(f.complexID, "date="+f.date), f.manager, ""), 200))
}

func (f *manualFixture) profile(t *testing.T, userID, name, level, position string) {
	t.Helper()
	if _, err := f.db.Exec(f.ctx, `UPDATE player_profiles SET name=$2,level=$3,position=NULLIF($4,'') WHERE user_id=$1`, userID, name, level, position); err != nil {
		t.Fatal(err)
	}
}

// TDD-0015 v2 CA-08..CA-10.
func TestHTTPAgendaPendingMatch(t *testing.T) {
	f := newManualFixture(t)
	ana, _ := f.registerPlayer(t, "pm-ana@example.com")
	luis, _ := f.registerPlayer(t, "pm-luis@example.com")
	eva, _ := f.registerPlayer(t, "pm-eva@example.com")
	dan, _ := f.registerPlayer(t, "pm-dan@example.com")
	f.profile(t, ana, "Ana Pérez", "5ta", "Drive")
	f.profile(t, luis, "Luis Gómez", "6ta", "")
	f.profile(t, eva, "Eva Díaz", "4ta", "Revés")
	f.profile(t, dan, "Dan Ruiz", "5ta", "")

	web := f.insertReservation(t, "web", f.userID(t, "manual-player@example.com"), slotTime(t, f, "18:00"), slotTime(t, f, "19:00"))
	manual := f.insertReservation(t, "manual", "", slotTime(t, f, "19:00"), slotTime(t, f, "20:00"))
	_, solo := f.insertMatch(t, ana, nil, "5ta", "open", "reserved", slotTime(t, f, "20:00"), slotTime(t, f, "21:00"))
	pairMatch, pair := f.insertMatch(t, eva, []string{luis, ana}, "6ta", "open", "reserved", slotTime(t, f, "21:00"), slotTime(t, f, "22:00"))
	fullMatch, full := f.insertMatch(t, dan, []string{luis, ana, eva}, "5ta", "full", "reserved", slotTime(t, f, "22:00"), slotTime(t, f, "23:00"))
	_, cancelled := f.insertMatch(t, ana, []string{luis}, "5ta", "open", "cancelled", slotTime(t, f, "08:00"), slotTime(t, f, "09:00"))
	// Join order differs from the id order: Luis joined before Ana.
	base := time.Now().Add(-time.Hour)
	for i, user := range []string{luis, ana} {
		if _, err := f.db.Exec(f.ctx, `UPDATE pending_match_players SET joined_at=$3 WHERE match_id=$1 AND user_id=$2`, pairMatch, user, base.Add(time.Duration(i)*time.Minute)); err != nil {
			t.Fatal(err)
		}
	}
	orphan := f.insertReservation(t, "manual", "", slotTime(t, f, "07:00"), slotTime(t, f, "08:00"))
	if _, err := f.db.Exec(f.ctx, `UPDATE reservations SET origin='open_match',organizer_id=$2,companions=3,registered_by=$2,contact_phone='' WHERE id=$1`, orphan, ana); err != nil {
		t.Fatal(err)
	}

	got := f.agendaByID(t, f.manager)
	if r := got[solo]; r.PendingMatch == nil || r.PendingMatch.Status != "open" || r.PendingMatch.MissingPlayers != 3 ||
		r.PendingMatch.TargetLevel != "5ta" || len(r.PendingMatch.Players) != 1 {
		t.Fatalf("solo=%+v", r.PendingMatch)
	} else if p := r.PendingMatch.Players[0]; p.Name != "Ana Pérez" || p.Level != "5ta" || p.Position != "Drive" || !p.Organizer {
		t.Fatalf("organizer=%+v", p)
	}
	pm := got[pair].PendingMatch
	if pm == nil || pm.ID != pairMatch || pm.MissingPlayers != 1 || pm.Status != "open" || len(pm.Players) != 3 {
		t.Fatalf("pair=%+v", pm)
	}
	order := []string{pm.Players[0].Name, pm.Players[1].Name, pm.Players[2].Name}
	if strings.Join(order, "|") != "Eva Díaz|Luis Gómez|Ana Pérez" || !pm.Players[0].Organizer || pm.Players[1].Organizer {
		t.Fatalf("order=%v players=%+v", order, pm.Players)
	}
	if pm := got[full].PendingMatch; pm == nil || pm.ID != fullMatch || pm.Status != "full" || pm.MissingPlayers != 0 || len(pm.Players) != 4 {
		t.Fatalf("full=%+v", pm)
	}
	for name, id := range map[string]string{"web": web, "manual": manual} {
		if got[id].PendingMatch != nil {
			t.Fatalf("%s must not carry pendingMatch", name)
		}
	}
	if _, ok := got[cancelled]; ok {
		t.Fatal("cancelled reservation listed")
	}
	if r, ok := got[orphan]; !ok || r.Origin != "open_match" || r.PendingMatch != nil {
		t.Fatalf("orphan=%+v ok=%v", r, ok)
	}

	raw := f.agendaRaw(t)
	if strings.Count(raw, `"pendingMatch"`) != 3 {
		t.Fatalf("pendingMatch keys=%d: %s", strings.Count(raw, `"pendingMatch"`), raw)
	}
	var matchJSON strings.Builder
	for _, id := range []string{solo, pair, full} {
		data, err := json.Marshal(got[id].PendingMatch)
		if err != nil {
			t.Fatal(err)
		}
		matchJSON.Write(data)
	}
	for _, forbidden := range []string{"userId", "user_id", "email", "@example.com", "phone", ana, luis, eva, dan, `"position":""`} {
		if strings.Contains(matchJSON.String(), forbidden) || strings.Contains(raw, "@example.com") {
			t.Fatalf("agenda leaks %q: %s", forbidden, raw)
		}
	}

	// A player leaving leaves one more missing spot.
	if _, err := f.db.Exec(f.ctx, `DELETE FROM pending_match_players WHERE match_id=$1 AND user_id=$2`, fullMatch, luis); err != nil {
		t.Fatal(err)
	}
	if pm := f.agendaByID(t, f.manager)[full].PendingMatch; pm == nil || pm.MissingPlayers != 1 || len(pm.Players) != 3 {
		t.Fatalf("after leave=%+v", pm)
	}

	// Permissions are unchanged.
	path := f.agendaPath(f.complexID, "date="+f.date)
	expectManual(t, f.request("GET", path, f.admin, ""), 200)
	expectManual(t, f.request("GET", path, f.player, ""), 403)
	expectManual(t, f.request("GET", path, "", ""), 401)
	var other string
	if err := f.db.QueryRow(f.ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('Other','Street','Gonnet','123') RETURNING id::text`).Scan(&other); err != nil {
		t.Fatal(err)
	}
	expectManual(t, f.request("GET", f.agendaPath(other, "date="+f.date), f.manager, ""), 403)
}

// The public grid must not reveal players of an open match (TDD-0015 CA-06/CA-09).
func TestPublicSlotsJSONWithOpenMatch(t *testing.T) {
	f := newManualFixture(t)
	ana, _ := f.registerPlayer(t, "pm-public@example.com")
	f.profile(t, ana, "Ana Pública", "5ta", "Drive")
	f.insertMatch(t, ana, nil, "5ta", "open", "reserved", slotTime(t, f, "20:00"), slotTime(t, f, "21:00"))
	data := string(expectManual(t, f.request("GET", fmt.Sprintf("/api/v1/complexes/%s/slots?date=%s", f.complexID, f.date), "", ""), 200))
	for _, forbidden := range []string{"Ana Pública", "pendingMatch", "players", "missingPlayers", "targetLevel", "Private organizer", "reservationId"} {
		if strings.Contains(data, forbidden) {
			t.Fatalf("public response contains %s: %s", forbidden, data)
		}
	}
}
