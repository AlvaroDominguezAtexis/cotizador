const argon2 = require('argon2');

async function generateHashes() {
  console.log('Generando hashes Argon2 para usuarios de prueba...\n');
  
  const users = [
    { email: 'admin@cotizador.com', password: 'admin123' },
    { email: 'test@cotizador.com', password: 'test123' },
    { email: 'dev@cotizador.com', password: 'dev123' }
  ];
  
  for (const user of users) {
    const hash = await argon2.hash(user.password);
    console.log(`${user.email}:`);
    console.log(`Password: ${user.password}`);
    console.log(`Hash: ${hash}\n`);
  }
}

generateHashes().catch(console.error);