CREATE TABLE courts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE RESTRICT,
    name VARCHAR(40) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 40),
    covered BOOLEAN NOT NULL,
    has_lighting BOOLEAN NOT NULL DEFAULT false,
    has_electronic_scoreboard BOOLEAN NOT NULL DEFAULT false,
    has_wifi BOOLEAN NOT NULL DEFAULT false,
    has_acrylic_surface BOOLEAN NOT NULL DEFAULT false,
    image_data BYTEA,
    image_mime_type VARCHAR(20) CHECK (image_mime_type IS NULL OR image_mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CHECK ((image_data IS NULL) = (image_mime_type IS NULL)),
    CHECK (image_data IS NULL OR octet_length(image_data) <= 5242880)
);

CREATE INDEX courts_active_by_complex_idx ON courts (complex_id, name, id) WHERE deleted_at IS NULL;
