// Script para actualizar URLs del frontend a la versión con autenticación
// Este archivo contiene todas las URLs que necesitan ser actualizadas

const urlUpdates = [
  // Profiles.tsx
  { 
    old: 'fetch(`/project-profiles/${currentProjectId}`)',
    new: 'fetch(`http://localhost:4000/api/project-profiles/${currentProjectId}`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/profiles/${editingProfile.id}`, {',
    new: 'fetch(`http://localhost:4000/api/profiles/${editingProfile.id}`, { credentials: \'include\','
  },
  {
    old: 'fetch(`/project-profile-salaries?project_profile_id=${pp.project_profile_id}`)',
    new: 'fetch(`http://localhost:4000/api/project-profile-salaries?project_profile_id=${pp.project_profile_id}`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/project-profile-salaries/${id}`, {',
    new: 'fetch(`http://localhost:4000/api/project-profile-salaries/${id}`, { credentials: \'include\','
  },
  {
    old: 'fetch(`/project-profile-salaries`, {',
    new: 'fetch(`http://localhost:4000/api/project-profile-salaries`, { credentials: \'include\','
  },
  {
    old: 'fetch(`/project-profiles/${officialProfile.id}/salaries`)',
    new: 'fetch(`http://localhost:4000/api/project-profiles/${officialProfile.id}/salaries`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/projects/${projectId}/countries-cpi`)',
    new: 'fetch(`http://localhost:4000/api/projects/${projectId}/countries-cpi`, { credentials: \'include\' })'
  },

  // App.tsx
  {
    old: 'fetch(`/project-profiles/${pid}`)',
    new: 'fetch(`http://localhost:4000/api/project-profiles/${pid}`, { credentials: \'include\' })'
  },

  // Menu.tsx
  {
    old: 'fetch(`/projects/${quote.id}`, { method: \'DELETE\' })',
    new: 'fetch(`http://localhost:4000/api/projects/${quote.id}`, { method: \'DELETE\', credentials: \'include\' })'
  },

  // nonOperationalCosts.ts
  {
    old: 'fetch(`/projects/${projectId}/non-operational-costs`, {',
    new: 'fetch(`http://localhost:4000/api/projects/${projectId}/non-operational-costs`, { credentials: \'include\','
  },
  {
    old: 'fetch(`/projects/${projectId}/non-operational-costs/${id}`, {',
    new: 'fetch(`http://localhost:4000/api/projects/${projectId}/non-operational-costs/${id}`, { credentials: \'include\','
  },
  {
    old: 'fetch(`/projects/${projectId}/non-operational-costs/${id}`, { method: \'DELETE\' })',
    new: 'fetch(`http://localhost:4000/api/projects/${projectId}/non-operational-costs/${id}`, { method: \'DELETE\', credentials: \'include\' })'
  },
  {
    old: 'fetch(`/projects/${projectId}/non-operational-costs/${id}`)',
    new: 'fetch(`http://localhost:4000/api/projects/${projectId}/non-operational-costs/${id}`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/projects/${projectId}/it-costs/recompute`, {',
    new: 'fetch(`http://localhost:4000/api/projects/${projectId}/it-costs/recompute`, { credentials: \'include\','
  },

  // SummaryDocument.tsx
  {
    old: 'fetch(`/projects/${projectId}/allocations/summary`)',
    new: 'fetch(`http://localhost:4000/api/projects/${projectId}/allocations/summary`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/projects/${projectId}/allocations`)',
    new: 'fetch(`http://localhost:4000/api/projects/${projectId}/allocations`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/projects/${effectiveProjectId}/operational-revenue`)',
    new: 'fetch(`http://localhost:4000/api/projects/${effectiveProjectId}/operational-revenue`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/projects/${effectiveProjectId}/hourly-price`)',
    new: 'fetch(`http://localhost:4000/api/projects/${effectiveProjectId}/hourly-price`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/projects/${effectiveProjectId}/deliverables-costs`)',
    new: 'fetch(`http://localhost:4000/api/projects/${effectiveProjectId}/deliverables-costs`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/projects/${effectiveProjectId}/deliverables-costs-breakdown`)',
    new: 'fetch(`http://localhost:4000/api/projects/${effectiveProjectId}/deliverables-costs-breakdown`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/projects/${effectiveProjectId}/customer-unit-prices`)',
    new: 'fetch(`http://localhost:4000/api/projects/${effectiveProjectId}/customer-unit-prices`, { credentials: \'include\' })'
  },
  {
    old: 'fetch(`/deliverables/${deliverable.id}/customer-unit-price`, {',
    new: 'fetch(`http://localhost:4000/api/deliverables/${deliverable.id}/customer-unit-price`, { credentials: \'include\','
  }
];

export default urlUpdates;