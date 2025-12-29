-- Create table buses for valid license plates (patentes)
CREATE TABLE IF NOT EXISTS buses (
  id_bus SERIAL PRIMARY KEY,
  patente VARCHAR(16) NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by patente
CREATE INDEX IF NOT EXISTS idx_buses_patente ON buses(patente);

-- Add optional bus reference to clusters
ALTER TABLE clusters
  ADD COLUMN IF NOT EXISTS id_bus INTEGER NULL;

-- Foreign key constraint linking clusters to buses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'clusters_id_bus_fkey'
  ) THEN
    ALTER TABLE clusters
      ADD CONSTRAINT clusters_id_bus_fkey
      FOREIGN KEY (id_bus)
      REFERENCES buses(id_bus)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;
