import React, { useState, useEffect } from 'react';
import { LoginForm, useLoginForm } from './components/auth/LoginForm';
import { Layout } from './components/layout/Layout';
import { ProjectDataTab } from './components/tabs/ProjectDataTab';
import { ProjectData } from './types/project';
import { ProfilesTab } from './components/tabs/ProfilesTab';
import { WorkPackagesTab } from './components/tabs/WorkPackagesTab';
import { CostsTab } from './components/tabs/CostTab';
import { SummaryTab } from './components/tabs/SummaryTab';
import { TabName } from './types/common';
import { Menu } from './components/Menu';
import { TabNavigation } from './components/layout/TabNavigation';
import './App.css';

// 🔹 Función para mapear proyectos desde el backend
export const mapProjectFromBackend = (data: any): ProjectData => {
  const safeData = data || {};

  const safeFormatDate = (date: any): string => {
    if (!date) return '';
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    if (typeof date === 'string' && date.includes('T')) return date.split('T')[0];
    return '';
  };

  const mappedProject: any = {
    id: safeData.id,
    title: safeData.title ?? '',
    crmCode: safeData.crm_code ?? safeData.crmCode ?? '',
    client: safeData.client ?? '',
    activity: safeData.activity ?? '',
    startDate: safeFormatDate(safeData.start_date ?? safeData.startDate),
    endDate: safeFormatDate(safeData.end_date ?? safeData.endDate),
    businessManager: safeData.business_manager ?? safeData.businessManager ?? '',
    businessUnit: safeData.business_unit ?? safeData.businessUnit ?? '',
    opsDomain: safeData.ops_domain ?? safeData.opsDomain ?? '',
    country: safeData.country ?? '',
    scope: safeData.scope ?? '',
    additionalCountries:
      typeof safeData.additional_countries === 'string'
        ? JSON.parse(safeData.additional_countries)
        : (safeData.additional_countries ?? safeData.additionalCountries ?? []),
    iqp: safeData.iqp ?? '',
    segmentation: safeData.segmentation ?? '',
    description: safeData.description ?? '',
  };

  Object.keys(safeData).forEach(key => {
    const mappedKeys = [
      'title', 'crm_code', 'client', 'activity', 'start_date', 'end_date',
      'business_manager', 'business_unit', 'ops_domain', 'country', 'scope',
      'additional_countries', 'iqp', 'segmentation', 'description',
      'crmCode', 'startDate', 'endDate', 'businessManager', 'businessUnit',
      'opsDomain', 'additionalCountries'
    ];
    if (!mappedKeys.includes(key)) {
      console.warn(`Unmapped backend key: ${key}`);
      mappedProject[key] = safeData[key];
    }
  });

  return mappedProject;
};

interface ExtendedProjectData extends ProjectData {
  [key: string]: any;
}

// 🔹 Hook de autenticación
const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    const savedSession = localStorage.getItem('isLoggedIn');
    const savedUser = localStorage.getItem('user');
    if (savedSession === 'true' && savedUser) {
      setIsLoggedIn(true);
      setUser(savedUser);
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    if (username === 'admin' && password === 'admin') {
      setIsLoggedIn(true);
      setUser(username);
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('user', username);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUser(null);
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('user');
  };

  return { isLoggedIn, user, login, logout };
};


const App: React.FC = () => {

  const { isLoggedIn, user, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabName>('project-data');
  // Guarda el proyecto (sin salir necesariamente al menú)

  // Precargar perfiles del proyecto al abrir un proyecto existente
  
  const saveProjectData = async () => {
    if (!projectFormData) return;
    try {
      const backendData = mapToBackend(projectFormData, false);
      let response, responseText;
      if (!projectFormData.id) {
        response = await fetch('/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendData),
        });
        responseText = await response.text();
        if (!response.ok) throw new Error(responseText);
        const created = JSON.parse(responseText);
        const mappedProject = mapProjectFromBackend(created);
        setSelectedProject(mappedProject);
        setProjectFormData(mappedProject);
      } else {
        response = await fetch(`/projects/${projectFormData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendData),
        });
        responseText = await response.text();
        if (!response.ok) throw new Error(responseText);
        const updated = JSON.parse(responseText);
        const mappedProject = mapProjectFromBackend(updated);
        setSelectedProject(mappedProject);
        setProjectFormData(mappedProject);
      }
    } catch (error) {
      console.error('Full Error saving project:', error);
      alert(`No se pudo guardar el proyecto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Guardar y salir al menú
  const handleBackToMenu = async () => {
    await saveProjectData();
    setShowMainApp(false);
  };

  // Cambia de tab, guardando si se sale de 'project-data'
  const handleTabChange = async (tabName: TabName) => {
    if (activeTab === 'project-data' && tabName !== 'project-data') {
      await saveProjectData();
    }
    setActiveTab(tabName);
  };
  const { handleLogin, isLoading } = useLoginForm();
  const [showMainApp, setShowMainApp] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);

  const [projectFormData, setProjectFormData] = useState<ProjectData | null>(null);
  const [profilesData, setProfilesData] = useState<any[]>([]);
  const [workPackagesData, setWorkPackagesData] = useState<any[]>([]);
  const [costsData, setCostsData] = useState<any>({});

  const handleLoginSubmit = async (credentials: { username: string; password: string }): Promise<boolean> => {
    const success = await login(credentials.username, credentials.password);
    return success;
  };

  // 🔹 Devuelve la fecha tal cual, sin usar `new Date` para evitar desfases
  const formatDateLocal = (dateStr?: string) => {
    if (!dateStr) return null;
    return dateStr; // input type="date" ya entrega YYYY-MM-DD
  };

  // 🔹 Map hacia backend
  const mapToBackend = (data: ProjectData, isNew: boolean) => {
    const cleanData: any = {
      ...(data.id ? { id: data.id } : {}),
      title: data.title?.trim() || '',
      crm_code: data.crmCode?.trim() || '',
      client: data.client?.trim() || '',
      activity: data.activity?.trim() || '',
      start_date: formatDateLocal(data.startDate),
      end_date: formatDateLocal(data.endDate),
      business_manager: data.businessManager?.trim() || '',
      business_unit: data.businessUnit?.trim() || '',
      ops_domain: data.opsDomain?.trim() || '',
      country: data.country?.trim() || '',
      scope: data.scope?.trim() || '',
      additional_countries:
        data.additionalCountries && data.additionalCountries.length > 0
          ? JSON.stringify(Array.isArray(data.additionalCountries) ? data.additionalCountries : [data.additionalCountries])
          : JSON.stringify([]),
      iqp: data.iqp ? data.iqp.toString().trim() || '' : '',
      segmentation: data.segmentation?.trim() || '',
      description: data.description?.trim() || '',
    };
    console.log('Mapped Backend Data:', JSON.stringify(cleanData, null, 2));
    return cleanData;
  };
  useEffect(() => {
    if (activeTab !== 'profiles') return;
    const fetchProjectProfiles = async () => {
      if (projectFormData?.id) {
        try {
          const res = await fetch(`/project-profiles/${projectFormData.id}`);
          if (!res.ok) throw new Error('No se pudieron cargar los perfiles del proyecto');
          const data = await res.json();
          // Mapear para asegurar estructura
          const mapped = (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            salaries: p.salaries && typeof p.salaries === 'object' ? p.salaries : {},
            is_official: p.is_official ?? false,
          }));
          setProfilesData(mapped);
        } catch (e) {
          setProfilesData([]);
        }
      } else {
        setProfilesData([]);
      }
    };
    fetchProjectProfiles();
  }, [projectFormData?.id, activeTab]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'project-data':
        return <ProjectDataTab project={selectedProject} onChange={setProjectFormData} onBackToMenu={handleBackToMenu} />;
      case 'profiles':
        return <ProfilesTab
          profiles={profilesData}
          onChange={setProfilesData}
          additionalCountries={projectFormData?.additionalCountries || []}
          projectId={projectFormData?.id || 0}
        />;
      case 'work-packages':
        return <WorkPackagesTab workPackages={workPackagesData} onChange={setWorkPackagesData} />;
      case 'non-operational-costs':
        return <CostsTab costs={costsData} onChange={setCostsData} />;
      case 'summary':
        return <SummaryTab project={projectFormData} profiles={profilesData} workPackages={workPackagesData} costs={costsData} />;
      default:
        return <ProjectDataTab project={selectedProject} onChange={setProjectFormData} onBackToMenu={handleBackToMenu} />;
    }
  };

  if (!isLoggedIn) {
    if (showMainApp) setShowMainApp(false);
    return (
      <div className="app">
        <LoginForm
          onLogin={async (credentials) => {
            const success = await handleLoginSubmit(credentials);
            if (success) setShowMainApp(false);
            return success;
          }}
          isLoading={isLoading}
        />
      </div>
    );
  }

  if (!showMainApp) {
    return (
      <div className="app">
        <Menu
          user={user as string}
          onGoToProjectDataTab={() => {
            setShowMainApp(true);
            setSelectedProject(null);
            setActiveTab('project-data');
          }}
          onOpenProject={(project) => {
            console.log('onOpenProject: incoming project:', project);
            const mapped = mapProjectFromBackend(project);
            console.log('onOpenProject: mapped project:', mapped);
            setShowMainApp(true);
            setSelectedProject(mapped);
            setProjectFormData(mapped);
            setActiveTab('project-data');
          }}
          onLogout={() => {
            logout();
            setShowMainApp(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Layout
        user={user}
        onLogout={() => {
          logout();
          setShowMainApp(false);
        }}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
          <button
            style={{
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: 16
            }}
            onClick={handleBackToMenu}
          >
            Guardar y salir
          </button>
        </div>
        {renderTabContent()}
      </Layout>
    </div>
  );
};

export default App;