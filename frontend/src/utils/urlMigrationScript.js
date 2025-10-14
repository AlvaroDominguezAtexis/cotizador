// Script para migrar URLs hardcodeadas a apiConfig
// Este archivo no es parte del código de producción, solo para migración

const urlReplacements = [
  // Reemplazos básicos
  { 
    from: `fetch('http://localhost:4000/api/profiles'`, 
    to: `fetch(apiConfig.url('/api/profiles')`
  },
  { 
    from: `fetch('http://localhost:4000/api/project-profiles'`, 
    to: `fetch(apiConfig.url('/api/project-profiles')`
  },
  { 
    from: `fetch('http://localhost:4000/api/project-profiles/switch'`, 
    to: `fetch(apiConfig.url('/api/project-profiles/switch')`
  },
  // Reemplazos con parámetros
  { 
    from: `fetch(\`http://localhost:4000/api/projects/\${projectId}\``, 
    to: `fetch(apiConfig.url(\`/api/projects/\${projectId}\`)`
  },
  { 
    from: `fetch(\`http://localhost:4000/api/project-profiles/\${`, 
    to: `fetch(apiConfig.url(\`/api/project-profiles/\${`
  },
  { 
    from: `fetch(\`http://localhost:4000/api/profiles/\${`, 
    to: `fetch(apiConfig.url(\`/api/profiles/\${`
  },
  // Headers
  { 
    from: `headers: { 'Content-Type': 'application/json' }, credentials: 'include'`, 
    to: `...apiConfig.defaultOptions`
  },
  { 
    from: `credentials: 'include'`, 
    to: `...apiConfig.defaultOptions`
  }
];

console.log('URLs que necesitan ser migradas manualmente en Profiles.tsx:');
urlReplacements.forEach((replacement, index) => {
  console.log(`${index + 1}. Buscar: ${replacement.from}`);
  console.log(`   Reemplazar por: ${replacement.to}`);
  console.log('');
});