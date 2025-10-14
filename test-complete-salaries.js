// Test completo del flujo de project profile salaries
// Pegar en la consola del navegador en la página de perfiles

console.log('🚀 Testing COMPLETE project profile salaries flow...\n');

async function testCompleteFlow() {
  try {
    // 1. Configuración de test
    const projectId = 1; // Cambiar por un ID válido
    const testCountryId = 1;
    const testSalary = 65000;
    const testYear = 2025;
    
    console.log('📋 Configuración de test:');
    console.log(`- Project ID: ${projectId}`);
    console.log(`- Country ID: ${testCountryId}`);
    console.log(`- Test Salary: ${testSalary}`);
    console.log(`- Test Year: ${testYear}`);
    
    // 2. Obtener project profiles
    console.log('\n🔍 Step 1: Obteniendo project profiles...');
    const projectProfilesRes = await fetch(`/api/project-profiles/${projectId}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!projectProfilesRes.ok) {
      throw new Error(`Failed to get project profiles: ${projectProfilesRes.status}`);
    }
    
    const projectProfiles = await projectProfilesRes.json();
    console.log('✅ Project profiles:', projectProfiles);
    
    if (projectProfiles.length === 0) {
      console.log('❌ No project profiles found. Create some first.');
      return;
    }
    
    const testProfile = projectProfiles[0];
    const projectProfileId = testProfile.project_profile_id;
    
    if (!projectProfileId) {
      console.log('❌ project_profile_id not found in:', testProfile);
      return;
    }
    
    console.log(`✅ Using project_profile_id: ${projectProfileId}`);
    
    // 3. Verificar salarios existentes
    console.log('\n🔍 Step 2: Verificando salarios existentes...');
    const existingSalariesRes = await fetch(`/api/project-profile-salaries?project_profile_id=${projectProfileId}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!existingSalariesRes.ok) {
      throw new Error(`Failed to get existing salaries: ${existingSalariesRes.status}`);
    }
    
    const existingSalaries = await existingSalariesRes.json();
    console.log('✅ Existing salaries:', existingSalaries);
    
    // 4. Test POST (crear nuevo salario)
    console.log('\n🆕 Step 3: Testing POST (crear nuevo salario)...');
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
    
    if (createRes.ok) {
      const created = await createRes.json();
      console.log('✅ Salary created successfully:', created);
      
      // 5. Test PUT (actualizar salario)
      console.log('\n📝 Step 4: Testing PUT (actualizar salario)...');
      const updatedSalary = testSalary + 5000;
      const updateData = {
        project_profile_id: projectProfileId,
        country_id: testCountryId,
        salary: updatedSalary,
        year: testYear
      };
      
      console.log('📤 Actualizando a:', updatedSalary);
      
      const updateRes = await fetch(`/api/project-profile-salaries/${created.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (updateRes.ok) {
        const updated = await updateRes.json();
        console.log('✅ Salary updated successfully:', updated);
      } else {
        const updateError = await updateRes.text();
        console.log('❌ Error updating salary:', updateRes.status, updateError);
      }
      
      // 6. Verificar cambios finales
      console.log('\n🔍 Step 5: Verificando cambios finales...');
      const finalSalariesRes = await fetch(`/api/project-profile-salaries?project_profile_id=${projectProfileId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (finalSalariesRes.ok) {
        const finalSalaries = await finalSalariesRes.json();
        console.log('✅ Final salaries:', finalSalaries);
        console.log('\n🎉 TEST COMPLETADO EXITOSAMENTE!');
      }
      
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
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Ejecutar test
testCompleteFlow();

console.log(`
📖 Instrucciones:
1. Asegúrate de estar logueado
2. Ve al Network tab en Developer Tools
3. Observa las requests HTTP que se hacen
4. Si hay errores, comparte los detalles específicos
5. Verifica que los datos se guarden en la base de datos
`);