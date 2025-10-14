// Test manual para verificar el flujo de project profile salaries
// Pegar este código en la consola del navegador cuando esté en la página de perfiles

console.log('🔍 Testing project profile salaries flow...');

// 1. Verificar que apiConfig está disponible
try {
  console.log('✓ apiConfig disponible:', window.apiConfig || 'No disponible directamente');
} catch (e) {
  console.log('❌ Error accediendo apiConfig:', e);
}

// 2. Test simple de conectividad
async function testConnectivity() {
  try {
    console.log('🌐 Testing backend connectivity...');
    
    // Asumiendo que hay un proyecto con ID 1
    const projectId = 1; // Cambiar por un ID válido
    
    console.log(`📊 Testing project profiles for project ${projectId}...`);
    
    // Obtener project profiles
    const response = await fetch(`/api/project-profiles/${projectId}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const projectProfiles = await response.json();
    console.log('✅ Project profiles obtenidos:', projectProfiles);
    
    if (projectProfiles.length === 0) {
      console.log('⚠️  No hay project profiles. Crear algunos primero.');
      return;
    }
    
    // Tomar el primer project profile
    const firstProfile = projectProfiles[0];
    const projectProfileId = firstProfile.project_profile_id;
    
    if (!projectProfileId) {
      console.log('❌ project_profile_id no encontrado en:', firstProfile);
      return;
    }
    
    console.log(`📈 Testing salaries for project_profile_id: ${projectProfileId}...`);
    
    // Obtener salarios para este project profile
    const salariesResponse = await fetch(`/api/project-profile-salaries?project_profile_id=${projectProfileId}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!salariesResponse.ok) {
      throw new Error(`HTTP ${salariesResponse.status}: ${salariesResponse.statusText}`);
    }
    
    const salaries = await salariesResponse.json();
    console.log('✅ Salarios obtenidos:', salaries);
    
    // Test crear un nuevo salario
    console.log('🆕 Testing crear nuevo salario...');
    
    const newSalary = {
      project_profile_id: projectProfileId,
      country_id: 1, // Cambiar por un ID válido
      salary: 55000,
      year: 2025
    };
    
    const createResponse = await fetch('/api/project-profile-salaries', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newSalary)
    });
    
    if (createResponse.ok) {
      const created = await createResponse.json();
      console.log('✅ Salario creado exitosamente:', created);
    } else {
      const errorText = await createResponse.text();
      console.log('❌ Error creando salario:', createResponse.status, errorText);
    }
    
  } catch (error) {
    console.error('❌ Error en test:', error);
  }
}

// Ejecutar el test
testConnectivity();

console.log(`
📋 Instrucciones adicionales:
1. Abrir Network tab en Developer Tools
2. Ejecutar este test 
3. Verificar las requests HTTP que se hacen
4. Buscar errores 401, 404, 500, etc.
5. Verificar que las cookies de autenticación se envían
6. Si hay errores, compartir los detalles específicos
`);