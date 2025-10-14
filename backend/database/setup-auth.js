const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const argon2 = require('argon2');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'cotizador_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Ejecutando migración de autenticación...');
    
    // Leer y ejecutar el archivo SQL
    const sqlPath = path.join(__dirname, 'setup-auth.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query('BEGIN');
    await client.query(sql);
    
    console.log('✅ Tablas de autenticación creadas correctamente');
    
    // Crear usuario administrador por defecto si no existe
    const adminEmail = 'admin@cotizador.com';
    const adminPassword = 'admin123';
    
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );
    
    if (existingUser.rows.length === 0) {
      const hashedPassword = await argon2.hash(adminPassword);
      
      await client.query(
        `INSERT INTO users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, $4)`,
        ['Administrador', adminEmail, hashedPassword, 'admin']
      );
      
      console.log('✅ Usuario administrador creado:');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
    } else {
      console.log('ℹ️  Usuario administrador ya existe');
    }
    
    await client.query('COMMIT');
    console.log('🎉 Migración completada exitosamente');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = { runMigration };