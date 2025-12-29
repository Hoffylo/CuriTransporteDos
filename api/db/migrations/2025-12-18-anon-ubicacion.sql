-- Migration: Support anonymous telemetry identity in ubicacion
BEGIN;

-- Allow ubicacion.id_usuario to be NULL for anonymous entries
ALTER TABLE ubicacion ALTER COLUMN id_usuario DROP NOT NULL;

-- Add anonymous identity and registration flag
ALTER TABLE ubicacion 
  ADD COLUMN IF NOT EXISTS usuario_anonimo_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS es_registrado BOOLEAN DEFAULT FALSE;

-- Ensure each ubicacion has at least one identity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ubicacion_identity_present'
  ) THEN
    ALTER TABLE ubicacion
      ADD CONSTRAINT ubicacion_identity_present
      CHECK ((id_usuario IS NOT NULL) OR (usuario_anonimo_id IS NOT NULL));
  END IF;
END $$;

-- Index to speed lookups by anonymous id
CREATE INDEX IF NOT EXISTS idx_ubicacion_usuario_anonimo 
  ON ubicacion(usuario_anonimo_id, tiempo DESC);

COMMIT;
