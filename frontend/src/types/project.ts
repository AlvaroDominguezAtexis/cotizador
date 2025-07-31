// Tipos para la estructura del proyecto
import { License } from './license'

export interface ProjectData {
  id?: number;
  title: string;
  crmCode: string;
  client: string;
  activity: string;
  startDate: string;
  endDate: string;
  businessManager: string;
  businessUnit: string;
  buLine: string;
  opsDomain: string;
  country: string;
  scope: 'local' | 'transnational';
  additionalCountries?: string[];
  iqp: number;
  segmentation: string;
  description?: string;
  licenses?: License[];
}


// Tipos auxiliares para cálculos y resúmenes
export interface ProjectSummary {
  totalWorkPackages: number;
  totalDeliverables: number;
  totalSteps: number;
}

export interface WorkPackageSummary {
  workPackageId: number;
  name: string;
  deliverableCount: number;
  stepCount: number;
  averageMargin: number;
}

export interface DeliverableSummary {
  deliverableId: number;
  name: string;
  stepCount: number;
  margin: number;
}