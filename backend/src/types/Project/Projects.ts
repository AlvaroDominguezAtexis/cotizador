export interface Project {
  id?: number;
  title: string;
  crmCode?: string;
  client?: string;
  activity?: string;
  startDate?: string;
  endDate?: string;
  businessManager?: string;
  businessUnit?: string;
  opsDomain?: string;
  country?: string;
  scope?: string;
  countries?: number[]; // IDs de países asociados (project_countries)
  iqp?: number;
  segmentation?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}