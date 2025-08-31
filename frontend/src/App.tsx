import React, { useState, useEffect } from 'react';
import { LoginForm, useLoginForm } from './components/auth/LoginForm';
import { Layout } from './components/layout/Layout';
import { ProjectDataTab } from './components/tabs/ProjectDataTab';
import { ProjectData } from './types/project';
import { ProfilesTab } from './components/tabs/ProfilesTab';
import { WorkPackagesTab } from './components/tabs/WorkPackagesTab';
import { CostsTab } from './components/tabs/CostsTab';
import { SummaryTab } from './components/tabs/SummaryTab';
import { AdvanceSettingsTab } from './components/tabs/AdvanceSettingsTab';
import { TabName } from './types/common';
import { Menu } from './components/Menu';
import { TabNavigation } from './components/layout/TabNavigation';
import { NonOperationalCost } from './types/nonOperationalCost';
import './App.css';
import { useCountryNames } from './hooks/useCountryNames';
import { mapProjectFromBackend } from './utils/projectMapper';

// mapper moved to ./utils/projectMapper

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
  
  const saveProjectData = async (): Promise<{ ok: boolean; project?: ProjectData }> => {
    if (!projectFormData) return { ok: false };
    try {
      const backendData = mapToBackend(projectFormData, false);
      let response, responseText;
      let mappedProject: ProjectData | null = null;
      if (!projectFormData.id) {
        response = await fetch('/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendData),
        });
        responseText = await response.text();
        if (!response.ok) throw new Error(responseText);
  const created = JSON.parse(responseText);
  mappedProject = mapProjectFromBackend(created);
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
        mappedProject = mapProjectFromBackend(updated);
        setSelectedProject(mappedProject);
        setProjectFormData(mappedProject);
      }
      return { ok: true, project: mappedProject || undefined };
    } catch (error) {
      console.error('Full Error saving project:', error);
      alert(`No se pudo guardar el proyecto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return { ok: false };
    }
  };

  // Cambia de tab, guardando si se sale de 'project-data'
  const handleTabChange = async (tabName: TabName) => {
    // Guard: if creating a new project and required fields not filled, block tab switch
    const isNew = !projectFormData?.id;
    const missingRequired = isNew && (
      !projectFormData?.title?.trim() ||
      !projectFormData?.startDate ||
      !projectFormData?.endDate ||
      !(projectFormData?.countries && projectFormData.countries.length > 0)
    );
    if (activeTab === 'project-data' && tabName !== 'project-data') {
      if (missingRequired) {
        alert('Los campos Título, Fecha de Inicio, Fecha de Fin y País(es) son obligatorios para crear el proyecto.');
        return;
      }
      const res = await saveProjectData();
      if (!res.ok) return;
      if (tabName === 'profiles') {
        await fetchProjectProfiles(res.project?.id || projectFormData?.id || undefined);
      }
    }
    setActiveTab(tabName);
  };
  const { handleLogin, isLoading } = useLoginForm();
  const [showMainApp, setShowMainApp] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);

  const [projectFormData, setProjectFormData] = useState<ProjectData | null>(null);
  const [profilesData, setProfilesData] = useState<any[]>([]);
  const [workPackagesData, setWorkPackagesData] = useState<any[]>([]);
  const [costsData, setCostsData] = useState<NonOperationalCost[]>([]);

  // Derivar nombres de perfiles
  const profileOptions = React.useMemo(() => (profilesData || []).filter(p=>p && p.name).map(p => ({ id: p.id, name: p.name })), [profilesData]);
  // Hook para obtener nombres de países a partir de IDs del proyecto
  const projectCountryIds = projectFormData?.countries || [];
  const { countries: projectCountryObjs } = useCountryNames(projectCountryIds as string[]);
  const projectCountryOptions = React.useMemo(() => projectCountryObjs.map(c => ({ id: c.id, name: c.name })), [projectCountryObjs]);

  const handleBackToMenu = async () => {
    // If there's no project data, simply close
    if (!projectFormData) {
      setShowMainApp(false);
      setSelectedProject(null);
      setProjectFormData(null);
      setActiveTab('project-data');
      return;
    }

    const isNew = !projectFormData?.id;
    const missingRequired = isNew && (
      !projectFormData?.title?.trim() ||
      !projectFormData?.startDate ||
      !projectFormData?.endDate ||
      !(projectFormData?.countries && projectFormData.countries.length > 0)
    );

    if (missingRequired) {
      const leave = window.confirm('There is an unfinished project creation. Do you want to discard it and exit, or stay to complete the information?\n\nOK = Discard and exit\nCancel = Stay');
      if (!leave) return;
      setShowMainApp(false);
      setSelectedProject(null);
      setProjectFormData(null);
      setActiveTab('project-data');
      return;
    }

    // Try to save; if save succeeds close the app view
    try {
      const res = await saveProjectData();
      if (res.ok) {
        setShowMainApp(false);
        // keep selected project cleared to avoid stale state
        setSelectedProject(null);
        setProjectFormData(null);
        setActiveTab('project-data');
      }
    } catch (e) {
      console.error('Error saving project before leaving:', e);
    }
  };

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
  bu_line: data.buLine?.trim() || '',
  ops_domain: data.opsDomain?.trim() || '',
  country: data.country?.trim() || '',
  countries: data.countries && data.countries.length > 0 ? data.countries : [],
      iqp: data.iqp ? data.iqp.toString().trim() || '' : '',
  margin_type: data.marginType || '',
  // If marginGoal is empty but marginType is chosen, persist placeholder as 0.00
  margin_goal: data.marginGoal === '' || data.marginGoal == null
    ? (data.marginType ? 0 : null)
    : Number(data.marginGoal),
      segmentation: data.segmentation?.trim() || '',
      description: data.description?.trim() || '',
    };
    console.log('Mapped Backend Data:', JSON.stringify(cleanData, null, 2));
    return cleanData;
  };
  const fetchProjectProfiles = React.useCallback(async (explicitProjectId?: number | string) => {
    const pid = explicitProjectId ?? projectFormData?.id;
    if (pid) {
      try {
        const res = await fetch(`/project-profiles/${pid}`);
        if (!res.ok) throw new Error('No se pudieron cargar los perfiles del proyecto');
        const data = await res.json();
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
  }, [projectFormData?.id]);

  useEffect(() => {
    if (activeTab === 'profiles' || activeTab === 'work-packages') {
      fetchProjectProfiles();
    }
  }, [activeTab, fetchProjectProfiles]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'project-data':
        return <ProjectDataTab project={selectedProject} onChange={setProjectFormData} onBackToMenu={handleBackToMenu} />;
      case 'profiles':
        return <ProfilesTab
          profiles={profilesData}
          onChange={setProfilesData}
          additionalCountries={projectFormData?.countries || []}
          projectId={projectFormData?.id || 0}
        />;
      case 'work-packages':
        return (
          <WorkPackagesTab
            workPackages={workPackagesData}
            onChange={setWorkPackagesData}
            projectStartDate={projectFormData?.startDate}
            projectEndDate={projectFormData?.endDate}
            projectId={projectFormData?.id}
            profiles={profileOptions}
            countries={projectCountryOptions}
          />
        );
      case 'non-operational-costs':
          return (
            <CostsTab
              projectId={projectFormData?.id || 0}
              projectStartDate={projectFormData?.startDate}
              projectEndDate={projectFormData?.endDate}
              costs={costsData}
              onChange={setCostsData}
            />
          );
      case 'summary':
        return <SummaryTab project={projectFormData} profiles={profilesData} workPackages={workPackagesData} costs={costsData} />;
      case 'advance-settings':
        return <AdvanceSettingsTab projectId={projectFormData?.id || 0} countries={projectCountryOptions as any} />;
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