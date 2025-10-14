-- Test específico para verificar project_profile_salaries
-- Ejecutar paso a paso en pgAdmin

-- 1. Verificar datos en project_profiles
SELECT 'Verificando project_profiles...' as paso;
SELECT 
    pp.id as project_profile_id,
    pp.project_id,
    pp.profile_id,
    p.name as profile_name
FROM project_profiles pp
JOIN profiles p ON p.id = pp.profile_id
ORDER BY pp.id
LIMIT 10;

-- 2. Verificar datos en project_profile_salaries
SELECT 'Verificando project_profile_salaries...' as paso;
SELECT 
    pps.id,
    pps.project_profile_id,
    pps.country_id,
    pps.salary,
    pps.year,
    pp.project_id,
    p.name as profile_name
FROM project_profile_salaries pps
JOIN project_profiles pp ON pp.id = pps.project_profile_id
JOIN profiles p ON p.id = pp.profile_id
ORDER BY pps.id
LIMIT 10;

-- 3. Verificar si hay relaciones rotas
SELECT 'Verificando relaciones...' as paso;
SELECT COUNT(*) as total_project_profiles FROM project_profiles;
SELECT COUNT(*) as total_salaries FROM project_profile_salaries;

-- 4. Buscar project_profile_id específicos para testing
SELECT 'IDs disponibles para testing...' as paso;
SELECT 
    pp.id as project_profile_id,
    pp.project_id,
    p.name as profile_name,
    COUNT(pps.id) as salaries_count
FROM project_profiles pp
JOIN profiles p ON p.id = pp.profile_id
LEFT JOIN project_profile_salaries pps ON pps.project_profile_id = pp.id
GROUP BY pp.id, pp.project_id, p.name
ORDER BY pp.id
LIMIT 5;

-- 5. Test manual de inserción
SELECT 'Probando inserción manual...' as paso;

-- Obtener un project_profile_id válido
DO $$
DECLARE
    test_project_profile_id INTEGER;
    test_country_id INTEGER := 1; -- Asumir que país ID 1 existe
    test_salary DECIMAL := 50000.00;
    test_year INTEGER := 2025;
BEGIN
    -- Obtener el primer project_profile_id disponible
    SELECT id INTO test_project_profile_id 
    FROM project_profiles 
    LIMIT 1;
    
    IF test_project_profile_id IS NOT NULL THEN
        RAISE NOTICE 'Usando project_profile_id: %', test_project_profile_id;
        
        -- Intentar insertar un salario de prueba
        INSERT INTO project_profile_salaries (project_profile_id, country_id, salary, year)
        VALUES (test_project_profile_id, test_country_id, test_salary, test_year)
        ON CONFLICT (project_profile_id, country_id, year) 
        DO UPDATE SET salary = EXCLUDED.salary;
        
        RAISE NOTICE 'Inserción exitosa!';
    ELSE
        RAISE NOTICE 'No se encontraron project_profiles para testing';
    END IF;
END $$;

-- 6. Verificar la inserción
SELECT 'Verificando inserción de prueba...' as paso;
SELECT * FROM project_profile_salaries 
WHERE year = 2025 AND salary = 50000.00;

-- 7. Verificar constraints de la tabla
SELECT 'Verificando constraints...' as paso;
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    STRING_AGG(kcu.column_name, ', ') as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'project_profile_salaries'
GROUP BY tc.constraint_name, tc.constraint_type;

SELECT 'Test completado - Verificar resultados' as resultado;