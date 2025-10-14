// src/api/timeAndMaterialApi.ts
import { apiConfig } from '../utils/apiConfig';

export interface TimeAndMaterialProfile {
  stepName: string;
  profileId: number;
  countryId: string;
  city: string;
  processTime: number;
  units: string;
  marginGoal: number;
  yearlyQuantities: number[];
  processTimePerYear: number[];
  mngPerYear: number[];
  officePerYear: string[];
  hardwarePerYear: string[];
}

export interface TimeAndMaterialData {
  projectId: number;
  rows: TimeAndMaterialProfile[];
}

export const createTimeAndMaterialWorkPackage = async (data: TimeAndMaterialData): Promise<any> => {
  try {
    const { projectId, rows } = data;

    // Usar el nuevo endpoint backend que maneja todo en una transacción
    const response = await fetch(apiConfig.url(`/api/projects/${projectId}/workpackages/time-and-material`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error creando Time & Material workpackage');
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error en createTimeAndMaterialWorkPackage:', error);
    throw error;
  }
};

export const fetchTimeAndMaterialWorkPackage = async (projectId: number): Promise<any> => {
  try {
    const response = await fetch(apiConfig.url(`/api/projects/${projectId}/workpackages/time-and-material`), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error fetching Time & Material workpackage');
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error en fetchTimeAndMaterialWorkPackage:', error);
    throw error;
  }
};

export const updateTimeAndMaterialProfile = async (
  projectId: number,
  workpackageId: number,
  stepId: number,
  data: Partial<TimeAndMaterialProfile>
): Promise<any> => {
  try {
    const response = await fetch(apiConfig.url(`/api/projects/${projectId}/workpackages/${workpackageId}/steps/${stepId}/time-and-material`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error updating Time & Material profile');
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error en updateTimeAndMaterialProfile:', error);
    throw error;
  }
};