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
  buLine?: string;
  opsDomain?: string;
  country?: string;
  countries?: number[]; // IDs de países asociados (project_countries)
  iqp?: number;
  margin_type?: 'DM' | 'GMBS' | string;
  margin_goal?: number;
  segmentation?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}