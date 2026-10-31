ALTER TABLE complexes
    ADD COLUMN image_data BYTEA,
    ADD COLUMN image_mime_type VARCHAR(20)
        CHECK (image_mime_type IS NULL OR image_mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    ADD CONSTRAINT complexes_image_pair_check
        CHECK ((image_data IS NULL) = (image_mime_type IS NULL)),
    ADD CONSTRAINT complexes_image_size_check
        CHECK (image_data IS NULL OR octet_length(image_data) <= 5242880);
