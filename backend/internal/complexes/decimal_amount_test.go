package complexes

import (
	"encoding/json"
	"testing"
)

func TestDecimalAmountParsesAndMarshalsExactHundredths(t *testing.T) {
	for _, input := range []string{`12500.50`, `"12500.50"`, `12500.5`, `"12500.5"`} {
		var amount DecimalAmount
		if err := json.Unmarshal([]byte(input), &amount); err != nil || amount != 1_250_050 {
			t.Errorf("input=%s amount=%d err=%v", input, amount, err)
		}
	}
	encoded, err := json.Marshal(DecimalAmount(1_250_050))
	if err != nil || string(encoded) != `"12500.50"` {
		t.Fatalf("encoded=%s err=%v", encoded, err)
	}
}

func TestDecimalAmountRejectsInvalidPrecisionAndRange(t *testing.T) {
	for _, input := range []string{`-1`, `1.001`, `1e2`, `+1`, `1.`, `"1,25"`, `92233720368547758.08`} {
		var amount DecimalAmount
		if err := json.Unmarshal([]byte(input), &amount); err == nil {
			t.Errorf("input=%s accepted as %d", input, amount)
		}
	}
}

func TestPricingValidation(t *testing.T) {
	valid := Pricing{TurnPrice: 900_000, DepositEnabled: true, DepositType: "fixed", DepositValue: 900_000}
	if err := valid.Validate(); err != nil {
		t.Fatalf("valid maximum fixed deposit: %v", err)
	}
	valid.DepositType, valid.DepositValue = "percentage", 10_000
	if err := valid.Validate(); err != nil {
		t.Fatalf("valid 100 percent: %v", err)
	}
	for _, invalid := range []Pricing{
		{TurnPrice: 0, DepositEnabled: true, DepositType: "fixed", DepositValue: 1},
		{TurnPrice: 100, DepositEnabled: true, DepositType: "fixed", DepositValue: 0},
		{TurnPrice: 100, DepositEnabled: true, DepositType: "fixed", DepositValue: 101},
		{TurnPrice: 100, DepositEnabled: true, DepositType: "percentage", DepositValue: 99},
		{TurnPrice: 100, DepositEnabled: true, DepositType: "percentage", DepositValue: 10_001},
		{TurnPrice: 100, DepositEnabled: false, DepositType: "other", DepositValue: 0},
	} {
		if err := invalid.Validate(); err == nil {
			t.Errorf("invalid pricing accepted: %+v", invalid)
		}
	}
}
