-- Verificar datos existentes en las tablas relacionadas
-- Ejecutar en pgAdmin para diagnosticar el problema

-- 1. Verificar proyectos disponibles
SELECT 'PROYECTOS DISPONIBLES:' as info;
SELECT id, name, client, start_date, end_date, created_by 
FROM projects 
ORDER BY id 
LIMIT 10;

-- 2. Verificar perfiles disponibles  
SELECT 'PERFILES DISPONIBLES:' as info;
SELECT id, name, is_official 
FROM profiles 
ORDER BY id 
LIMIT 10;

-- 3. Verificar relaciones project_profiles existentes
SELECT 'RELACIONES PROJECT_PROFILES EXISTENTES:' as info;
SELECT 
    pp.id as project_profile_id,
    pp.project_id,
    pp.profile_id,
    p.name as profile_name,
    proj.name as project_name
FROM project_profiles pp
LEFT JOIN profiles p ON p.id = pp.profile_id
LEFT JOIN projects proj ON proj.id = pp.project_id
ORDER BY pp.project_id, pp.id;

-- 4. Contar registros por proyecto
SELECT 'CONTEO POR PROYECTO:' as info;
SELECT 
    pp.project_id,
    proj.name as project_name,
    COUNT(pp.id) as profiles_count
FROM project_profiles pp
LEFT JOIN projects proj ON proj.id = pp.project_id
GROUP BY pp.project_id, proj.name
ORDER BY pp.project_id;

-- 5. Ver qué salarios existen
SELECT 'SALARIOS EXISTENTES:' as info;
SELECT 
    pps.id,
    pps.project_profile_id,
    pp.project_id,
    p.name as profile_name,
    pps.country_id,
    pps.salary,
    pps.year
FROM project_profile_salaries pps
JOIN project_profiles pp ON pp.id = pps.project_profile_id
JOIN profiles p ON p.id = pp.profile_id
ORDER BY pp.project_id, pps.project_profile_id
LIMIT 10;

-- 6. Crear datos de prueba si no existen
DO $$
DECLARE
    test_project_id INTEGER;
    test_profile_id INTEGER;
    new_project_profile_id INTEGER;
BEGIN
    -- Obtener o crear un proyecto de prueba
    SELECT id INTO test_project_id FROM projects ORDER BY id LIMIT 1;
    
    IF test_project_id IS NULL THEN
        RAISE NOTICE 'No hay proyectos. Creando proyecto de prueba...';
        INSERT INTO projects (name, client, start_date, end_date, created_by)
        VALUES ('Proyecto Test', 1, '2025-01-01', '2025-12-31', 1)
        RETURNING id INTO test_project_id;
        RAISE NOTICE 'Proyecto creado con ID: %', test_project_id;
    END IF;
    
    -- Obtener o crear un perfil de prueba
    SELECT id INTO test_profile_id FROM profiles ORDER BY id LIMIT 1;
    
    IF test_profile_id IS NULL THEN
        RAISE NOTICE 'No hay perfiles. Creando perfil de prueba...';
        INSERT INTO profiles (name, is_official)
        VALUES ('Desarrollador Senior', false)
        RETURNING id INTO test_profile_id;
        RAISE NOTICE 'Perfil creado con ID: %', test_profile_id;
    END IF;
    
    -- Verificar si ya existe la relación project_profile
    IF NOT EXISTS (
        SELECT 1 FROM project_profiles 
        WHERE project_id = test_project_id AND profile_id = test_profile_id
    ) THEN
        RAISE NOTICE 'Creando relación project_profile...';
        INSERT INTO project_profiles (project_id, profile_id)
        VALUES (test_project_id, test_profile_id)
        RETURNING id INTO new_project_profile_id;
        RAISE NOTICE 'Project_profile creado con ID: %', new_project_profile_id;
        
        -- Crear un salario de ejemplo
        INSERT INTO project_profile_salaries (project_profile_id, country_id, salary, year)
        VALUES (new_project_profile_id, 1, 55000.00, 2025)
        ON CONFLICT (project_profile_id, country_id, year) DO NOTHING;
        RAISE NOTICE 'Salario de ejemplo creado';
    ELSE
        RAISE NOTICE 'Ya existe relación entre proyecto % y perfil %', test_project_id, test_profile_id;
    END IF;
    
    RAISE NOTICE 'Usar proyecto ID: % para las pruebas', test_project_id;
END $$;

-- 7. Verificación final
SELECT 'VERIFICACIÓN FINAL:' as info;
SELECT 
    pp.id as project_profile_id,
    pp.project_id,
    pp.profile_id,
    p.name as profile_name,
    proj.name as project_name,
    COUNT(pps.id) as salaries_count
FROM project_profiles pp
LEFT JOIN profiles p ON p.id = pp.profile_id
LEFT JOIN projects proj ON proj.id = pp.project_id
LEFT JOIN project_profile_salaries pps ON pps.project_profile_id = pp.id
GROUP BY pp.id, pp.project_id, pp.profile_id, p.name, proj.name
ORDER BY pp.project_id, pp.id;

SELECT 'Ejecutar test con el project_id mostrado arriba' as instruccion;