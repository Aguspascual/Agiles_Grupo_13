ALTER TABLE complexes
    ADD COLUMN turn_price_cents BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN deposit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN deposit_type TEXT NOT NULL DEFAULT 'fixed',
    ADD COLUMN deposit_value_units BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT complexes_turn_price_nonnegative_check
        CHECK (turn_price_cents >= 0),
    ADD CONSTRAINT complexes_deposit_type_check
        CHECK (deposit_type IN ('fixed', 'percentage')),
    ADD CONSTRAINT complexes_deposit_value_nonnegative_check
        CHECK (deposit_value_units >= 0),
    ADD CONSTRAINT complexes_active_deposit_valid_check
        CHECK (
            NOT deposit_enabled
            OR (
                turn_price_cents > 0
                AND (
                    (deposit_type = 'fixed' AND deposit_value_units BETWEEN 1 AND turn_price_cents)
                    OR (deposit_type = 'percentage' AND deposit_value_units BETWEEN 100 AND 10000)
                )
            )
        );
