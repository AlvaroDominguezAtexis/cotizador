import { WorkPackage } from '../types/workPackages';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export interface WorkPackagePayload {
  codigo: string;
  nombre: string;
  dm: number | string; // backend guarda NUMERIC, aquí podría ser string/number
}

export const fetchWorkPackages = async (projectId: number): Promise<WorkPackage[]> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages`);
  if (!res.ok) throw new Error('Error fetching workpackages');
  const data = await res.json();
  // Adapt backend fields (codigo -> code, nombre -> name, dm -> DM, deliverables empty for now)
  return data.map((wp: any) => ({
    id: wp.id,
    code: wp.codigo,
    name: wp.nombre,
    DM: wp.dm?.toString?.() ?? '',
    deliverables: [],
  }));
};

export const createWorkPackageApi = async (projectId: number, payload: WorkPackagePayload): Promise<WorkPackage> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Error creando workpackage');
  const wp = await res.json();
  return { id: wp.id, code: wp.codigo, name: wp.nombre, DM: wp.dm?.toString?.() ?? '', deliverables: [] };
};

export const updateWorkPackageApi = async (projectId: number, id: number, payload: Partial<WorkPackagePayload>): Promise<WorkPackage> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Error actualizando workpackage');
  const wp = await res.json();
  return { id: wp.id, code: wp.codigo, name: wp.nombre, DM: wp.dm?.toString?.() ?? '', deliverables: [] };
};

export const deleteWorkPackageApi = async (projectId: number, id: number): Promise<void> => {
  const res = await fetch(`${API_BASE}/projects/${projectId}/workpackages/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error eliminando workpackage');
};
