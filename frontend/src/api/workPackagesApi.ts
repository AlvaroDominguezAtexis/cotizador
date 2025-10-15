import { WorkPackage } from '../types/workPackages';
import { apiConfig } from '../utils/apiConfig';

export interface WorkPackagePayload {
  codigo: string;
  nombre: string;
}

export const fetchWorkPackages = async (projectId: number): Promise<WorkPackage[]> => {
  const res = await apiConfig.fetch(`/api/projects/${projectId}/workpackages`);
  if (!res.ok) throw new Error('Error fetching workpackages');
  const data = await res.json();
  // Adapt backend fields (codigo -> code, nombre -> name, dm -> DM, deliverables empty for now)
  return data.map((wp: any) => ({
    id: wp.id,
    code: wp.codigo,
    name: wp.nombre,
  // workpackage-level numeric dm was removed from backend; keep DM (name) if provided
  DM: wp.DM?.toString?.() ?? wp.dm?.toString?.() ?? '',
    deliverables: [],
  }));
};

export const createWorkPackageApi = async (projectId: number, payload: WorkPackagePayload): Promise<WorkPackage> => {
  const res = await apiConfig.fetch(`/api/projects/${projectId}/workpackages`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Error creando workpackage');
  const wp = await res.json();
  return { id: wp.id, code: wp.codigo, name: wp.nombre, DM: wp.DM?.toString?.() ?? wp.dm?.toString?.() ?? '', deliverables: [] };
};

export const updateWorkPackageApi = async (projectId: number, id: number, payload: Partial<WorkPackagePayload>): Promise<WorkPackage> => {
  const res = await apiConfig.fetch(`/api/projects/${projectId}/workpackages/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Error actualizando workpackage');
  const wp = await res.json();
  return { id: wp.id, code: wp.codigo, name: wp.nombre, DM: wp.DM?.toString?.() ?? wp.dm?.toString?.() ?? '', deliverables: [] };
};

export const deleteWorkPackageApi = async (projectId: number, id: number): Promise<void> => {
  const res = await apiConfig.fetch(`/api/projects/${projectId}/workpackages/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error eliminando workpackage');
};
