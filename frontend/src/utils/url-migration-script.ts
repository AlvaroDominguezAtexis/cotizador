// Script para actualizar todas las URLs del frontend a versión autenticada
// Este archivo contiene todas las transformaciones necesarias

const BASE_URL = 'http://localhost:4000/api';
const CREDENTIALS = "{ credentials: 'include' }";

// Lista de todas las URLs que necesitan ser actualizadas
const urlUpdates = [
  // SummaryDocument.tsx
  {
    file: 'frontend/src/components/summary/SummaryDocument.tsx',
    replacements: [
      {
        from: "fetch(`/projects/${effectiveProjectId}/operational-revenue`)",
        to: `fetch(\`${BASE_URL}/projects/\${effectiveProjectId}/operational-revenue\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${effectiveProjectId}/hourly-price`)",
        to: `fetch(\`${BASE_URL}/projects/\${effectiveProjectId}/hourly-price\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${effectiveProjectId}/deliverables-costs`)",
        to: `fetch(\`${BASE_URL}/projects/\${effectiveProjectId}/deliverables-costs\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${effectiveProjectId}/deliverables-costs-breakdown`)",
        to: `fetch(\`${BASE_URL}/projects/\${effectiveProjectId}/deliverables-costs-breakdown\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${effectiveProjectId}/customer-unit-prices`)",
        to: `fetch(\`${BASE_URL}/projects/\${effectiveProjectId}/customer-unit-prices\`, ${CREDENTIALS})`
      }
    ]
  },
  // AdvanceSettingsTab.tsx
  {
    file: 'frontend/src/components/tabs/AdvanceSettingsTab.tsx',
    replacements: [
      {
        from: "fetch(`/projects/${projectId}/countries-cpi`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-cpi\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${projectId}/countries-activity-rate`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-activity-rate\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${projectId}/countries-npt-rate`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-npt-rate\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${projectId}/countries-it-cost`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-it-cost\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${projectId}/countries-premises-rate`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-premises-rate\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${projectId}/countries-holidays`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-holidays\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${projectId}/countries-total-days`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-total-days\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${projectId}/countries-working-days`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-working-days\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${projectId}/countries-hours-per-day`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-hours-per-day\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${projectId}/countries-markup`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-markup\`, ${CREDENTIALS})`
      },
      {
        from: "fetch(`/projects/${projectId}/countries-social-contribution-rate`)",
        to: `fetch(\`${BASE_URL}/projects/\${projectId}/countries-social-contribution-rate\`, ${CREDENTIALS})`
      }
    ]
  }
];

console.log('URLs que necesitan actualización:', urlUpdates.length);
export default urlUpdates;