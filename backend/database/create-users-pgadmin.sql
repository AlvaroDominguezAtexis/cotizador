-- Script SQL para crear usuarios de prueba en pgAdmin
-- Ejecutar este script completo en pgAdmin

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

-- Verificar que los usuarios se crearon correctamente
SELECT 
    id, 
    name, 
    email, 
    role, 
    is_active, 
    created_at,
    CASE 
        WHEN email = 'admin@cotizador.com' THEN 'Contraseña: admin123'
        WHEN email = 'test@cotizador.com' THEN 'Contraseña: test123'
        WHEN email = 'dev@cotizador.com' THEN 'Contraseña: dev123'
    END as password_info
FROM users 
WHERE email IN ('admin@cotizador.com', 'test@cotizador.com', 'dev@cotizador.com')
ORDER BY created_at;

-- Mostrar información de los usuarios creados
SELECT 
    '=== USUARIOS DE PRUEBA CREADOS ===' as info
UNION ALL
SELECT 
    'Email: admin@cotizador.com | Password: admin123 | Rol: admin'
UNION ALL
SELECT 
    'Email: test@cotizador.com | Password: test123 | Rol: user'
UNION ALL
SELECT 
    'Email: dev@cotizador.com | Password: dev123 | Rol: user'
UNION ALL
SELECT 
    '=== LISTO PARA PROBAR LOGIN ===';