#!/usr/bin/env node

// Test script para verificar la funcionalidad de project_profile_salaries
const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

async function testProjectProfileSalaries() {
  try {
    console.log('🔍 Testing project profile salaries functionality...\n');

    // 1. Obtener project profiles de un proyecto de ejemplo
    console.log('1. Getting project profiles for project 1...');
    const projectProfilesRes = await axios.get(`${BASE_URL}/project-profiles/1`, {
      headers: { 'Cookie': 'session=test' } // Placeholder for auth
    });
    
    const projectProfiles = projectProfilesRes.data;
    console.log('Project profiles found:', projectProfiles.length);
    
    if (projectProfiles.length === 0) {
      console.log('❌ No project profiles found. Creating test data might be needed.');
      return;
    }

    const testProjectProfile = projectProfiles[0];
    console.log(`Testing with project_profile_id: ${testProjectProfile.project_profile_id}`);

    // 2. Intentar obtener salarios existentes
    console.log('\n2. Getting existing salaries...');
    const salariesRes = await axios.get(`${BASE_URL}/project-profile-salaries`, {
      params: { project_profile_id: testProjectProfile.project_profile_id },
      headers: { 'Cookie': 'session=test' }
    });
    
    console.log('Existing salaries:', salariesRes.data);

    // 3. Intentar crear un nuevo salario
    console.log('\n3. Creating new salary...');
    const newSalary = {
      project_profile_id: testProjectProfile.project_profile_id,
      country_id: 1,
      salary: 50000,
      year: 2025
    };

    const createRes = await axios.post(`${BASE_URL}/project-profile-salaries`, newSalary, {
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': 'session=test'
      }
    });

    console.log('Created salary:', createRes.data);
    console.log('✅ Project profile salaries functionality appears to be working!');

  } catch (error) {
    console.error('❌ Error testing project profile salaries:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Si no hay axios, sugerir instalación
if (typeof require === 'undefined') {
  console.log('Please install axios: npm install axios');
} else {
  try {
    require('axios');
    testProjectProfileSalaries();
  } catch (e) {
    console.log('Please install axios: npm install axios');
  }
}