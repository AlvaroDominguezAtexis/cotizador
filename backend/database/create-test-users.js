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
    
    // Usuario de prueba 1
    const testPassword1 = 'test123';
    const testHash1 = await argon2.hash(testPassword1);
    
    await client.query(
      `INSERT INTO users (name, email, password_hash, role, is_active) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
       password_hash = $3, updated_at = NOW()`,
      ['Usuario Prueba', 'test@cotizador.com', testHash1, 'user', true]
    );
    
    // Usuario de prueba 2
    const testPassword2 = 'admin456';
    const testHash2 = await argon2.hash(testPassword2);
    
    await client.query(
      `INSERT INTO users (name, email, password_hash, role, is_active) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
       password_hash = $3, updated_at = NOW()`,
      ['Admin Prueba', 'admin2@cotizador.com', testHash2, 'admin', true]
    );
    
    // Usuario desarrollador
    const devPassword = 'dev123';
    const devHash = await argon2.hash(devPassword);
    
    await client.query(
      `INSERT INTO users (name, email, password_hash, role, is_active) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET
       password_hash = $3, updated_at = NOW()`,
      ['Desarrollador', 'dev@cotizador.com', devHash, 'user', true]
    );
    
    await client.query('COMMIT');
    
    console.log('✅ Usuarios de prueba creados exitosamente:');
    console.log('');
    console.log('👤 Usuario Prueba:');
    console.log('   Email: test@cotizador.com');
    console.log('   Password: test123');
    console.log('   Rol: user');
    console.log('');
    console.log('👤 Admin Prueba:');
    console.log('   Email: admin2@cotizador.com');
    console.log('   Password: admin456');
    console.log('   Rol: admin');
    console.log('');
    console.log('👤 Desarrollador:');
    console.log('   Email: dev@cotizador.com');
    console.log('   Password: dev123');
    console.log('   Rol: user');
    console.log('');
    
    // Mostrar todos los usuarios
    const users = await client.query(
      'SELECT id, name, email, role, is_active, created_at FROM users ORDER BY created_at'
    );
    
    console.log('📋 Todos los usuarios en la base de datos:');
    users.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.role} - ${user.is_active ? 'Activo' : 'Inactivo'}`);
    });
    
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