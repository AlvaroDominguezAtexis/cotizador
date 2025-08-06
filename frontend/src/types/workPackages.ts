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
  name: string;
  margin?: number;
  yearlyQuantities?: number[]; // Ej: [10, 15, 20]
  steps: Step[];
}

/** Work Package completo */
export interface WorkPackage {
  id: number;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  deliverables: Deliverable[];
}
