import { NonOperationalCost, normalizeNonOperationalCost } from '../types/nonOperationalCost';

import { apiConfig } from '../utils/apiConfig';
const fetchConfig: RequestInit = { credentials: 'include' };

export async function fetchNonOperationalCosts(projectId: number, context?: string): Promise<NonOperationalCost[]> {
  const url = context
    ? `/api/projects/${projectId}/non-operational-costs?context=${context}&ts=${Date.now()}`
    : `/api/projects/${projectId}/non-operational-costs?ts=${Date.now()}`;
  const res = await fetch(apiConfig.url(url), fetchConfig);
  if (!res.ok) throw new Error('Error fetching non operational costs');
  const json = await res.json();
  return Array.isArray(json) ? json.map(normalizeNonOperationalCost) : [];
}

export async function createNonOperationalCost(projectId: number, data: Omit<NonOperationalCost, 'id' | 'project_id' | 'created_at' | 'updated_at' | 'subcontractorName' | 'unitCost'>): Promise<NonOperationalCost> {
  const res = await fetch(apiConfig.url(`/api/projects/${projectId}/non-operational-costs`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creating non operational cost');
  return normalizeNonOperationalCost(await res.json());
}

export async function updateNonOperationalCost(projectId: number, id: number, data: Partial<Omit<NonOperationalCost, 'id' | 'project_id'>>): Promise<NonOperationalCost> {
  const res = await fetch(apiConfig.url(`/api/projects/${projectId}/non-operational-costs/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating non operational cost');
  return normalizeNonOperationalCost(await res.json());
}

export async function deleteNonOperationalCost(projectId: number, id: number): Promise<void> {
  const res = await fetch(apiConfig.url(`/api/projects/${projectId}/non-operational-costs/${id}`), { 
    method: 'DELETE', 
    credentials: 'include' 
  });
  if (!res.ok) throw new Error('Error deleting non operational cost');
}

export async function fetchNonOperationalCostById(projectId: number, id: number): Promise<NonOperationalCost> {
  const res = await fetch(apiConfig.url(`/api/projects/${projectId}/non-operational-costs/${id}`), fetchConfig);
  if (!res.ok) throw new Error('Error fetching non operational cost');
  return normalizeNonOperationalCost(await res.json());
}

export async function recomputeItCosts(projectId: number, year: number): Promise<void> {
  const res = await fetch(apiConfig.url(`/api/projects/${projectId}/it-costs/recompute`), {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    credentials: 'include',
    body: JSON.stringify({ year })
  });
  if (!res.ok) throw new Error('Error recomputing IT costs');
}
