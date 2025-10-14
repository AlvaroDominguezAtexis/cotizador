// Test automático que busca proyectos disponibles
// Pegar en la consola del navegador en la página de perfiles

console.log('🚀 AUTO-DETECTING project profile salaries flow...\n');

async function autoTestFlow() {
  try {
    console.log('🔍 Step 0: Buscando proyectos disponibles...');
    
    // Primero, intentar obtener la lista de proyectos
    let availableProjects = [];
    try {
      const projectsRes = await fetch('/api/projects', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (projectsRes.ok) {
        availableProjects = await projectsRes.json();
        console.log('✅ Proyectos disponibles:', availableProjects);
      }
    } catch (e) {
      console.log('⚠️  No se pudo obtener lista de proyectos, usando ID 1 por defecto');
    }
    
    // Probar múltiples IDs de proyecto
    const projectIdsToTry = [1, 2, 3];
    if (availableProjects.length > 0) {
      projectIdsToTry.unshift(...availableProjects.map(p => p.id).slice(0, 3));
    }
    
    console.log('🎯 Probando project IDs:', projectIdsToTry);
    
    for (const projectId of projectIdsToTry) {
      console.log(`\n📊 === TESTING PROJECT ID ${projectId} ===`);
      
      // Configuración de test
      const testCountryId = 1;
      const testSalary = 65000;
      const testYear = 2025;
      
      console.log('📋 Configuración:');
      console.log(`- Project ID: ${projectId}`);
      console.log(`- Country ID: ${testCountryId}`);
      console.log(`- Test Salary: ${testSalary}`);
      console.log(`- Test Year: ${testYear}`);
      
      // Obtener project profiles para este proyecto
      console.log(`\n🔍 Obteniendo project profiles para proyecto ${projectId}...`);
      const projectProfilesRes = await fetch(`/api/project-profiles/${projectId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📡 Response status: ${projectProfilesRes.status}`);
      
      if (!projectProfilesRes.ok) {
        console.log(`❌ Failed to get project profiles: ${projectProfilesRes.status}`);
        const errorText = await projectProfilesRes.text();
        console.log(`📋 Error details:`, errorText);
        continue; // Probar siguiente proyecto
      }
      
      const projectProfiles = await projectProfilesRes.json();
      console.log('📊 Project profiles response:', projectProfiles);
      
      if (!Array.isArray(projectProfiles)) {
        console.log('⚠️  Response is not an array:', typeof projectProfiles);
        continue;
      }
      
      if (projectProfiles.length === 0) {
        console.log(`⚠️  No project profiles found for project ${projectId}`);
        continue; // Probar siguiente proyecto
      }
      
      // ¡Encontramos un proyecto con profiles!
      console.log(`✅ Found ${projectProfiles.length} project profiles!`);
      const testProfile = projectProfiles[0];
      const projectProfileId = testProfile.project_profile_id;
      
      if (!projectProfileId) {
        console.log('❌ project_profile_id not found in:', testProfile);
        continue;
      }
      
      console.log(`✅ Using project_profile_id: ${projectProfileId}`);
      console.log(`✅ Profile details:`, testProfile);
      
      // Verificar salarios existentes
      console.log('\n🔍 Verificando salarios existentes...');
      const existingSalariesRes = await fetch(`/api/project-profile-salaries?project_profile_id=${projectProfileId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (!existingSalariesRes.ok) {
        console.log(`❌ Failed to get existing salaries: ${existingSalariesRes.status}`);
        const errorText = await existingSalariesRes.text();
        console.log(`📋 Error:`, errorText);
        continue;
      }
      
      const existingSalaries = await existingSalariesRes.json();
      console.log('✅ Existing salaries:', existingSalaries);
      
      // Test POST (crear nuevo salario)
      console.log('\n🆕 Testing POST (crear nuevo salario)...');
      const newSalaryData = {
        project_profile_id: projectProfileId,
        country_id: testCountryId,
        salary: testSalary,
        year: testYear
      };
      
      console.log('📤 Enviando:', newSalaryData);
      
      const createRes = await fetch('/api/project-profile-salaries', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSalaryData)
      });
      
      console.log(`📡 Create response status: ${createRes.status}`);
      
      if (createRes.ok) {
        const created = await createRes.json();
        console.log('✅ Salary created successfully:', created);
        console.log(`\n🎉 SUCCESS! Project profile salaries are working for project ${projectId}`);
        return; // Éxito, salir del loop
      } else {
        const createError = await createRes.text();
        console.log('❌ Error creating salary:', createRes.status, createError);
        
        // Mostrar detalles del error
        try {
          const errorJson = JSON.parse(createError);
          console.log('📋 Error details:', errorJson);
        } catch (e) {
          console.log('📋 Raw error:', createError);
        }
      }
    }
    
    console.log('\n❌ No se pudo encontrar un proyecto válido con project profiles');
    console.log('💡 Ejecuta el script debug-project-profiles.sql para crear datos de prueba');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar test automático
autoTestFlow();

console.log(`
📖 Instrucciones:
1. Este test busca automáticamente proyectos válidos
2. Si no encuentra datos, ejecuta debug-project-profiles.sql en pgAdmin
3. Observa el Network tab para ver requests HTTP
4. Los errores específicos se muestran en la consola
`);