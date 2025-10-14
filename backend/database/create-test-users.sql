const { Pool } = require('pg');
const argon2 = require('argon2');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'cotizador_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function createTestUsers() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Creando usuarios de prueba...');
    
    await client.query('BEGIN');
    
    // Usuarios de prueba con sus contraseñas
    const testUsers = [
      {
        name: 'Administrador',
        email: 'admin@cotizador.com',
        password: 'admin123',
        role: 'admin'
      },
      {
        name: 'Usuario Prueba',
        email: 'test@cotizador.com',
        password: 'test123',
        role: 'user'
      },
      {
        name: 'Desarrollador',
        email: 'dev@cotizador.com',
        password: 'dev123',
        role: 'user'
      }
    ];

    for (const user of testUsers) {
      // Verificar si el usuario ya existe
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email]
      );
      
      if (existingUser.rows.length > 0) {
        console.log(`ℹ️  Usuario ${user.email} ya existe, actualizando contraseña...`);
        
        // Actualizar contraseña del usuario existente
        const hashedPassword = await argon2.hash(user.password);
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
          [hashedPassword, user.email]
        );
        
        console.log(`✅ Contraseña actualizada para ${user.email}`);
      } else {
        // Crear nuevo usuario
        const hashedPassword = await argon2.hash(user.password);
        
        await client.query(
          `INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          [user.name, user.email, hashedPassword, user.role]
        );
        
        console.log(`✅ Usuario creado: ${user.email}`);
      }
      
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   🔑 Password: ${user.password}`);
      console.log(`   👤 Rol: ${user.role}`);
      console.log('');
    }
    
    await client.query('COMMIT');
    
    // Mostrar todos los usuarios
    console.log('📋 Usuarios en la base de datos:');
    const allUsers = await client.query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at'
    );
    
    console.table(allUsers.rows);
    
    console.log('🎉 Usuarios de prueba creados/actualizados exitosamente');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creando usuarios de prueba:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  createTestUsers()
    .then(() => {
      console.log('✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = { createTestUsers };