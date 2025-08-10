import { useCallback, useEffect, useState } from 'react';
import { WorkPackage } from '../types/workPackages';
import { fetchWorkPackages, createWorkPackageApi, updateWorkPackageApi, deleteWorkPackageApi, WorkPackagePayload } from '../api/workPackagesApi';

export const useWorkPackages = (projectId: number | null) => {
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true); setError(null);
    try {
      const data = await fetchWorkPackages(projectId);
      setWorkPackages(data);
    } catch (e: any) {
      setError(e.message || 'Error');
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const createWP = useCallback(async (payload: WorkPackagePayload) => {
    if (!projectId) return;
    const wp = await createWorkPackageApi(projectId, payload);
    setWorkPackages(prev => [wp, ...prev]);
  }, [projectId]);

  const updateWP = useCallback(async (id: number, payload: Partial<WorkPackagePayload>) => {
    if (!projectId) return;
    const wp = await updateWorkPackageApi(projectId, id, payload);
    setWorkPackages(prev => prev.map(p => p.id === id ? wp : p));
  }, [projectId]);

  const deleteWP = useCallback(async (id: number) => {
    if (!projectId) return;
    await deleteWorkPackageApi(projectId, id);
    setWorkPackages(prev => prev.filter(p => p.id !== id));
  }, [projectId]);

  return { workPackages, loading, error, reload: load, createWP, updateWP, deleteWP };
};

export default useWorkPackages;
