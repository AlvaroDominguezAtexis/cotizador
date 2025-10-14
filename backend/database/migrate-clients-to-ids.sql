-- Script para migrar nombres de clientes a IDs en la tabla projects
-- Ejecutar DESPUÉS de crear los usuarios de prueba

-- 1. Primero, insertar algunos clientes de ejemplo si no existen
INSERT INTO clients (name) VALUES 
  ('Atlantica Yield'),
  ('Empresa Ejemplo S.L.'),
  ('Cliente Test'),
  ('Corporación ABC'),
  ('Sistemas Integrados')
ON CONFLICT (name) DO NOTHING;

-- 2. Mostrar los proyectos actuales con sus clientes (antes de la migración)
SELECT 
    id, 
    title, 
    client as client_original,
    'Antes de migración' as status
FROM projects 
WHERE client IS NOT NULL AND client != '';

-- 3. Crear una tabla temporal para mapear clientes
CREATE TEMP TABLE client_mapping AS
SELECT DISTINCT 
    p.client as original_name,
    c.id as new_id
FROM projects p
LEFT JOIN clients c ON LOWER(TRIM(c.name)) = LOWER(TRIM(p.client))
WHERE p.client IS NOT NULL 
  AND p.client != ''
  AND p.client !~ '^[0-9]+$'; -- Solo nombres, no IDs

-- 4. Insertar clientes que no existan
INSERT INTO clients (name)
SELECT DISTINCT p.client
FROM projects p
LEFT JOIN clients c ON LOWER(TRIM(c.name)) = LOWER(TRIM(p.client))
WHERE p.client IS NOT NULL 
  AND p.client != ''
  AND p.client !~ '^[0-9]+$'
  AND c.id IS NULL;

-- 5. Actualizar los proyectos para usar IDs en lugar de nombres
UPDATE projects 
SET client = c.id::text
FROM clients c
WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(projects.client))
  AND projects.client IS NOT NULL 
  AND projects.client != ''
  AND projects.client !~ '^[0-9]+$';

-- 6. Mostrar los proyectos después de la migración
SELECT 
    p.id, 
    p.title, 
    p.client as client_id,
    c.name as client_name,
    'Después de migración' as status
FROM projects p
LEFT JOIN clients c ON (
  CASE 
    WHEN p.client ~ '^[0-9]+$' THEN c.id = p.client::integer
    ELSE c.name = p.client
  END
)
WHERE p.client IS NOT NULL AND p.client != '';

-- 7. Verificación final
SELECT 
    COUNT(*) as total_projects,
    COUNT(CASE WHEN client ~ '^[0-9]+$' THEN 1 END) as projects_with_id,
    COUNT(CASE WHEN client !~ '^[0-9]+$' AND client IS NOT NULL AND client != '' THEN 1 END) as projects_with_name
FROM projects;

SELECT '=== MIGRACIÓN DE CLIENTES COMPLETADA ===' as result;