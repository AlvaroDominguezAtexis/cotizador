// Debug script para verificar el flujo de project profile salaries
// Ejecutar con: node debug-salaries.js

console.log('🔍 Iniciando debug de project profile salaries...\n');

// Mock data para probar
const testData = {
  project_id: 1,
  profile_id: 1,
  project_profile_id: 1,
  country_id: 1,
  salary: 50000,
  year: 2025
};

console.log('📊 Datos de prueba:', testData);

// Simular pasos del frontend:
console.log('\n📋 Pasos que debería seguir el frontend:');
console.log('1. Obtener project_profiles para un proyecto');
console.log('2. Para cada perfil, obtener project_profile_id');
console.log('3. Usar project_profile_id para obtener/crear/actualizar salarios');
console.log('4. Enviar datos a /api/project-profile-salaries');

console.log('\n🔗 URLs que se deberían usar:');
console.log('- GET /api/project-profiles/1 (obtener perfiles del proyecto)');
console.log('- GET /api/project-profile-salaries?project_profile_id=X (obtener salarios)');
console.log('- POST /api/project-profile-salaries (crear nuevo salario)');
console.log('- PUT /api/project-profile-salaries/ID (actualizar salario)');

console.log('\n🎯 Verificaciones requeridas:');
console.log('✓ Backend corriendo en puerto 4000');
console.log('✓ Autenticación funcionando (cookies)');
console.log('✓ Tabla project_profile_salaries existe');
console.log('✓ Datos de prueba en project_profiles');

console.log('\n💡 Posibles problemas a verificar:');
console.log('- project_profile_id no se está obteniendo correctamente');
console.log('- Datos no se envían en formato correcto');
console.log('- Faltan cookies de autenticación');
console.log('- Proxy no está funcionando correctamente');
console.log('- Tabla project_profile_salaries no tiene los constraints correctos');

console.log('\n🚀 Para probar manualmente:');
console.log('1. Abrir Developer Tools en el navegador');
console.log('2. Ir a Network tab');
console.log('3. Intentar guardar un salario');
console.log('4. Ver qué requests se hacen y sus respuestas');
console.log('5. Verificar si hay errores 401, 404, 500, etc.');

console.log('\n✅ Script de debug completado.');