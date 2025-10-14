-- MIGRACIÓN URGENTE: Convertir projects.client a FK integer
-- Ejecutar este script en pgAdmin AHORA

-- 1. Ver estado actual
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'client';

-- 1.5. Agregar constraint UNIQUE a clients.name si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'UNIQUE' 
        AND table_name = 'clients' 
        AND constraint_name LIKE '%name%'
    ) THEN
        ALTER TABLE clients ADD CONSTRAINT unique_client_name UNIQUE (name);
    END IF;
END $$;

-- 2. Agregar clientes de ejemplo si no existen
INSERT INTO clients (name) 
SELECT 'Atlantica Yield' WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Atlantica Yield')
UNION ALL
SELECT 'Cliente Test' WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Cliente Test')  
UNION ALL
SELECT 'Empresa Ejemplo' WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Empresa Ejemplo');

-- 3. Crear clientes para nombres existentes en projects
INSERT INTO clients (name)
SELECT DISTINCT p.client
FROM projects p
WHERE p.client IS NOT NULL 
  AND p.client != ''
  AND NOT EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.name = p.client
  );

-- 4. Migración de la columna
ALTER TABLE projects ADD COLUMN client_new INTEGER;

UPDATE projects 
SET client_new = c.id
FROM clients c
WHERE c.name = projects.client
  AND projects.client IS NOT NULL 
  AND projects.client != '';

ALTER TABLE projects DROP COLUMN client;
ALTER TABLE projects RENAME COLUMN client_new TO client;

-- 5. Crear FK
ALTER TABLE projects 
ADD CONSTRAINT fk_projects_client 
FOREIGN KEY (client) REFERENCES clients(id) ON DELETE SET NULL;

-- 6. Verificar resultado
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'client';

SELECT 'MIGRACIÓN COMPLETADA - Reinicia el backend' as resultado;