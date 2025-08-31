import { Deliverable } from '../types/workPackages';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export interface DeliverablePayload {
  codigo: string;
  nombre: string;
  // backend now stores numeric margin_goal for deliverables
  margin_goal: number | string;
  yearlyQuantities?: number[]; // index 0 => year 1
}

const mapFromBackend = (d: any): Deliverable => ({
  id: d.id,
  code: d.codigo,
  name: d.nombre,
  // dm numérico persistido en backend
  dm: typeof d.margin_goal === 'number' ? d.margin_goal : (d.margin_goal ? Number(d.margin_goal) : undefined),
  // DM (nombre) solo frontend si en algún momento se expone
  // keep any DM display name if provided by backend
  DM: d.DM || '',
  yearlyQuantities: d.yearlyQuantities || [],
  steps: [],
});

export const fetchDeliverables = async (projectId: number, workPackageId: number, yearCount?: number): Promise<Deliverable[]> => {
  let url = `${API_BASE}/projects/${projectId}/workpackages/${workPackageId}/deliverables`;
  if (yearCount) url += `?yearCount=${yearCount}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error fetching deliverables');
  const data = await res.json();
  return data.map(mapFromBackend);
};

export const createDeliverableApi = async (projectId: number, workPackageId: number, payload: DeliverablePayload): Promise<Deliverable> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages/${workPackageId}/deliverables`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) {
    if (res.status === 409) throw new Error('DUPLICATE_CODE');
    throw new Error('Error creando deliverable');
  }
  return mapFromBackend(await res.json());
};

export const updateDeliverableApi = async (projectId: number, workPackageId: number, id: number, payload: Partial<DeliverablePayload>): Promise<Deliverable> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages/${workPackageId}/deliverables/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!res.ok) {
    if (res.status === 409) throw new Error('DUPLICATE_CODE');
    throw new Error('Error actualizando deliverable');
  }
  return mapFromBackend(await res.json());
};

export const deleteDeliverableApi = async (projectId: number, workPackageId: number, id: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages/${workPackageId}/deliverables/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error eliminando deliverable');
};

export const recalcProjectMarginsYearlyApi = async (projectId: number) => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/recalc-margins-yearly`, { method: 'POST' });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Error recalculando deliverables yearly: ${res.status} ${txt}`);
  }
  return res.json();
};
