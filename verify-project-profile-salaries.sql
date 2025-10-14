-- Verificar la estructura de la tabla project_profile_salaries
-- Ejecutar este script en pgAdmin para verificar si la tabla existe y su estructura

-- 1. Verificar si la tabla existe
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_name = 'project_profile_salaries';

-- 2. Ver la estructura de la tabla si existe
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'project_profile_salaries'
ORDER BY ordinal_position;

-- 3. Verificar constraints y índices
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'project_profile_salaries';

-- 4. Verificar foreign keys
SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE constraint_type = 'FOREIGN KEY' 
    AND tc.table_name='project_profile_salaries';

-- 5. Si la tabla no existe, crearla
CREATE TABLE IF NOT EXISTS project_profile_salaries (
    id SERIAL PRIMARY KEY,
    project_profile_id INTEGER NOT NULL,
    country_id INTEGER NOT NULL,
    salary DECIMAL(15,2) NOT NULL,
    year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint para evitar duplicados
    UNIQUE(project_profile_id, country_id, year),
    
    -- Foreign keys
    FOREIGN KEY (project_profile_id) REFERENCES project_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
);

-- 6. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_project_profile_salaries_project_profile_id 
ON project_profile_salaries(project_profile_id);

CREATE INDEX IF NOT EXISTS idx_project_profile_salaries_country_id 
ON project_profile_salaries(country_id);

-- 7. Verificar que project_profiles existe
SELECT 'project_profiles table exists' as status
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'project_profiles'
);

-- 8. Verificar que countries existe  
SELECT 'countries table exists' as status
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'countries'
);

-- 9. Ver algunos datos de ejemplo si existen
SELECT COUNT(*) as total_records FROM project_profile_salaries;

SELECT COUNT(*) as total_project_profiles FROM project_profiles;

-- 10. Mensaje final
SELECT 'Verificación completada - Revisar resultados arriba' as resultado;