-- SCRIPT COMPLETO PARA SETUP DEL SISTEMA
-- Ejecutar todo este script en pgAdmin de una sola vez

-- =====================================================
-- PARTE 1: CREAR USUARIOS DE PRUEBA
-- =====================================================

-- Borrar usuarios existentes si existen (opcional)
DELETE FROM user_sessions WHERE user_id IN (
    SELECT id FROM users WHERE email IN ('admin@cotizador.com', 'test@cotizador.com', 'dev@cotizador.com')
);
DELETE FROM users WHERE email IN ('admin@cotizador.com', 'test@cotizador.com', 'dev@cotizador.com');

-- Crear usuarios de prueba con hashes Argon2 válidos
INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
VALUES 
-- Usuario Administrador (password: admin123)
(
  'Administrador',
  'admin@cotizador.com',
  '$argon2id$v=19$m=65536,t=3,p=4$DksbhQQsNp3DuNU8qGjvCQ$HpY9DVTuw5Hs1dWspPfkXSGHEgkTVFBl7QTmncHAR0o',
  'admin',
  true,
  NOW(),
  NOW()
),
-- Usuario de Prueba (password: test123)
(
  'Usuario Prueba',
  'test@cotizador.com',
  '$argon2id$v=19$m=65536,t=3,p=4$rGYP580AhXuNud1DcUJgRQ$QZUNtvqEJu3xr6OyE69CM7+1mrWS5FbW3kK7d7kp2aA',
  'user',
  true,
  NOW(),
  NOW()
),
-- Usuario Desarrollador (password: dev123)
(
  'Desarrollador',
  'dev@cotizador.com',
  '$argon2id$v=19$m=65536,t=3,p=4$VQmejXwTQHq4OZUUa6sEnA$xh3K1c5idRszva3uryrQWCef/JkElIdyi74kuLbEGLY',
  'user',
  true,
  NOW(),
  NOW()
);

-- =====================================================
-- PARTE 2: MIGRAR CLIENTS A FK REAL
-- =====================================================

-- Mostrar estado inicial
SELECT '=== INICIANDO MIGRACIÓN DE CLIENTES ===' as info;

-- Verificar si la columna client ya es integer
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'client' 
        AND data_type = 'integer'
    ) THEN
        RAISE NOTICE 'La columna client ya es integer, saltando migración';
    ELSE
        RAISE NOTICE 'La columna client es text, procediendo con migración';
        
        -- Insertar clientes de ejemplo
        INSERT INTO clients (name) VALUES 
          ('Atlantica Yield'),
          ('Empresa Ejemplo S.L.'),
          ('Cliente Test'),
          ('Corporación ABC'),
          ('Sistemas Integrados')
        ON CONFLICT (name) DO NOTHING;

        -- Crear clientes para todos los nombres únicos en projects
        INSERT INTO clients (name)
        SELECT DISTINCT TRIM(p.client)
        FROM projects p
        WHERE p.client IS NOT NULL 
          AND p.client != ''
          AND NOT EXISTS (
            SELECT 1 FROM clients c 
            WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(p.client))
          );

        -- Agregar columna temporal
        ALTER TABLE projects ADD COLUMN client_id_temp INTEGER;

        -- Poblar columna temporal con IDs
        UPDATE projects 
        SET client_id_temp = c.id
        FROM clients c
        WHERE LOWER(TRIM(c.name)) = LOWER(TRIM(projects.client))
          AND projects.client IS NOT NULL 
          AND projects.client != '';

        -- Eliminar columna original y renombrar
        ALTER TABLE projects DROP COLUMN client;
        ALTER TABLE projects RENAME COLUMN client_id_temp TO client;

        -- Crear FK constraint
        ALTER TABLE projects 
        ADD CONSTRAINT fk_projects_client 
        FOREIGN KEY (client) REFERENCES clients(id) ON DELETE SET NULL;

        -- Crear índice
        CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client);
        
        RAISE NOTICE 'Migración completada exitosamente';
    END IF;
END $$;

-- =====================================================
-- PARTE 3: VERIFICACIONES FINALES
-- =====================================================

-- Verificar usuarios creados
SELECT '=== USUARIOS CREADOS ===' as info;
SELECT 
    id, 
    name, 
    email, 
    role, 
    is_active,
    CASE 
        WHEN email = 'admin@cotizador.com' THEN 'Contraseña: admin123'
        WHEN email = 'test@cotizador.com' THEN 'Contraseña: test123'
        WHEN email = 'dev@cotizador.com' THEN 'Contraseña: dev123'
    END as password_info
FROM users 
WHERE email IN ('admin@cotizador.com', 'test@cotizador.com', 'dev@cotizador.com')
ORDER BY created_at;

-- Verificar estructura de clientes
SELECT '=== CLIENTES DISPONIBLES ===' as info;
SELECT id, name FROM clients ORDER BY name;

-- Verificar estructura de projects
SELECT '=== ESTRUCTURA PROJECTS ===' as info;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'projects' 
  AND column_name IN ('id', 'title', 'client', 'created_by')
ORDER BY ordinal_position;

-- Verificar FK constraints
SELECT '=== FOREIGN KEYS ===' as info;
SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'projects';

-- Verificar proyectos existentes con clientes
SELECT '=== PROYECTOS CON CLIENTES ===' as info;
SELECT 
    p.id,
    p.title,
    p.client as client_id,
    c.name as client_name
FROM projects p
LEFT JOIN clients c ON p.client = c.id
WHERE p.client IS NOT NULL
LIMIT 10;

-- Mostrar resumen final
SELECT '=== SETUP COMPLETADO ===' as resultado;
SELECT 'Email: admin@cotizador.com | Password: admin123 | Rol: admin' as login_info;
SELECT 'Email: test@cotizador.com | Password: test123 | Rol: user' as login_info_2;
SELECT 'La columna projects.client ahora es FK integer hacia clients.id' as estructura;
SELECT '¡LISTO PARA PROBAR EL SISTEMA!' as estado;