// hooks/useProject.ts
import { useState, useCallback } from 'react';
import { ProjectData} from '../types/project';
import { WorkPackage} from '../types/workPackages';
import { Profile } from '../types/profile';
import { License } from '../types/license';
import { NonOperationalCost } from '../types/nonOperationalCost';

export const useProject = () => {
  // Estados para diferentes aspectos del proyecto
  const [projectData, setProjectData] = useState<ProjectData>({
    title: '',
    crmCode: '',
    client: '',
    activity: '',
    startDate: '',
    endDate: '',
    businessManager: '',
    businessUnit: '',
    buLine: '',
    opsDomain: '',
    country: '',
    iqp: 1,
  marginType: '',
  marginGoal: '',
    segmentation: 'New Business'
  });

  // Colecciones de datos
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [nonOperationalCosts, setNonOperationalCosts] = useState<NonOperationalCost[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);

  // Métodos para actualizar datos del proyecto
  const updateProjectData = useCallback((newData: Partial<ProjectData>) => {
    setProjectData(prev => ({ ...prev, ...newData }));
  }, []);

  // Métodos para Work Packages
  const addWorkPackage = useCallback((workPackage: WorkPackage) => {
    setWorkPackages(prev => [...prev, workPackage]);
  }, []);

  const updateWorkPackage = useCallback((id: number, updates: Partial<Omit<WorkPackage, 'id'>>) => {
    setWorkPackages(prev => 
      prev.map(wp => wp.id === id ? { ...wp, ...updates } : wp)
    );
  }, []);

  const deleteWorkPackage = useCallback((id: number) => {
    setWorkPackages(prev => prev.filter(wp => wp.id !== id));
  }, []);

  // Métodos para Perfiles
  const addProfile = useCallback((profile: Profile) => {
  console.log('Añadiendo perfil en useProject:', profile);
  setProfiles(prev => {
    const newProfiles = [...prev, profile];
    console.log('Perfiles después de añadir:', newProfiles);
    return newProfiles;
  });
}, []);

const updateProfile = (originalProfile: Profile, updatedProfile: Profile) => {
  // Actualiza sin devolver directamente el array
  setProfiles(currentProfiles => 
    currentProfiles.map(profile => 
      profile.id === originalProfile.id ? updatedProfile : profile
    )
  );
};

  const deleteProfile = useCallback((id: number) => {
    setProfiles(prev => prev.filter(profile => profile.id !== id));
  }, []);

  // Métodos para Licencias
  const addLicense = useCallback((license: License) => {
    setLicenses(prev => [...prev, license]);
  }, []);

  const updateLicense = useCallback((id: number, updates: Partial<Omit<License, 'id'>>) => {
    setLicenses(prev => 
      prev.map(license => 
        license.id === id 
          ? { ...license, ...updates } 
          : license
      )
    );
  }, []);

  const deleteLicense = useCallback((id: number) => {
    setLicenses(prev => prev.filter(license => license.id !== id));
  }, []);

  //Método para Costes no Operacionales
  const addNonOperationalCost = useCallback((cost: NonOperationalCost) => {
    setNonOperationalCosts(prev => [...prev, cost]);
  }, []);

  const updateNonOperationalCost = useCallback((id: number, updates: Partial<NonOperationalCost>) => {
    setNonOperationalCosts(prev => 
      prev.map(cost => cost.id === id ? { ...cost, ...updates } : cost)
    );
  }, []);

  const deleteNonOperationalCost = useCallback((id: number) => {
    setNonOperationalCosts(prev => prev.filter(cost => cost.id !== id));
  }, []);

   const importNonOperationalCosts = useCallback((costs: NonOperationalCost[]) => {
      // Reemplazar todos los costes existentes
      setNonOperationalCosts(costs);
    }, []);

    // Método para obtener años del proyecto
    const getProjectYears = useCallback(() => {
      if (!projectData.startDate || !projectData.endDate) return [];

      const startYear = new Date(projectData.startDate).getFullYear();
      const endYear = new Date(projectData.endDate).getFullYear();
      
      if (startYear === endYear) return [];
      
      return Array.from(
        { length: endYear - startYear + 1 }, 
        (_, i) => startYear + i
      );
    }, [projectData.startDate, projectData.endDate]);


    // Método para reiniciar todo el proyecto
  const resetProject = useCallback(() => {
    setProjectData({
      title: '',
      crmCode: '',
      client: '',
      activity: '',
      startDate: '',
      endDate: '',
      businessManager: '',
      businessUnit: '',
      buLine: '',
      opsDomain: '',
      country: '',
      iqp: 1,
  marginType: '',
  marginGoal: '',
      segmentation: 'New Business'
    });
    setWorkPackages([]);
    setProfiles([]);
    setLicenses([]);
    setNonOperationalCosts([]);
  }, []);

  // Método para añadir cliente
  const addClient = useCallback((client: string) => {
    // Validar que no esté vacío y no exista ya
    if (client.trim() && !clients.includes(client)) {
      setClients(prev => [...prev, client.trim()]);
      return client;
    }
    return null;
  }, [clients]);

  // Método para añadir actividad
  const addActivity = useCallback((activity: string) => {
    // Validar que no esté vacía y no exista ya
    if (activity.trim() && !activities.includes(activity)) {
      setActivities(prev => [...prev, activity.trim()]);
      return activity;
    }
    return null;
  }, [activities]);

  // Retornar todos los estados y métodos
  return {
    // Datos principales
    projectData,
    updateProjectData,

    // Work Packages
    workPackages,
    addWorkPackage,
    updateWorkPackage,
    deleteWorkPackage,

    // Perfiles
    profiles,
    addProfile,
    updateProfile,
    deleteProfile,

    // Licencias
    licenses,
    addLicense,
    updateLicense,
    deleteLicense,

    // Costes
    nonOperationalCosts,
    addNonOperationalCost,
    updateNonOperationalCost,
    deleteNonOperationalCost,
    importNonOperationalCosts,

    clients,
    activities,
    addClient,
    addActivity,

    // Método de reinicio
    resetProject,

    // Obtener años del proyecto
    getProjectYears
  };
};