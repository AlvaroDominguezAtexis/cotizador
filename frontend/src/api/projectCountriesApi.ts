// src/api/projectCountriesApi.ts
import { apiConfig } from '../utils/apiConfig';

export interface ProjectCountryWorkingDays {
  country_id: string | number;
  country_name: string;
  working_days: number | null;
}

export const fetchProjectCountriesWorkingDays = async (projectId: number | string): Promise<ProjectCountryWorkingDays[]> => {
  const response = await apiConfig.fetch(`/api/projects/${projectId}/countries-working-days`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Error fetching project countries working days');
  }
  return response.json();
};
