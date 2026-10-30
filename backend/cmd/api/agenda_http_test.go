package main

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/agenda"
)

func (f *manualFixture) agendaPath(complexID, query string) string {
	return fmt.Sprintf("/api/v1/complexes/%s/agenda?%s", complexID, query)
}

func decodeAgenda(t *testing.T, data []byte) agenda.Response {
	t.Helper()
	var out agenda.Response
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("decode %s: %v", data, err)
	}
	return out
}

// TDD-0015 CA-01..07 (C1).
func TestHTTPAgenda(t *testing.T) {
	f := newManualFixture(t)
	playerID := f.userID(t, "manual-player@example.com")
	web := f.insertReservation(t, "web", playerID, slotTime(t, f, "18:00"), slotTime(t, f, "19:00"))
	manual := f.insertReservation(t, "manual", "", slotTime(t, f, "19:00"), slotTime(t, f, "20:00"))
	misaligned := f.insertReservation(t, "manual", "", slotTime(t, f, "21:15"), slotTime(t, f, "21:45"))
	outside := f.insertReservation(t, "manual", "", slotTime(t, f, "08:00"), slotTime(t, f, "09:00"))
	var otherComplex, removedCourt string
	if err := f.db.QueryRow(f.ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('Other','Street','Gonnet','123') RETURNING id::text`).Scan(&otherComplex); err != nil {
		t.Fatal(err)
	}
	if err := f.db.QueryRow(f.ctx, `INSERT INTO courts(complex_id,name,covered,deleted_at) VALUES($1,'Removed',false,now()) RETURNING id::text`, f.complexID).Scan(&removedCourt); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(f.ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone,origin,registered_by)
		VALUES($1,$2,NULL,$3,$4,'reserved',NULL,'Ghost','000','manual',$5)`, f.complexID, removedCourt, slotTime(t, f, "18:00"), slotTime(t, f, "19:00"), f.managerID); err != nil {
		t.Fatal(err)
	}
	query := "date=" + f.date
	for _, tc := range []struct {
		name, token, path string
		status            int
	}{
		{"no token", "", f.agendaPath(f.complexID, query), 401},
		{"invalid token", "bad", f.agendaPath(f.complexID, query), 401},
		{"player", f.player, f.agendaPath(f.complexID, query), 403},
		{"other complex manager", f.manager, f.agendaPath(otherComplex, query), 403},
		{"unknown complex hidden", f.player, f.agendaPath(unknownUUID, query), 403},
		{"unknown complex admin", f.admin, f.agendaPath(unknownUUID, query), 404},
		{"bad UUID", f.manager, f.agendaPath("bad", query), 400},
		{"missing date", f.manager, f.agendaPath(f.complexID, ""), 400},
		{"bad date", f.manager, f.agendaPath(f.complexID, "date=2026-02-30"), 400},
		{"past date", f.manager, f.agendaPath(f.complexID, "date=2000-01-01"), 400},
		{"beyond window", f.manager, f.agendaPath(f.complexID, "date="+time.Now().AddDate(0, 0, 20).Format("2006-01-02")), 400},
		{"extra param", f.manager, f.agendaPath(f.complexID, query+"&x=1"), 400},
		{"duplicate date", f.manager, f.agendaPath(f.complexID, query+"&date="+f.date), 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			expectManual(t, f.request("GET", tc.path, tc.token, ""), tc.status)
		})
	}
	reply := f.request("GET", f.agendaPath(f.complexID, query), f.manager, "")
	data := expectManual(t, reply, 200)
	if reply.header.Get("Cache-Control") != "no-store" {
		t.Fatalf("headers=%v", reply.header)
	}
	expectManual(t, f.request("GET", f.agendaPath(f.complexID, query), f.admin, ""), 200)
	got := decodeAgenda(t, data)
	if got.Date != f.date || len(got.Courts) != 1 || got.Courts[0].Name != "Court" {
		t.Fatalf("agenda=%s", data)
	}
	if strings.Contains(string(data), "Ghost") {
		t.Fatal("removed court reservation listed")
	}
	court := got.Courts[0]
	status := map[string]agenda.Slot{}
	for _, s := range court.Slots {
		status[s.StartsAt] = s
	}
	if s := status["18:00"]; s.Status != "RESERVED" || s.ReservationID != web {
		t.Fatalf("18:00=%+v", s)
	}
	if s := status["19:00"]; s.Status != "RESERVED" || s.ReservationID != manual {
		t.Fatalf("19:00=%+v", s)
	}
	if s := status["20:00"]; s.Status != "AVAILABLE" || s.ReservationID != "" {
		t.Fatalf("20:00=%+v", s)
	}
	if s := status["21:00"]; s.Status != "RESERVED" || s.ReservationID != misaligned {
		t.Fatalf("21:00=%+v", s)
	}
	byID := map[string]agenda.Reservation{}
	for _, r := range court.Reservations {
		byID[r.ID] = r
	}
	if len(byID) != 4 {
		t.Fatalf("reservations=%+v", court.Reservations)
	}
	if r := byID[web]; r.Origin != "web" || r.Contact.Name != "Private client" || r.Contact.Phone != "555-PRIVATE" || r.StartsAt != "18:00" || r.EndsAt != "19:00" || !r.Cancellable || r.OriginalStartsAt == "" {
		t.Fatalf("web=%+v", r)
	}
	if r := byID[manual]; r.Origin != "manual" || !r.Cancellable {
		t.Fatalf("manual=%+v", r)
	}
	if r := byID[misaligned]; r.StartsAt != "21:15" || r.EndsAt != "21:45" {
		t.Fatalf("misaligned=%+v", r)
	}
	if _, ok := byID[outside]; !ok {
		t.Fatal("reservation outside the grid must appear in reservations[]")
	}
	// A reservation that already ended is listed but no longer cancellable.
	later := f.clockServer(t, slotTime(t, f, "19:30"))
	after := decodeAgenda(t, expectManual(t, later.request("GET", f.agendaPath(f.complexID, query), f.manager, ""), 200))
	for _, r := range after.Courts[0].Reservations {
		wantCancellable := r.ID == manual || r.ID == misaligned
		if r.Cancellable != wantCancellable {
			t.Fatalf("cancellable(%s)=%v want %v", r.ID, r.Cancellable, wantCancellable)
		}
	}
	// A cancelled reservation disappears and its slot is free again.
	expectManual(t, f.request("POST", f.managerCancelPath(f.complexID, web), f.manager, ""), 200)
	again := decodeAgenda(t, expectManual(t, f.request("GET", f.agendaPath(f.complexID, query), f.manager, ""), 200))
	for _, s := range again.Courts[0].Slots {
		if s.StartsAt == "18:00" && (s.Status != "AVAILABLE" || s.ReservationID != "") {
			t.Fatalf("18:00 after cancel=%+v", s)
		}
	}
}

// The public grid must keep its exact shape: no contact, ids or agenda fields (TDD-0015 CA-06).
func TestPublicSlotsJSONUnchangedByAgenda(t *testing.T) {
	f := newManualFixture(t)
	f.insertReservation(t, "web", f.userID(t, "manual-player@example.com"), slotTime(t, f, "18:00"), slotTime(t, f, "19:00"))
	data := expectManual(t, f.request("GET", fmt.Sprintf("/api/v1/complexes/%s/slots?date=%s", f.complexID, f.date), "", ""), 200)
	var body struct {
		Complex map[string]any
		Date    string
		Courts  []map[string]json.RawMessage
	}
	if err := json.Unmarshal(data, &body); err != nil {
		t.Fatal(err)
	}
	keys := func(m map[string]json.RawMessage) string {
		var k []string
		for key := range m {
			k = append(k, key)
		}
		sort.Strings(k)
		return strings.Join(k, ",")
	}
	if len(body.Courts) != 1 || keys(body.Courts[0]) != "covered,id,name,occupiedIntervals,slots" {
		t.Fatalf("court keys=%s", data)
	}
	var slotList []map[string]json.RawMessage
	if err := json.Unmarshal(body.Courts[0]["slots"], &slotList); err != nil || len(slotList) == 0 {
		t.Fatalf("slots=%s err=%v", data, err)
	}
	for _, s := range slotList {
		if keys(s) != "endsAt,id,isPast,startsAt,status" {
			t.Fatalf("slot keys=%s", keys(s))
		}
	}
	for _, forbidden := range []string{"contact", "reservationId", "Private client", "555-PRIVATE", `"origin"`, "cancellable"} {
		if strings.Contains(string(data), forbidden) {
			t.Fatalf("public response contains %s: %s", forbidden, data)
		}
	}
}
