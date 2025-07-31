// hooks/useProject.ts
import { useState, useCallback } from 'react';
import { ProjectData} from '../types/project';
import { WorkPackage} from '../types/workPackages';
import { Profile } from '../types/profile';
import { License } from '../types/license';
import { 
  TravelCost, 
  SubcontractCost, 
  ITCost, 
  OtherCost 
} from '../types/costs';

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
    scope: 'local',
    iqp: 1,
    segmentation: 'New Business'
  });

  // Colecciones de datos
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [travelCosts, setTravelCosts] = useState<TravelCost[]>([]);
  const [subcontractCosts, setSubcontractCosts] = useState<SubcontractCost[]>([]);
  const [itCosts, setITCosts] = useState<ITCost[]>([]);
  const [otherCosts, setOtherCosts] = useState<OtherCost[]>([]);
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

  // Métodos para Costes de Viaje
  const addTravelCost = useCallback((cost: TravelCost) => {
    setTravelCosts(prev => [...prev, cost]);
  }, []);

  const updateTravelCost = useCallback((id: number, updates: Partial<Omit<TravelCost, 'id'>>) => {
    setTravelCosts(prev => 
      prev.map(cost => cost.id === id ? { ...cost, ...updates } : cost)
    );
  }, []);

  const deleteTravelCost = useCallback((id: number) => {
    setTravelCosts(prev => prev.filter(cost => cost.id !== id));
  }, []);

  // Métodos para Costes de Subcontrata
  const addSubcontractCost = useCallback((cost: SubcontractCost) => {
    setSubcontractCosts(prev => [...prev, cost]);
  }, []);

  const updateSubcontractCost = useCallback((id: number, updates: Partial<Omit<SubcontractCost, 'id'>>) => {
    setSubcontractCosts(prev => 
      prev.map(cost => cost.id === id ? { ...cost, ...updates } : cost)
    );
  }, []);

  const deleteSubcontractCost = useCallback((id: number) => {
    setSubcontractCosts(prev => prev.filter(cost => cost.id !== id));
  }, []);

  // Métodos para Costes de IT
  const addITCost = useCallback((cost: ITCost) => {
    setITCosts(prev => [...prev, cost]);
  }, []);

  const updateITCost = useCallback((id: number, updates: Partial<Omit<ITCost, 'id'>>) => {
    setITCosts(prev => 
      prev.map(cost => cost.id === id ? { ...cost, ...updates } : cost)
    );
  }, []);

  const deleteITCost = useCallback((id: number) => {
    setITCosts(prev => prev.filter(cost => cost.id !== id));
  }, []);

  // Métodos para Otros Costes
  const addOtherCost = useCallback((cost: OtherCost) => {
    setOtherCosts(prev => [...prev, cost]);
  }, []);

  const updateOtherCost = useCallback((id: number, updates: Partial<Omit<OtherCost, 'id'>>) => {
    setOtherCosts(prev => 
      prev.map(cost => cost.id === id ? { ...cost, ...updates } : cost)
    );
  }, []);

  const deleteOtherCost = useCallback((id: number) => {
    setOtherCosts(prev => prev.filter(cost => cost.id !== id));
  }, []);

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
      scope: 'local',
      iqp: 1,
      segmentation: 'New Business'
    });
    setWorkPackages([]);
    setProfiles([]);
    setLicenses([]);
    setTravelCosts([]);
    setSubcontractCosts([]);
    setITCosts([]);
    setOtherCosts([]);
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

    // Costes de Viaje
    travelCosts,
    addTravelCost,
    updateTravelCost,
    deleteTravelCost,

    // Costes de Subcontrata
    subcontractCosts,
    addSubcontractCost,
    updateSubcontractCost,
    deleteSubcontractCost,

    // Costes de IT
    itCosts,
    addITCost,
    updateITCost,
    deleteITCost,

    // Otros Costes
    otherCosts,
    addOtherCost,
    updateOtherCost,
    deleteOtherCost,

    clients,
    activities,
    addClient,
    addActivity,

    // Método de reinicio
    resetProject
  };
};