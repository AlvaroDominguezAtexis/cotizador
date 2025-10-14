// src/components/workpackages/TimeAndMaterialForm.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { fetchTimeAndMaterialWorkPackage, updateTimeAndMaterialProfile } from '../../api/timeAndMaterialApi';
import { apiConfig } from '../../utils/apiConfig';
import './TimeAndMaterial.css';

interface ProfileRow {
  id: number;
  profileId: number;
  marginGoal: number;
  countryId: string;
  cityId?: number;
  processTime: number;
  yearlyQuantities: number[];
  processTimePerYear?: number[];
  mngPerYear?: number[];
  officePerYear?: boolean[];
  hardwarePerYear?: boolean[];
  expanded?: boolean;
  isEditing?: boolean; // Nuevo estado para controlar modo edición
  stepId?: number; // ID del step en backend (si ya existe)
  stepWorkpackageId?: number; // ID del workpackage específico del step
}

interface TimeAndMaterialFormProps {
  projectId: number;
  workpackageId?: number; // ID del workpackage Time & Material (si ya existe)
  profileOptions: { id: number; name: string }[];
  countryOptions: { id: string; name: string }[];
  projectYears?: number[];
  defaultMarginGoal?: number;
  projectStartDate?: string;
  projectEndDate?: string;
  onSave: (data: any) => Promise<void>;
}

const TimeAndMaterialForm: React.FC<TimeAndMaterialFormProps> = ({
  projectId,
  workpackageId,
  profileOptions,
  countryOptions,
  projectYears = [],
  defaultMarginGoal = 0,
  projectStartDate,
  projectEndDate,
  onSave
}) => {
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWorkpackageId, setCurrentWorkpackageId] = useState<number | null>(workpackageId || null);
  
  // Estado para manejar ciudades por país
  const [citiesByCountry, setCitiesByCountry] = useState<Record<string, Array<{id: number; name: string}>>>({});

  /**
   * Función para calcular días laborales entre dos fechas (lunes a viernes)
   * Este valor se usa como valor por defecto para el campo "process time" en nuevos perfiles
   * @param startDate - Fecha de inicio del proyecto en formato YYYY-MM-DD
   * @param endDate - Fecha de fin del proyecto en formato YYYY-MM-DD
   * @returns Número de días laborales entre las fechas
   */
  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Verificar que las fechas sean válidas
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    let workingDays = 0;
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      // 1 = lunes, 2 = martes, ..., 5 = viernes
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  };

  // Calcular días laborales por defecto para process time
  const defaultProcessTime = calculateWorkingDays(projectStartDate || '', projectEndDate || '');

  // Helper function para encontrar el nombre del perfil
  const getProfileName = (profileId: number): string => {
    const profile = profileOptions.find(p => p.id === profileId);
    return profile?.name || 'Sin seleccionar';
  };

  // Helper function para encontrar el nombre del país
  const getCountryName = (countryId: string | number): string => {
    if (!countryId && countryId !== 0) return 'Sin seleccionar';
    
    // Convertir ambos valores a string para comparación consistente
    const searchId = String(countryId);
    const country = countryOptions.find(c => String(c.id) === searchId);
    
    return country?.name || 'Sin seleccionar';
  };

  // Función para obtener todas las combinaciones perfil-ciudad ya utilizadas
  const getUsedProfileCityCombinations = (): Set<string> => {
    const usedCombinations = new Set<string>();
    rows.forEach(row => {
      if (row.profileId && row.cityId) {
        usedCombinations.add(`${row.profileId}-${row.cityId}`);
      }
    });
    return usedCombinations;
  };

  // Función para obtener ciudades disponibles para un perfil específico
  const getAvailableCitiesForProfile = (profileId: number, countryId: string, excludeRowId?: number): any[] => {
    if (!profileId || !countryId) return [];

    const usedCombinations = getUsedProfileCityCombinations();
    
    // Si estamos editando una fila existente, excluir su combinación actual
    if (excludeRowId !== undefined) {
      const currentRow = rows.find(row => row.id === excludeRowId);
      if (currentRow && currentRow.profileId && currentRow.cityId) {
        usedCombinations.delete(`${currentRow.profileId}-${currentRow.cityId}`);
      }
    }

    const citiesForCountry = citiesByCountry[countryId] || [];
    return citiesForCountry.filter(city => 
      !usedCombinations.has(`${profileId}-${city.id}`)
    );
  };

  // Función para obtener perfiles disponibles (que no han usado todas las ciudades)
  const getAvailableProfiles = (excludeRowId?: number): typeof profileOptions => {
    const usedCombinations = getUsedProfileCityCombinations();
    
    // Si estamos editando una fila existente, excluir su combinación actual
    if (excludeRowId !== undefined) {
      const currentRow = rows.find(row => row.id === excludeRowId);
      if (currentRow && currentRow.profileId && currentRow.cityId) {
        usedCombinations.delete(`${currentRow.profileId}-${currentRow.cityId}`);
      }
    }

    return profileOptions.filter(profile => {
      // Contar cuántas ciudades ha usado este perfil
      const citiesUsedByProfile = Array.from(usedCombinations)
        .filter((combination: string) => combination.startsWith(`${profile.id}-`))
        .length;
      
      // Calcular el total de ciudades disponibles
      const totalCities = Object.values(citiesByCountry).reduce((total, cities) => total + cities.length, 0);
      
      // Si no hay ciudades cargadas aún, permitir todos los perfiles
      if (totalCities === 0) {
        return true;
      }
      
      // El perfil está disponible si no ha usado todas las ciudades
      return citiesUsedByProfile < totalCities;
    });
  };

  // Función para verificar si se puede añadir un nuevo perfil
  const canAddNewProfile = (): boolean => {
    // Siempre permitir añadir perfiles si hay perfiles disponibles
    // La validación de duplicados se hará cuando el usuario seleccione país y ciudad
    return profileOptions.length > 0;
  };

  // Función para obtener la primera combinación perfil-ciudad disponible
  const getFirstAvailableProfileCityCombination = (): { profileId: number; countryId: string; cityId: number } | null => {
    const availableProfiles = getAvailableProfiles();
    
    for (const profile of availableProfiles) {
      // Buscar en todos los países para encontrar ciudades disponibles
      for (const country of countryOptions) {
        const availableCities = getAvailableCitiesForProfile(profile.id, country.id);
        if (availableCities.length > 0) {
          return {
            profileId: profile.id,
            countryId: country.id,
            cityId: availableCities[0].id
          };
        }
      }
    }
    
    return null;
  };

  // Cargar ciudades para países que ya estén seleccionados
  useEffect(() => {
    const countriesToFetch = rows
      .map(row => row.countryId)
      .filter(countryId => countryId && !citiesByCountry[countryId]);
    
    countriesToFetch.forEach(countryId => {
      fetchCitiesForCountry(countryId);
    });
  }, [rows.map(r => r.countryId).join(',')]); // Solo re-ejecutar si cambian los países seleccionados

  // Función para forzar recarga completa de datos
  const forceReloadData = async (): Promise<boolean> => {
    console.log('🔄 FORZANDO recarga completa de datos...');
    setCurrentWorkpackageId(null);
    setRows([]);
    setError(null);
    
    try {
      const result = await fetchTimeAndMaterialWorkPackage(projectId);
      console.log('📦 FORZAR - Datos recibidos:', result);
      
      if (result?.steps && result.steps.length > 0 && result.workpackage) {
        console.log('✅ FORZAR - Datos encontrados, procesando...');
        
        // Mapear directamente sin verificaciones adicionales
        const newRows = result.steps.map((step: any, index: number) => ({
          id: Date.now() + index + Math.random(),
          profileId: step.profileId,
          countryId: String(step.countryId),
          cityId: step.cityId,
          processTime: step.processTime || 0,
          marginGoal: result.deliverable?.marginGoal || defaultMarginGoal,
          yearlyQuantities: new Array(projectYears.length).fill(1),
          processTimePerYear: new Array(projectYears.length).fill(0),
          mngPerYear: new Array(projectYears.length).fill(0),
          officePerYear: new Array(projectYears.length).fill(false),
          hardwarePerYear: new Array(projectYears.length).fill(false),
          expanded: false,
          isEditing: false,
          stepId: step.id,
          stepWorkpackageId: step.workpackage_id || result.workpackage.id
        }));
        
        console.log('🎯 FORZAR - Estableciendo nuevas filas:', newRows.length);
        setCurrentWorkpackageId(result.workpackage.id);
        setRows(newRows);
        return true; // Éxito - se encontraron datos
      } else {
        console.log('✅ FORZAR - No hay datos (estado vacío correcto)', { 
          hasSteps: result?.steps?.length > 0,
          hasWorkpackage: !!result?.workpackage,
          result: result
        });
        setCurrentWorkpackageId(null);
        setRows([]);
        return true; // Éxito - estado vacío es válido después de eliminar todo
      }
    } catch (error) {
      console.error('❌ FORZAR - Error:', error);
      setError('Error al forzar recarga de datos');
      return false; // Error
    }
  };

  // Función para recargar los datos de Time & Material desde el backend
  const refreshTimeAndMaterialData = async (showLoading = false) => {
    if (!projectId) return;

    if (showLoading) setLoading(true);
    try {
      console.log(`🔄 Refrescando datos Time & Material para proyecto ${projectId}...`);
      
      const result = await fetchTimeAndMaterialWorkPackage(projectId);
      console.log('📦 Datos recibidos del backend:', result);
      
      if (result && result.steps && Array.isArray(result.steps) && result.steps.length > 0 && result.workpackage) {
        console.log(`✅ Workpackage encontrado: ${result.workpackage.id} - ${result.workpackage.name}`);
        console.log(`📊 Steps encontrados: ${result.steps.length}`);
        
        // Convertir los datos del backend al formato de ProfileRow
        const loadedRows: ProfileRow[] = result.steps.map((step: any) => {
          // Organizar datos anuales en arrays por año
          const sortedYearlyData = step.yearlyData?.sort((a: any, b: any) => a.year - b.year) || [];
          
          const processTimePerYear = new Array(projectYears.length).fill(0);
          const mngPerYear = new Array(projectYears.length).fill(0);
          const officePerYear = new Array(projectYears.length).fill(false);
          const hardwarePerYear = new Array(projectYears.length).fill(false);

          sortedYearlyData.forEach((yearData: any, index: number) => {
            if (index < projectYears.length) {
              processTimePerYear[index] = yearData.processTime || 0;
              mngPerYear[index] = yearData.mng || 0;
              officePerYear[index] = yearData.office === true || yearData.office === 1;
              hardwarePerYear[index] = yearData.hardware === true || yearData.hardware === 1;
            }
          });

          return {
            id: Date.now() + Math.random() + step.id, // ID único para el frontend
            profileId: step.profileId,
            marginGoal: result.deliverable?.marginGoal || defaultMarginGoal,
            countryId: String(step.countryId), // Asegurar que sea string
            cityId: step.cityId || undefined,
            processTime: sortedYearlyData[0]?.processTime || 0,
            yearlyQuantities: result.deliverable?.yearlyQuantities && result.deliverable.yearlyQuantities.length > 0 
              ? result.deliverable.yearlyQuantities 
              : new Array(projectYears.length).fill(1),
            processTimePerYear,
            mngPerYear,
            officePerYear,
            hardwarePerYear,
            expanded: false,
            isEditing: false, // Los datos cargados están en modo lectura
            stepId: step.id, // ID del step en el backend
            stepWorkpackageId: step.workpackage_id // ID del workpackage específico del step
          };
        });

        setCurrentWorkpackageId(result.workpackage.id);
        console.log('📝 Estableciendo filas en el estado:', {
          antes: rows.length,
          despues: loadedRows.length,
          nuevasFilas: loadedRows.map(r => ({ 
            id: r.id, 
            profileId: r.profileId, 
            countryId: r.countryId, 
            stepId: r.stepId 
          }))
        });
        setRows(loadedRows);

        // Debug: mostrar los datos cargados
        console.log('🎯 Datos refrescados del backend:', {
          workpackageId: result.workpackage.id,
          stepsCount: result.steps.length,
          loadedRowsCount: loadedRows.length,
          stepIds: loadedRows.map(row => ({ 
            rowId: row.id, 
            stepId: row.stepId, 
            stepWorkpackageId: row.stepWorkpackageId 
          }))
        });

        // Cargar ciudades para todos los países de los perfiles cargados
        const countriesToLoad = Array.from(new Set(loadedRows.map(row => row.countryId)));
        countriesToLoad.forEach(countryId => {
          if (countryId && !citiesByCountry[countryId]) {
            fetchCitiesForCountry(countryId);
          }
        });
      } else {
        // No hay datos, limpiar la tabla
        console.log('❌ No se encontraron datos existentes, tabla vacía');
        setRows([]);
        setCurrentWorkpackageId(null);
      }
    } catch (error: any) {
      console.error('Error refreshing Time & Material data:', error);
      setError(`Error al recargar datos: ${error.message}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Cargar datos existentes de Time & Material del backend
  useEffect(() => {
    const loadExistingData = async () => {
      if (!projectId || rows.length > 0) return; // Solo cargar si no hay filas ya

      await refreshTimeAndMaterialData(true);
    };

    loadExistingData();
  }, [projectId, profileOptions.length, countryOptions.length]); // Ejecutar cuando cambien estos valores

  // Función para validar que todos los IDs necesarios están presentes
  const validateDeletionIds = (row: ProfileRow): { valid: boolean; error?: string } => {
    if (!projectId || isNaN(Number(projectId))) {
      return { valid: false, error: 'ID de proyecto no válido' };
    }
    
    if (!currentWorkpackageId || isNaN(Number(currentWorkpackageId))) {
      return { valid: false, error: 'ID de workpackage no válido' };
    }
    
    if (!row.stepId || isNaN(Number(row.stepId))) {
      return { valid: false, error: 'ID de step no válido' };
    }
    
    return { valid: true };
  };

  // Función helper para obtener el valor de management por defecto del país
  const getDefaultMngForCountry = async (countryId: string): Promise<number> => {
    // Para IQP 1-2 (Time & Material), management siempre es 0% por defecto
    return 0;
  };

  // Función helper para obtener los valores por defecto de office y hardware
  const getDefaultOfficeHardwareValues = (): { office: boolean; hardware: boolean } => {
    return {
      office: false, // Para IQP 1-2 (Time & Material), por defecto false
      hardware: false // Para IQP 1-2 (Time & Material), por defecto false
    };
  };

  const addRow = async () => {
    // Verificar si se pueden añadir más perfiles
    // Verificar que haya perfiles disponibles
    const availableProfiles = getAvailableProfiles();
    if (availableProfiles.length === 0) {
      setError('No hay perfiles disponibles para crear nuevas combinaciones.');
      return;
    }

    // Obtener el primer perfil disponible pero sin preseleccionar país/ciudad
    const selectedProfileId = availableProfiles[0].id;

    // Obtener valores por defecto (sin país específico, usar valores por defecto)
    const defaultMng = await getDefaultMngForCountry(''); // Sin país = 0%
    const { office, hardware } = getDefaultOfficeHardwareValues();

    const newRow: ProfileRow = {
      id: Date.now() + Math.random(), // Make ID more unique
      profileId: selectedProfileId,
      marginGoal: defaultMarginGoal,
      countryId: '', // Sin preseleccionar país
      cityId: undefined, // Sin preseleccionar ciudad
      processTime: defaultProcessTime,
      yearlyQuantities: new Array(projectYears.length).fill(1),
      processTimePerYear: new Array(projectYears.length).fill(0),
      mngPerYear: new Array(projectYears.length).fill(defaultMng), // Para IQP 1-2, siempre 0%
      officePerYear: Array(projectYears.length).fill(office), // Para IQP 1-2, por defecto false (No)
      hardwarePerYear: Array(projectYears.length).fill(hardware), // Para IQP 1-2, por defecto false (No)
      expanded: false,
      isEditing: true, // Nuevos perfiles comienzan en modo edición
      stepId: undefined
    };
    
    // Limpiar cualquier error previo
    setError(null);
    setRows(prev => [...prev, newRow]);
  };

  const updateRow = (rowId: number, updates: Partial<ProfileRow>) => {
    // Si se cambió el perfil, verificar si la combinación perfil-ciudad actual sigue siendo válida
    if (updates.profileId !== undefined) {
      const currentRow = rows.find(row => row.id === rowId);
      if (currentRow && currentRow.cityId) {
        const usedCombinations = getUsedProfileCityCombinations();
        // Excluir la combinación actual
        usedCombinations.delete(`${currentRow.profileId}-${currentRow.cityId}`);
        
        // Verificar si la nueva combinación perfil-ciudad estaría duplicada
        if (usedCombinations.has(`${updates.profileId}-${currentRow.cityId}`)) {
          // La ciudad actual no está disponible para el nuevo perfil, limpiar ciudad
          updates.cityId = undefined;
        }
      }
    }
    
    // Si se cambió el país, limpiar la ciudad seleccionada y cargar nuevas ciudades
    if (updates.countryId) {
      updates.cityId = undefined;
      fetchCitiesForCountry(updates.countryId);
    }

    // Validar que la combinación perfil-ciudad no esté duplicada
    if (updates.cityId !== undefined) {
      const currentRow = rows.find(row => row.id === rowId);
      if (currentRow) {
        const profileId = updates.profileId || currentRow.profileId;
        const usedCombinations = getUsedProfileCityCombinations();
        
        // Excluir la combinación actual si existe
        if (currentRow.cityId) {
          usedCombinations.delete(`${currentRow.profileId}-${currentRow.cityId}`);
        }
        
        // Verificar si la nueva combinación ya existe
        if (updates.cityId && usedCombinations.has(`${profileId}-${updates.cityId}`)) {
          setError(`La combinación de este perfil con esta ciudad ya está en uso.`);
          return; // No aplicar la actualización
        }
      }
    }
    
    // Limpiar error si la validación pasó
    setError(null);
    
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, ...updates } : row
    ));
  };

  // Función para cargar ciudades por país
  const fetchCitiesForCountry = async (countryId: string) => {
    if (!countryId || citiesByCountry[countryId]) return;
    
    try {
      const res = await fetch(apiConfig.url(`/api/countries/${countryId}/cities`));
      if (!res.ok) throw new Error('Error fetching cities');
      const cities = await res.json();
      setCitiesByCountry(prev => ({
        ...prev,
        [countryId]: cities || []
      }));
    } catch (e) {
      console.error('Error fetching cities:', e);
      setCitiesByCountry(prev => ({
        ...prev,
        [countryId]: []
      }));
    }
  };

  const removeRow = async (rowId: number) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    console.log('Intentando eliminar fila:', {
      rowId,
      stepId: row.stepId,
      stepWorkpackageId: row.stepWorkpackageId,
      profileId: row.profileId,
      countryId: row.countryId,
      currentWorkpackageId
    });

    // Si el perfil ya fue guardado (tiene stepId), eliminarlo del backend
    // Esto elimina solo la relación específica perfil-país de este proyecto
    if (row.stepId) {
      // Validar que tenemos los IDs necesarios
      const validation = validateDeletionIds(row);
      if (!validation.valid) {
        setError(`Error de validación: ${validation.error}`);
        console.error('Error de validación:', validation.error, {
          projectId,
          currentWorkpackageId,
          stepId: row.stepId
        });
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const result = await deleteProfile(row.stepId, row.stepWorkpackageId);
        
        // Con la nueva lógica CASCADE, siempre se elimina el workpackage completo
        // Pero podría haber otros workpackages Time & Material en el proyecto
        console.log('Perfil eliminado correctamente:', result);
        console.log(`Relación ${getProfileName(row.profileId)}-${getCountryName(row.countryId)} eliminada del proyecto`);
        
        // Delay para asegurar que la transacción se confirme
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Siempre refrescar para mostrar el estado actualizado del proyecto
        try {
          console.log('🔄 Recargando datos después de eliminación...');
          const reloadSuccessful = await forceReloadData();
          
          if (reloadSuccessful) {
            console.log('✅ Recarga exitosa después de eliminación');
            // Mostrar mensaje de éxito
            const successMessage = `Relación ${getProfileName(row.profileId)}-${getCountryName(row.countryId)} eliminada correctamente del proyecto`;
            setError(null);
            console.info('✅', successMessage);
          } else {
            console.warn('⚠️ Error inesperado en la recarga');
            setError('Los datos se eliminaron correctamente pero hubo un problema al actualizar la vista.');
          }
        } catch (error) {
          console.error('❌ Error en la recarga:', error);
          setError('Los datos se eliminaron correctamente pero hubo un problema al actualizar la vista.');
        }
      } catch (err: any) {
        setError(err.message || 'Error al eliminar la relación perfil-país del proyecto');
        return; // No remover del estado local si falló la eliminación
      } finally {
        setLoading(false);
      }
    } else {
      // Si es un perfil nuevo (sin stepId), solo removerlo del estado local
      console.log(`Relación ${getProfileName(row.profileId)}-${getCountryName(row.countryId)} removida (no guardada)`);
      setRows(prev => prev.filter(row => row.id !== rowId));
    }
  };

  const toggleRowExpansion = (rowId: number) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, expanded: !row.expanded } : row
    ));
  };

  const toggleRowEdit = (rowId: number) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, isEditing: !row.isEditing } : row
    ));
  };

  const saveRow = async (rowId: number) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    // Validar datos del perfil
    if (!row.profileId || !row.countryId || !row.cityId || row.processTime <= 0) {
      setError('Por favor completa todos los campos obligatorios');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rowData = {
        stepName: getProfileName(row.profileId),
        profileId: row.profileId,
        countryId: row.countryId,
        cityId: row.cityId,
        processTime: row.processTime,
        units: 'Days',
        marginGoal: row.marginGoal,
        yearlyQuantities: row.yearlyQuantities,
        processTimePerYear: row.processTimePerYear || [],
        mngPerYear: row.mngPerYear || [],
        officePerYear: row.officePerYear || [],
        hardwarePerYear: row.hardwarePerYear || []
      };

      let stepId = row.stepId;
      
      if (row.stepId) {
        // Actualizar perfil existente
        await updateProfile(row.stepId, rowData);
        console.log('✅ Perfil actualizado correctamente');
      } else {
        // Crear nuevo perfil - por ahora simplificado
        const result = await createProfile(rowData);
        console.log('✅ Perfil creado correctamente');
        
        // Actualizar el row con el stepId devuelto por el backend
        if (result && result.steps && result.steps.length > 0) {
          stepId = result.steps[0].id;
          
          // Establecer el workpackageId si es la primera vez
          if (!currentWorkpackageId && result.workpackage) {
            setCurrentWorkpackageId(result.workpackage.id);
          }
          
          setRows(prev => prev.map(r => 
            r.id === rowId ? { ...r, stepId: stepId } : r
          ));
        }
      }

      // Refrescar datos desde el backend para asegurar consistencia
      console.log('🔄 Refrescando datos después de guardar...');
      await refreshTimeAndMaterialData(false); // No mostrar loading adicional

      // Cambiar a modo read-only (esto se aplicará a los datos refrescados)
      setTimeout(() => {
        setRows(prev => prev.map(row => 
          row.stepId === stepId ? { ...row, isEditing: false } : row
        ));
      }, 100);

    } catch (err: any) {
      setError(err.message || 'Error al guardar perfil');
    } finally {
      setLoading(false);
    }
  };

  const cancelRowEdit = (rowId: number) => {
    setRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, isEditing: false } : row
    ));
  };

  // Función para crear un nuevo perfil
  const createProfile = async (rowData: any) => {
    try {
      const response = await fetch(apiConfig.url(`/api/projects/${projectId}/workpackages/time-and-material`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rows: [rowData]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear perfil');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  };

  // Función para actualizar un perfil existente  
  const updateProfile = async (stepId: number, rowData: any) => {
    if (!currentWorkpackageId) {
      throw new Error('No se puede actualizar el perfil: workpackage no identificado');
    }

    try {
      const updateData = {
        profileId: rowData.profileId,
        countryId: rowData.countryId,
        cityId: rowData.cityId,
        processTime: rowData.processTime,
        marginGoal: rowData.marginGoal,
        yearlyQuantities: rowData.yearlyQuantities,
        processTimePerYear: rowData.processTimePerYear,
        mngPerYear: rowData.mngPerYear,
        officePerYear: rowData.officePerYear,
        hardwarePerYear: rowData.hardwarePerYear
      };

      const result = await updateTimeAndMaterialProfile(
        projectId,
        currentWorkpackageId,
        stepId,
        updateData
      );

      console.log('Profile updated successfully:', result);
      return result;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  // Función para eliminar un perfil existente
  const deleteProfile = async (stepId: number, stepWorkpackageId?: number) => {
    // Usar el workpackageId específico del step si está disponible, 
    // sino usar el currentWorkpackageId como fallback
    const workpackageIdToUse = stepWorkpackageId || currentWorkpackageId;
    
    console.log('DeleteProfile - Decisión de workpackageId:', {
      stepWorkpackageId,
      currentWorkpackageId,
      workpackageIdToUse,
      willUseSpecific: !!stepWorkpackageId
    });
    
    if (!workpackageIdToUse) {
      throw new Error('No se puede eliminar la relación perfil-país: workpackage no identificado');
    }

    // Debug: mostrar información de la eliminación
    console.log('Intentando eliminar:', {
      projectId,
      workpackageId: workpackageIdToUse,
      stepId,
      usingSpecificWorkpackageId: !!stepWorkpackageId
    });

    try {
      const url = apiConfig.url(`/api/projects/${projectId}/workpackages/${workpackageIdToUse}/steps/${stepId}`);
      console.log('URL de eliminación:', url);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error del servidor:', errorData);
        throw new Error(errorData.error || 'Error al eliminar la relación perfil-país del proyecto');
      }

      const result = await response.json();
      console.log('Relación perfil-país eliminada del proyecto:', result);
      
      return result;
    } catch (error) {
      console.error('Error deleting profile-country relationship:', error);
      throw error;
    }
  };

  // No renderizar hasta que tengamos los datos básicos necesarios
  if (!profileOptions.length || !countryOptions.length) {
    return (
      <div className="time-material-form">
        <div className="form-header">
          <h2>Time & Material - Configuración Simplificada</h2>
          <p className="form-description">Cargando opciones...</p>
        </div>
      </div>
    );
  }

  // Mostrar indicador de carga mientras se cargan datos existentes
  if (loading && rows.length === 0) {
    return (
      <div className="time-material-form">
        <div className="form-header">
          <h2>Time & Material - Configuración Simplificada</h2>
          <p className="form-description">Cargando datos existentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="time-material-form">
      <div className="form-header">
        <h2>Time & Material - Configuración Simplificada</h2>
        <p className="form-description">
          Para proyectos IQP 1-2, configure directamente los perfiles y recursos necesarios.
        </p>
        {rows.length > 0 && (
          <div className="profile-counter">
            📊 {rows.length} perfil(es) • {rows.filter(r => r.stepId).length} guardado(s) • {rows.filter(r => !r.stepId).length} pendiente(s) 
          </div>
        )}
      </div>

      <div className="profiles-list">
        {rows.length === 0 ? (
          <div className="empty-profiles-message">
            <div className="empty-state-icon">📋</div>
            <h3>No hay perfiles configurados</h3>
            <p>Haz clic en "Añadir Perfil" para comenzar a configurar los perfiles y países para tu proyecto Time & Material.</p>
          </div>
        ) : (
          rows.map((row, index) => (
          <div key={row.id} className="profile-row-card">
            <div className="profile-row-header">
              {row.isEditing ? (
                <select
                  className="profile-title-select"
                  value={row.profileId}
                  onChange={(e) => updateRow(row.id, { profileId: Number(e.target.value) })}
                  required
                >
                  <option value="">Seleccionar perfil</option>
                  {getAvailableProfiles(row.id).map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              ) : (
                <h3>{getProfileName(row.profileId)}</h3>
              )}
              <div className="row-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleRowExpansion(row.id)}
                >
                  {row.expanded ? '▲' : '▼'} Detalles anuales
                </Button>
                
                {row.isEditing ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => saveRow(row.id)}
                      disabled={loading}
                    >
                      {loading ? 'Guardando...' : 'Guardar'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => cancelRowEdit(row.id)}
                      disabled={loading}
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => toggleRowEdit(row.id)}
                  >
                    Editar
                  </Button>
                )}
                
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    const profileName = getProfileName(row.profileId);
                    const countryName = getCountryName(row.countryId);
                    const confirmMessage = rows.length === 1 && row.stepId
                      ? `¿Estás seguro de que quieres eliminar la relación ${profileName}-${countryName}? Esto eliminará todo el workpackage Time & Material ya que es el único perfil.`
                      : `¿Estás seguro de que quieres eliminar la relación ${profileName}-${countryName} de este proyecto?`;
                    
                    if (window.confirm(confirmMessage)) {
                      removeRow(row.id);
                    }
                  }}
                  disabled={loading}
                  title={`Eliminar relación ${getProfileName(row.profileId)}-${getCountryName(row.countryId)} del proyecto`}
                  className={
                    rows.length === 1 && row.stepId 
                      ? "critical-delete" 
                      : ""
                  }
                >
                  🗑️ Eliminar
                </Button>
              </div>
            </div>

            <div className="profile-row-content">
              <div className="basic-fields">
                <div className="field-group">
                  <label>Margin Goal (%)</label>
                  {row.isEditing ? (
                    <input
                      type="number"
                      value={row.marginGoal}
                      onChange={(e) => updateRow(row.id, { marginGoal: Number(e.target.value) })}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  ) : (
                    <div className="readonly-field">
                      {row.marginGoal}%
                    </div>
                  )}
                </div>

                <div className="field-group">
                  <label>País</label>
                  {row.isEditing ? (
                    <select
                      value={row.countryId}
                      onChange={(e) => updateRow(row.id, { countryId: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar país</option>
                      {countryOptions.map(country => (
                        <option key={country.id} value={country.id}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="readonly-field">
                      {getCountryName(row.countryId)}
                    </div>
                  )}
                </div>

                <div className="field-group">
                  <label>Ciudad</label>
                  {row.isEditing ? (
                    <select
                      value={row.cityId || ''}
                      onChange={(e) => updateRow(row.id, { cityId: e.target.value ? Number(e.target.value) : undefined })}
                      required
                    >
                      <option value="">Seleccionar ciudad</option>
                      {row.countryId && getAvailableCitiesForProfile(row.profileId, row.countryId, row.id).map(city => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="readonly-field">
                      {(citiesByCountry[row.countryId] || []).find(c => c.id === row.cityId)?.name || 'Sin seleccionar'}
                    </div>
                  )}
                </div>

                <div className="field-group">
                  <label>Process Time (días)</label>
                  {row.isEditing ? (
                    <input
                      type="number"
                      value={row.processTime}
                      onChange={(e) => updateRow(row.id, { processTime: Number(e.target.value) })}
                      min="0"
                      step="0.1"
                      required
                    />
                  ) : (
                    <div className="readonly-field">
                      {row.processTime} días
                    </div>
                  )}
                </div>
              </div>

              <div className="yearly-quantities">
                <h4>Number of consultants</h4>
                <div className="year-fields">
                  {projectYears.map((year, yearIndex) => (
                    <div key={year} className="field-group">
                      <label>{year}</label>
                      {row.isEditing ? (
                        <input
                          type="number"
                          value={row.yearlyQuantities[yearIndex] || 0}
                          onChange={(e) => {
                            const newQuantities = [...row.yearlyQuantities];
                            newQuantities[yearIndex] = Number(e.target.value);
                            updateRow(row.id, { yearlyQuantities: newQuantities });
                          }}
                          min="0"
                          step="1"
                        />
                      ) : (
                        <div className="readonly-field">
                          {row.yearlyQuantities[yearIndex] || 0}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {row.expanded && (
                <div className="expanded-details">
                  <h4>Configuración Detallada por Año</h4>
                  
                  <div className="detail-section">
                    <h5>Process Time por Año</h5>
                    <div className="year-fields">
                      {projectYears.map((year, yearIndex) => (
                        <div key={`pt-${year}`} className="field-group">
                          <label>{year}</label>
                          {row.isEditing ? (
                            <input
                              type="number"
                              value={row.processTimePerYear?.[yearIndex] || 0}
                              onChange={(e) => {
                                const newPT = [...(row.processTimePerYear || [])];
                                newPT[yearIndex] = Number(e.target.value);
                                updateRow(row.id, { processTimePerYear: newPT });
                              }}
                              min="0"
                              step="0.1"
                            />
                          ) : (
                            <div className="readonly-field">
                              {row.processTimePerYear?.[yearIndex] || 0}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h5>Management (%) por Año</h5>
                    <div className="year-fields">
                      {projectYears.map((year, yearIndex) => (
                        <div key={`mng-${year}`} className="field-group">
                          <label>{year}</label>
                          {row.isEditing ? (
                            <input
                              type="number"
                              value={row.mngPerYear?.[yearIndex] || 0}
                              onChange={(e) => {
                                const newMng = [...(row.mngPerYear || [])];
                                newMng[yearIndex] = Number(e.target.value);
                                updateRow(row.id, { mngPerYear: newMng });
                              }}
                              min="0"
                              max="100"
                              step="0.1"
                            />
                          ) : (
                            <div className="readonly-field">
                              {row.mngPerYear?.[yearIndex] || 0}%
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h5>Office por Año</h5>
                    <div className="year-fields">
                      {projectYears.map((year, yearIndex) => (
                        <div key={`office-${year}`} className="field-group">
                          <label>{year}</label>
                          {row.isEditing ? (
                            <select
                              value={row.officePerYear?.[yearIndex] !== undefined ? (row.officePerYear[yearIndex] ? 'Yes' : 'No') : 'No'}
                              onChange={(e) => {
                                const newOffice = [...(row.officePerYear || [])];
                                newOffice[yearIndex] = e.target.value === 'Yes';
                                updateRow(row.id, { officePerYear: newOffice });
                              }}
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          ) : (
                            <div className="readonly-field">
                              {row.officePerYear?.[yearIndex] ? 'Yes' : 'No'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h5>Hardware por Año</h5>
                    <div className="year-fields">
                      {projectYears.map((year, yearIndex) => (
                        <div key={`hw-${year}`} className="field-group">
                          <label>{year}</label>
                          {row.isEditing ? (
                            <select
                              value={row.hardwarePerYear?.[yearIndex] !== undefined ? (row.hardwarePerYear[yearIndex] ? 'Yes' : 'No') : 'No'}
                              onChange={(e) => {
                                const newHW = [...(row.hardwarePerYear || [])];
                                newHW[yearIndex] = e.target.value === 'Yes';
                                updateRow(row.id, { hardwarePerYear: newHW });
                              }}
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          ) : (
                            <div className="readonly-field">
                              {row.hardwarePerYear?.[yearIndex] ? 'Yes' : 'No'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )))}
      </div>

      <div className="form-actions">
        <Button
          variant="secondary"
          onClick={addRow}
          disabled={!canAddNewProfile()}
          title={!canAddNewProfile() ? 'No hay perfiles disponibles' : 'Añadir nuevo perfil'}
        >
          + Añadir Perfil
        </Button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default TimeAndMaterialForm;