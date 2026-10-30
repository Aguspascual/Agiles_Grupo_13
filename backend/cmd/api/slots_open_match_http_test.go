package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/slots"
)

func (f *manualFixture) publicSlotsRaw(t *testing.T) []byte {
	t.Helper()
	return expectManual(t, f.request("GET", fmt.Sprintf("/api/v1/complexes/%s/slots?date=%s", f.complexID, f.date), "", ""), 200)
}

func (f *manualFixture) publicSlots(t *testing.T) map[string]slots.Slot {
	t.Helper()
	var response slots.Response
	if err := json.Unmarshal(f.publicSlotsRaw(t), &response); err != nil {
		t.Fatal(err)
	}
	out := map[string]slots.Slot{}
	for _, court := range response.Courts {
		for _, slot := range court.Slots {
			out[slot.StartsAt] = slot
		}
	}
	return out
}

func expectPending(t *testing.T, got map[string]slots.Slot, start string, missing int, level string) {
	t.Helper()
	s := got[start]
	if s.Status != "PENDING_MATCH" || s.PendingMatch == nil || s.PendingMatch.MissingPlayers != missing || s.PendingMatch.Level != level {
		t.Fatalf("slot %s=%+v pending=%+v, want PENDING_MATCH missing=%d level=%s", start, s, s.PendingMatch, missing, level)
	}
}

// TDD-0009 v3 CA-16..CA-19.
func TestHTTPPublicSlotsPendingMatch(t *testing.T) {
	f := newManualFixture(t)
	ana, _ := f.registerPlayer(t, "slots-ana@example.com")
	luis, _ := f.registerPlayer(t, "slots-luis@example.com")
	eva, _ := f.registerPlayer(t, "slots-eva@example.com")
	dan, _ := f.registerPlayer(t, "slots-dan@example.com")
	f.profile(t, ana, "Ana Pública", "5ta", "Drive")

	f.insertReservation(t, "web", f.userID(t, "manual-player@example.com"), slotTime(t, f, "18:00"), slotTime(t, f, "19:00"))
	f.insertReservation(t, "manual", "", slotTime(t, f, "19:00"), slotTime(t, f, "20:00"))
	solo, _ := f.insertMatch(t, ana, nil, "5ta", "open", "reserved", slotTime(t, f, "20:00"), slotTime(t, f, "21:00"))
	f.insertMatch(t, dan, []string{luis, eva}, "6ta", "open", "reserved", slotTime(t, f, "21:00"), slotTime(t, f, "22:00"))
	full, _ := f.insertMatch(t, dan, []string{luis, ana, eva}, "5ta", "full", "reserved", slotTime(t, f, "22:00"), slotTime(t, f, "23:00"))

	got := f.publicSlots(t)
	if got["18:00"].Status != "RESERVED" || got["19:00"].Status != "RESERVED" {
		t.Fatalf("web/manual slots=%+v %+v", got["18:00"], got["19:00"])
	}
	expectPending(t, got, "20:00", 3, "5ta")
	expectPending(t, got, "21:00", 1, "6ta")
	if got["22:00"].Status != "RESERVED" || got["22:00"].PendingMatch != nil {
		t.Fatalf("full match slot=%+v", got["22:00"])
	}

	// Joining and leaving change the missing players.
	if _, err := f.db.Exec(f.ctx, `INSERT INTO pending_match_players(match_id,user_id) VALUES($1,$2)`, solo, luis); err != nil {
		t.Fatal(err)
	}
	expectPending(t, f.publicSlots(t), "20:00", 2, "5ta")
	if _, err := f.db.Exec(f.ctx, `DELETE FROM pending_match_players WHERE match_id=$1 AND user_id=$2`, solo, luis); err != nil {
		t.Fatal(err)
	}
	expectPending(t, f.publicSlots(t), "20:00", 3, "5ta")
	if _, err := f.db.Exec(f.ctx, `DELETE FROM pending_match_players WHERE match_id=$1 AND user_id=$2`, full, luis); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(f.ctx, `UPDATE pending_matches SET status='open' WHERE id=$1`, full); err != nil {
		t.Fatal(err)
	}
	expectPending(t, f.publicSlots(t), "22:00", 1, "5ta")

	// The public JSON has the key only in pending slots and no personal data or ids.
	raw := string(f.publicSlotsRaw(t))
	if strings.Count(raw, `"pendingMatch"`) != 3 {
		t.Fatalf("pendingMatch keys=%d: %s", strings.Count(raw, `"pendingMatch"`), raw)
	}
	for _, forbidden := range []string{"Ana Pública", "Private organizer", "players", "reservationId", "userId", "organizer", ana, luis, eva, dan, solo, full, "@example.com"} {
		if strings.Contains(raw, forbidden) {
			t.Fatalf("public response contains %q: %s", forbidden, raw)
		}
	}
	var decoded struct {
		Courts []struct {
			Slots []map[string]any
		}
	}
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		t.Fatal(err)
	}
	for _, slot := range decoded.Courts[0].Slots {
		_, has := slot["pendingMatch"]
		if has != (slot["status"] == "PENDING_MATCH") {
			t.Fatalf("pendingMatch key mismatch in %+v", slot)
		}
		if has && len(slot["pendingMatch"].(map[string]any)) != 2 {
			t.Fatalf("pendingMatch has unexpected fields: %+v", slot)
		}
	}
}

func TestHTTPPublicSlotsPendingMatchEdgeCases(t *testing.T) {
	f := newManualFixture(t)
	ana, _ := f.registerPlayer(t, "slots-edge-ana@example.com")

	f.insertMatch(t, ana, nil, "5ta", "open", "cancelled", slotTime(t, f, "18:00"), slotTime(t, f, "19:00"))
	f.insertMatch(t, ana, nil, "5ta", "open", "reserved", slotTime(t, f, "19:00"), slotTime(t, f, "20:00"))
	f.insertMatch(t, ana, nil, "4ta", "open", "reserved", slotTime(t, f, "21:00"), slotTime(t, f, "22:00"))
	f.insertReservation(t, "manual", "", slotTime(t, f, "21:30"), slotTime(t, f, "22:30"))

	got := f.publicSlots(t)
	if got["18:00"].Status != "AVAILABLE" || got["18:00"].PendingMatch != nil {
		t.Fatalf("cancelled match slot=%+v", got["18:00"])
	}
	expectPending(t, got, "19:00", 3, "5ta")
	for _, start := range []string{"21:00", "22:00"} {
		if s := got[start]; s.Status != "RESERVED" || s.PendingMatch != nil {
			t.Fatalf("overlapping slot %s=%+v", start, s)
		}
	}

	// A slot that already started is plain RESERVED.
	loc, _ := time.LoadLocation("America/Argentina/Buenos_Aires")
	now := slotTime(t, f, "19:30").In(loc)
	past := f.clockServer(t, now).publicSlots(t)
	if s := past["19:00"]; s.Status != "RESERVED" || s.PendingMatch != nil || !s.IsPast {
		t.Fatalf("past slot=%+v", s)
	}

	// Booking over a pending slot is still a conflict.
	body := fmt.Sprintf(`{"date":%q,"startsAt":"19:00","contact":{"name":"Otra","phone":"123"}}`, f.date)
	expectManual(t, f.request("POST", f.path("reservations"), f.player, body), 409)
}

func TestHTTPPublicSlotsDisabledDayStaysBlocked(t *testing.T) {
	f := newManualFixture(t)
	if _, err := f.db.Exec(f.ctx, `UPDATE court_schedule_days SET enabled=false WHERE id=$1`, f.dayID); err != nil {
		t.Fatal(err)
	}
	for start, s := range f.publicSlots(t) {
		if s.Status != "BLOCKED" || s.PendingMatch != nil {
			t.Fatalf("slot %s=%+v", start, s)
		}
	}
}

// The manager agenda keeps its own occupancy and detail (TDD-0009 v3 CA-19).
func TestHTTPAgendaUnchangedByPublicPendingMatch(t *testing.T) {
	f := newManualFixture(t)
	ana, _ := f.registerPlayer(t, "slots-agenda-ana@example.com")
	f.profile(t, ana, "Ana Agenda", "5ta", "Drive")
	_, id := f.insertMatch(t, ana, nil, "5ta", "open", "reserved", slotTime(t, f, "20:00"), slotTime(t, f, "21:00"))
	body := expectManual(t, f.request("GET", f.agendaPath(f.complexID, "date="+f.date), f.manager, ""), 200)
	var raw struct {
		Courts []struct {
			Slots []map[string]any
		}
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, slot := range raw.Courts[0].Slots {
		if slot["startsAt"] == "20:00" {
			found = true
			if slot["status"] != "RESERVED" {
				t.Fatalf("agenda slot=%+v", slot)
			}
			if _, has := slot["pendingMatch"]; has {
				t.Fatalf("agenda slot must not carry pendingMatch: %+v", slot)
			}
		}
	}
	if !found {
		t.Fatalf("agenda has no 20:00 slot: %s", body)
	}
	r, ok := f.agendaByID(t, f.manager)[id]
	if !ok || r.PendingMatch == nil || r.PendingMatch.MissingPlayers != 3 || r.PendingMatch.Players[0].Name != "Ana Agenda" {
		t.Fatalf("agenda reservation=%+v", r)
	}
}
