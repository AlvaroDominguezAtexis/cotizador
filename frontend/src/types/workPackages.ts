// src/types/workPackages.ts

/** Licencia asociada a un Step */
export interface StepLicense {
  id: number;
  name: string;
  cost: number;
  assigned: boolean;
}

/** Paso dentro de un Deliverable */
export interface Step {
  id: number;
  name: string;
  profile: string;      // 🔹 Nombre del perfil seleccionado
  country: string;      // 🔹 País
  processTime: number;  // 🔹 Tiempo de proceso
  units: 'Hours' | 'Days' | 'Months';
  office: 'Yes' | 'No';
  mngPercent: number;   // 🔹 Porcentaje de gestión
  licenses: any[];      // Mantener si ya lo tenías
}

/** Entregable dentro de un Work Package */
export interface Deliverable {
  id: number;
  code?: string; // Código identificador del deliverable
  name: string;
  dm?: number; // Valor numérico (antes margin) alineado con backend
  DM?: string; // Delivery Manager nombre (solo frontend, no persistido)
  yearlyQuantities?: number[]; // Ej: [10, 15, 20]
  steps: Step[];
}

/** Work Package completo */
export interface WorkPackage {
  id: number;
  code?: string; // Código identificador del work package
  name: string;
  DM?: string; // Delivery Manager responsable
  description?: string;
  startDate?: string;
  endDate?: string;
  deliverables: Deliverable[];
}
