package complexes

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
)

var errInvalidDecimalAmount = errors.New("invalid decimal amount")

// DecimalAmount stores non-negative ARS hundredths (or percentage hundredths)
// without binary floating-point conversion.
type DecimalAmount int64

func (a *DecimalAmount) UnmarshalJSON(data []byte) error {
	var value string
	if len(data) > 0 && data[0] == '"' {
		if err := json.Unmarshal(data, &value); err != nil {
			return errInvalidDecimalAmount
		}
	} else {
		value = string(bytes.TrimSpace(data))
	}
	cents, err := parseHundredths(value)
	if err != nil {
		return err
	}
	*a = DecimalAmount(cents)
	return nil
}

func (a DecimalAmount) MarshalJSON() ([]byte, error) {
	return json.Marshal(a.String())
}

func (a DecimalAmount) String() string {
	value := int64(a)
	return fmt.Sprintf("%d.%02d", value/100, value%100)
}

func parseHundredths(value string) (int64, error) {
	if value == "" || strings.ContainsAny(value, "eE+-") {
		return 0, errInvalidDecimalAmount
	}
	parts := strings.Split(value, ".")
	if len(parts) > 2 || parts[0] == "" {
		return 0, errInvalidDecimalAmount
	}
	for _, char := range parts[0] {
		if char < '0' || char > '9' {
			return 0, errInvalidDecimalAmount
		}
	}
	whole, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || whole > math.MaxInt64/100 {
		return 0, errInvalidDecimalAmount
	}
	fraction := ""
	if len(parts) == 2 {
		fraction = parts[1]
		if fraction == "" || len(fraction) > 2 {
			return 0, errInvalidDecimalAmount
		}
		for _, char := range fraction {
			if char < '0' || char > '9' {
				return 0, errInvalidDecimalAmount
			}
		}
	}
	if len(fraction) == 1 {
		fraction += "0"
	}
	minor := int64(0)
	if fraction != "" {
		minor, _ = strconv.ParseInt(fraction, 10, 64)
	}
	if whole == math.MaxInt64/100 && minor > math.MaxInt64%100 {
		return 0, errInvalidDecimalAmount
	}
	return whole*100 + minor, nil
}
