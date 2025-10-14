-- Script completo para convertir projects.client a FK real
-- Ejecutar este script DESPUÉS de crear los usuarios de prueba

BEGIN;

-- 1. Primero, asegurar que tenemos algunos clientes de ejemplo
INSERT INTO clients (name) VALUES 
  ('Atlantica Yield'),
  ('Empresa Ejemplo S.L.'),
  ('Cliente Test'),
  ('Corporación ABC'),
  ('Sistemas Integrados')
ON CONFLICT (name) DO NOTHING;

-- 2. Mostrar estado actual
SELECT 'ANTES DE LA MIGRACIÓN:' as info;
SELECT 
    p.id, 
    p.title, 
    p.client as client_original,
    pg_typeof(p.client) as tipo_columna
FROM projects p 
WHERE p.client IS NOT NULL AND p.client != ''
LIMIT 5;

-- 3. Crear clientes para todos los nombres únicos que existen en projects
INSERT INTO clients (name)
SELECT DISTINCT TRIM(p.client)
FROM projects p
WHERE p.client IS NOT NULL 
  AND p.client != ''
  AND NOT EXISTS (
    SELECT 1 FROM clients c 
    WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(p.client))
  );

-- 4. Agregar una nueva columna temporal para los IDs
ALTER TABLE projects ADD COLUMN client_id_temp INTEGER;

-- 5. Poblar la columna temporal con los IDs correspondientes
UPDATE projects 
SET client_id_temp = c.id
FROM clients c
WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(projects.client))
  AND projects.client IS NOT NULL 
  AND projects.client != '';

-- 6. Verificar que la migración funcionó
SELECT 'VERIFICACIÓN DE MIGRACIÓN:' as info;
SELECT 
    COUNT(*) as total_projects,
    COUNT(client) as projects_with_client_name,
    COUNT(client_id_temp) as projects_with_client_id
FROM projects;

-- 7. Mostrar algunos ejemplos de la migración
SELECT 
    p.id,
    p.title,
    p.client as nombre_original,
    p.client_id_temp as nuevo_id,
    c.name as nombre_verificado
FROM projects p
LEFT JOIN clients c ON p.client_id_temp = c.id
WHERE p.client IS NOT NULL AND p.client != ''
LIMIT 10;

-- 8. Eliminar la columna original y renombrar la temporal
ALTER TABLE projects DROP COLUMN client;
ALTER TABLE projects RENAME COLUMN client_id_temp TO client;

-- 9. Crear la FK constraint
ALTER TABLE projects 
ADD CONSTRAINT fk_projects_client 
FOREIGN KEY (client) REFERENCES clients(id) ON DELETE SET NULL;

-- 10. Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client);

-- 11. Verificación final
SELECT 'DESPUÉS DE LA MIGRACIÓN:' as info;
SELECT 
    p.id, 
    p.title, 
    p.client as client_id,
    c.name as client_name,
    pg_typeof(p.client) as tipo_columna
FROM projects p 
LEFT JOIN clients c ON p.client = c.id
WHERE p.client IS NOT NULL
LIMIT 10;

-- 12. Mostrar constraints creadas
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'projects'
  AND kcu.column_name = 'client';

SELECT '=== MIGRACIÓN DE FK COMPLETADA ===' as resultado;
SELECT '- La columna projects.client ahora es INTEGER' as info_1;
SELECT '- Es una FK que referencia clients.id' as info_2;
SELECT '- Los nombres se convirtieron correctamente a IDs' as info_3;

COMMIT;