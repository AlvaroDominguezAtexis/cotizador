// Test simple de POST para project profile salaries
// Pegar en la consola del navegador

console.log('🧪 Testing SIMPLE POST for project profile salaries...\n');

async function testSimplePOST() {
  try {
    console.log('📍 Step 1: Getting project profiles...');
    
    // Usar el project_profile_id que sabemos que funciona (174)
    const knownProjectProfileId = 174;
    
    console.log(`🎯 Using known project_profile_id: ${knownProjectProfileId}`);
    
    // Test data
    const testData = {
      project_profile_id: knownProjectProfileId,
      country_id: 1,
      salary: 99999,
      year: 2025
    };
    
    console.log('📤 Sending POST request...');
    console.log('📤 URL:', '/api/project-profile-salaries');
    console.log('📤 Data:', testData);
    
    const response = await fetch('/api/project-profile-salaries', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    console.log(`📡 Response status: ${response.status}`);
    console.log(`📡 Response ok: ${response.ok}`);
    console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ POST Success:', result);
      
      // Verificar que se guardó
      console.log('🔍 Verifying save...');
      const verifyRes = await fetch(`/api/project-profile-salaries?project_profile_id=${knownProjectProfileId}&ts=${Date.now()}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (verifyRes.ok) {
        const allSalaries = await verifyRes.json();
        console.log('📊 All salaries after POST:', allSalaries);
        
        const newSalary = allSalaries.find(s => s.salary == testData.salary);
        if (newSalary) {
          console.log('🎉 SUCCESS! New salary found in database:', newSalary);
        } else {
          console.log('❌ New salary NOT found in database');
        }
      }
      
    } else {
      const errorText = await response.text();
      console.log('❌ POST Failed:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.log('📋 Error details:', errorJson);
      } catch (e) {
        console.log('📋 Raw error:', errorText);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run test
testSimplePOST();

console.log(`
📖 Este test:
1. Hace un POST simple con datos conocidos
2. Verifica si llega al backend (mira logs del servidor)
3. Verifica si se guarda en la DB
4. Muestra errores específicos si falla

🎯 Mira los logs del backend para ver si aparecen:
- 🔥 SALARY ROUTE - POST 
- 🔹 POST /project-profile-salaries - Received:
`);