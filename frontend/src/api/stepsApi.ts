const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export interface StepPayload {
  profile_id: number;
  country_id: number;
  nombre: string;
  process_time: number;
  unit: string;
  office: boolean;
  mng: number;
}

export const fetchSteps = async (projectId: number, workPackageId: number, deliverableId: number) => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages/${workPackageId}/deliverables/${deliverableId}/steps`);
  if (!res.ok) throw new Error('Error fetching steps');
  return res.json();
};

export const createStepApi = async (projectId: number, workPackageId: number, deliverableId: number, payload: StepPayload) => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages/${workPackageId}/deliverables/${deliverableId}/steps`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (res.status === 409) throw new Error('DUPLICATE_STEP');
  if (!res.ok) throw new Error('Error creando step');
  return res.json();
};

export const updateStepApi = async (projectId: number, workPackageId: number, deliverableId: number, stepId: number, payload: Partial<StepPayload>) => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages/${workPackageId}/deliverables/${deliverableId}/steps/${stepId}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (res.status === 409) throw new Error('DUPLICATE_STEP');
  if (!res.ok) throw new Error('Error actualizando step');
  return res.json();
};

export const deleteStepApi = async (projectId: number, workPackageId: number, deliverableId: number, stepId: number) => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages/${workPackageId}/deliverables/${deliverableId}/steps/${stepId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error eliminando step');
  return true;
};
