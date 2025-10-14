// Test detallado para debugging del guardado de salarios
// Pegar en la consola del navegador en la página de perfiles

console.log('🔍 DEBUGGING salary save process...\n');

async function debugSalarySave() {
  try {
    // 1. Obtener el projectId actual de la página
    let projectId = 1; // Default
    
    // Intentar obtener el projectId de la URL o del contexto
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get('projectId') || urlParams.get('id');
    if (urlProjectId) {
      projectId = parseInt(urlProjectId, 10);
      console.log(`📍 Project ID from URL: ${projectId}`);
    }
    
    console.log(`🎯 Using Project ID: ${projectId}`);
    
    // 2. Verificar que estemos en la página correcta
    console.log(`📄 Current URL: ${window.location.href}`);
    console.log(`📄 Page title: ${document.title}`);
    
    // 3. Obtener project profiles
    console.log('\n📊 Step 1: Getting project profiles...');
    const projectProfilesRes = await fetch(`/api/project-profiles/${projectId}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 Project profiles response: ${projectProfilesRes.status}`);
    
    if (!projectProfilesRes.ok) {
      const errorText = await projectProfilesRes.text();
      console.log(`❌ Failed to get project profiles: ${errorText}`);
      return;
    }
    
    const projectProfiles = await projectProfilesRes.json();
    console.log(`✅ Project profiles (${projectProfiles.length}):`, projectProfiles);
    
    if (projectProfiles.length === 0) {
      console.log('❌ No project profiles found - cannot test salary save');
      return;
    }
    
    const testProfile = projectProfiles[0];
    const projectProfileId = testProfile.project_profile_id;
    console.log(`🎯 Using project_profile_id: ${projectProfileId}`);
    console.log(`🎯 Profile details:`, testProfile);
    
    // 4. Verificar salarios existentes ANTES
    console.log('\n📊 Step 2: Getting existing salaries...');
    const existingSalariesRes = await fetch(`/api/project-profile-salaries?project_profile_id=${projectProfileId}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 Existing salaries response: ${existingSalariesRes.status}`);
    
    if (!existingSalariesRes.ok) {
      const errorText = await existingSalariesRes.text();
      console.log(`❌ Failed to get existing salaries: ${errorText}`);
      return;
    }
    
    const existingSalaries = await existingSalariesRes.json();
    console.log(`✅ Existing salaries (${existingSalaries.length}):`, existingSalaries);
    
    // 5. Intentar crear un nuevo salario
    console.log('\n🆕 Step 3: Testing salary creation...');
    const testSalaryData = {
      project_profile_id: projectProfileId,
      country_id: 1, // Asumimos que país 1 existe
      salary: 75000,
      year: 2025
    };
    
    console.log(`📤 Sending POST data:`, testSalaryData);
    
    const createRes = await fetch('/api/project-profile-salaries', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testSalaryData)
    });
    
    console.log(`📡 Create response status: ${createRes.status}`);
    console.log(`📡 Create response headers:`, Object.fromEntries(createRes.headers.entries()));
    
    if (createRes.ok) {
      const created = await createRes.json();
      console.log(`✅ Salary created:`, created);
      
      // 6. Verificar que se guardó en la DB
      console.log('\n🔍 Step 4: Verifying save in database...');
      const verifySalariesRes = await fetch(`/api/project-profile-salaries?project_profile_id=${projectProfileId}&ts=${Date.now()}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (verifySalariesRes.ok) {
        const verifiedSalaries = await verifySalariesRes.json();
        console.log(`✅ Verified salaries after creation (${verifiedSalaries.length}):`, verifiedSalaries);
        
        const newSalary = verifiedSalaries.find(s => s.salary == testSalaryData.salary && s.country_id == testSalaryData.country_id);
        if (newSalary) {
          console.log(`🎉 SUCCESS! New salary found in database:`, newSalary);
          
          // 7. Test update
          console.log('\n📝 Step 5: Testing salary update...');
          const updatedSalaryValue = 80000;
          const updateData = {
            project_profile_id: projectProfileId,
            country_id: testSalaryData.country_id,
            salary: updatedSalaryValue,
            year: testSalaryData.year
          };
          
          console.log(`📤 Sending PUT data:`, updateData);
          
          const updateRes = await fetch(`/api/project-profile-salaries/${newSalary.id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
          });
          
          console.log(`📡 Update response status: ${updateRes.status}`);
          
          if (updateRes.ok) {
            const updated = await updateRes.json();
            console.log(`✅ Salary updated:`, updated);
            console.log(`🎉 COMPLETE SUCCESS! Both create and update work!`);
          } else {
            const updateError = await updateRes.text();
            console.log(`❌ Update failed:`, updateError);
          }
          
        } else {
          console.log(`❌ New salary NOT found in database after creation!`);
          console.log(`🔍 Expected: salary=${testSalaryData.salary}, country_id=${testSalaryData.country_id}`);
          console.log(`🔍 Got salaries:`, verifiedSalaries);
        }
      }
      
    } else {
      const createError = await createRes.text();
      console.log(`❌ Create failed: ${createRes.status} - ${createError}`);
      
      try {
        const errorJson = JSON.parse(createError);
        console.log(`📋 Error details:`, errorJson);
      } catch (e) {
        console.log(`📋 Raw error text:`, createError);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar test
debugSalarySave();

console.log(`
📖 Este test:
1. Obtiene project profiles disponibles
2. Verifica salarios existentes
3. Intenta crear un nuevo salario
4. Verifica que se guardó en la DB
5. Intenta actualizar el salario
6. Muestra logs detallados de cada paso

🎯 Observa la consola del backend para ver los logs del servidor
📡 Observa el Network tab para ver todas las requests HTTP
`);