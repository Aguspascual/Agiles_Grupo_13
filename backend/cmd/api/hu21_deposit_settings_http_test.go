package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

const hu21ComplexURL = "/api/v1/complexes/%s"

func hu21Draft(managerID, pricing string) string {
	body := fmt.Sprintf(`{"name":"Manual club","address":"Street","zone":"Gonnet","phone":"123","managerIds":[%q]`, managerID)
	if pricing != "" {
		body += `,"pricing":` + pricing
	}
	return body + `}`
}

func hu21Pricing(turnPrice, enabled, kind, value string) string {
	return fmt.Sprintf(`{"turnPrice":%s,"depositEnabled":%s,"depositType":%q,"depositValue":%s}`, turnPrice, enabled, kind, value)
}

func TestHU21ComplexPricingPersistsAndIsScopedToAssignedManager(t *testing.T) {
	f := newManualFixture(t)
	url := fmt.Sprintf(hu21ComplexURL, f.complexID)
	fixed := hu21Pricing(`12500.50`, `true`, "fixed", `3500.25`)
	updated := f.request("PUT", url, f.manager, hu21Draft(f.managerID, fixed))
	if updated.status != 200 {
		t.Fatalf("assigned manager update status=%d body=%s", updated.status, updated.body)
	}
	if !strings.Contains(string(updated.body), `"turnPrice":"12500.50"`) || !strings.Contains(string(updated.body), `"depositValue":"3500.25"`) {
		t.Fatalf("updated response omitted exact pricing: %s", updated.body)
	}
	var priceCents, valueUnits int64
	var enabled bool
	var kind string
	if err := f.db.QueryRow(f.ctx, `SELECT turn_price_cents,deposit_enabled,deposit_type,deposit_value_units FROM complexes WHERE id=$1::uuid`, f.complexID).Scan(&priceCents, &enabled, &kind, &valueUnits); err != nil {
		t.Fatal(err)
	}
	if priceCents != 1_250_050 || !enabled || kind != "fixed" || valueUnits != 350_025 {
		t.Fatalf("persisted fixed settings price=%d enabled=%v type=%s value=%d", priceCents, enabled, kind, valueUnits)
	}

	percentage := hu21Pricing(`12500.50`, `true`, "percentage", `12.75`)
	if reply := f.request("PUT", url, f.manager, hu21Draft(f.managerID, percentage)); reply.status != 200 {
		t.Fatalf("percentage update status=%d body=%s", reply.status, reply.body)
	}
	var listed struct {
		Complexes []struct {
			ID      string `json:"id"`
			Pricing struct {
				TurnPrice      string `json:"turnPrice"`
				DepositEnabled bool   `json:"depositEnabled"`
				DepositType    string `json:"depositType"`
				DepositValue   string `json:"depositValue"`
			} `json:"pricing"`
		} `json:"complexes"`
	}
	data := expectManual(t, f.request("GET", "/api/v1/complexes", f.manager, ""), 200)
	if err := json.Unmarshal(data, &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Complexes) != 1 || listed.Complexes[0].ID != f.complexID || listed.Complexes[0].Pricing.TurnPrice != "12500.50" || !listed.Complexes[0].Pricing.DepositEnabled || listed.Complexes[0].Pricing.DepositType != "percentage" || listed.Complexes[0].Pricing.DepositValue != "12.75" {
		t.Fatalf("listing did not return persisted pricing: %+v", listed.Complexes)
	}
	if reply := f.request("PUT", url, f.player, hu21Draft(f.managerID, fixed)); reply.status != 403 {
		t.Fatalf("unassigned user update status=%d body=%s", reply.status, reply.body)
	}
}

func TestHU21RejectsInvalidPricingAndKeepsPreviousSettings(t *testing.T) {
	f := newManualFixture(t)
	url := fmt.Sprintf(hu21ComplexURL, f.complexID)
	valid := hu21Pricing(`9000`, `true`, "fixed", `9000`)
	if reply := f.request("PUT", url, f.manager, hu21Draft(f.managerID, valid)); reply.status != 200 {
		t.Fatalf("valid boundary settings status=%d body=%s", reply.status, reply.body)
	}
	for _, tc := range []struct{ name, pricing string }{
		{"zero price", hu21Pricing(`0`, `true`, "fixed", `1`)},
		{"negative price", hu21Pricing(`-1`, `true`, "fixed", `1`)},
		{"more than two price decimals", hu21Pricing(`10.001`, `true`, "fixed", `1`)},
		{"zero fixed deposit", hu21Pricing(`100`, `true`, "fixed", `0`)},
		{"fixed deposit exceeds price", hu21Pricing(`100`, `true`, "fixed", `100.01`)},
		{"negative fixed deposit", hu21Pricing(`100`, `true`, "fixed", `-1`)},
		{"percentage below minimum", hu21Pricing(`100`, `true`, "percentage", `0.99`)},
		{"percentage above maximum", hu21Pricing(`100`, `true`, "percentage", `100.01`)},
		{"unknown type", hu21Pricing(`100`, `true`, "other", `20`)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if reply := f.request("PUT", url, f.manager, hu21Draft(f.managerID, tc.pricing)); reply.status != 400 {
				t.Fatalf("invalid pricing status=%d body=%s", reply.status, reply.body)
			}
			var price, value int64
			var kind string
			if err := f.db.QueryRow(f.ctx, `SELECT turn_price_cents,deposit_type,deposit_value_units FROM complexes WHERE id=$1::uuid`, f.complexID).Scan(&price, &kind, &value); err != nil {
				t.Fatal(err)
			}
			if price != 900_000 || kind != "fixed" || value != 900_000 {
				t.Fatalf("invalid update changed stored values: price=%d type=%s value=%d", price, kind, value)
			}
		})
	}
}

func TestHU21DisabledDepositPreservesReservationFlowAndLegacyUpdates(t *testing.T) {
	f := newManualFixture(t)
	url := fmt.Sprintf(hu21ComplexURL, f.complexID)
	disabled := hu21Pricing(`7800.25`, `false`, "fixed", `0`)
	if reply := f.request("PUT", url, f.manager, hu21Draft(f.managerID, disabled)); reply.status != 200 {
		t.Fatalf("disabled deposit update status=%d body=%s", reply.status, reply.body)
	}
	reservationBody := fmt.Sprintf(`{"date":%q,"startsAt":"20:00","contact":{"name":"Player","phone":"123"}}`, f.date)
	if reply := f.request("POST", f.path("reservations"), f.player, reservationBody); reply.status != 201 {
		t.Fatalf("deposit-disabled web reservation status=%d body=%s", reply.status, reply.body)
	}
	legacy := fmt.Sprintf(`{"name":"Manual club","address":"Street","zone":"Gonnet","phone":"123","managerIds":[%q]}`, f.managerID)
	if reply := f.request("PUT", url, f.manager, legacy); reply.status != 200 {
		t.Fatalf("legacy update without pricing status=%d body=%s", reply.status, reply.body)
	}
	var price int64
	var enabled bool
	if err := f.db.QueryRow(f.ctx, `SELECT turn_price_cents,deposit_enabled FROM complexes WHERE id=$1::uuid`, f.complexID).Scan(&price, &enabled); err != nil || price != 780_025 || enabled {
		t.Fatalf("legacy update changed pricing price=%d enabled=%v err=%v", price, enabled, err)
	}
}
