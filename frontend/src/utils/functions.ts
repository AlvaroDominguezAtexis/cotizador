// src/utils/functions.ts
// Funciones generales de cálculo para el proyecto Cotizador

/**
 * ============================
 *   TIPOS Y INTERFACES
 * ============================
 */

export type Allocation = {
  hours: number;
  country?: string | null;
  year?: number | string | null;
  profileType?: string | null;
  step?: string | null;
  deliverable?: string | null;
  workPackage?: string | null;
};

export type WorkPackageLite = { 
  dm?: number | string | null;
};

export type CostsInput = {
  /** Ingresos (TO: Turnover) del proyecto */
  revenue?: number;
  /** Costes totales de personal (si ya vienen agregados) */
  personnel?: number;
  /** Otros costes (viajes, subcontrata, IT, etc.) */
  nonPersonnel?: number;
};

export type FinancialKPIs = {
  revenue: number;
  costTotal: number;
  hourlyPriceCalc: number;
  hourlyCostCalc: number;
  gm: number; // Gross Margin como decimal (0.1 = 10%)
};

/**
 * ============================
 *   FUNCIONES DE PROYECTO
 * ============================
 */

/**
 * Obtiene los años de un proyecto basándose en las fechas de inicio y fin
 * @param startDate - Fecha de inicio del proyecto (formato string)
 * @param endDate - Fecha de fin del proyecto (formato string)
 * @returns Array de años del proyecto
 */
export const getProjectYears = (startDate?: string, endDate?: string): number[] => {
  if (!startDate || !endDate) return [];
  const startYear = new Date(startDate).getFullYear();
  const endYear = new Date(endDate).getFullYear();
  if (isNaN(startYear) || isNaN(endYear)) return [];
  if (endYear < startYear) return [];
  return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
};

/**
 * ============================
 *   FUNCIONES FTE
 * ============================
 */

/**
 * Convención solicitada: FTE = horasTotales / 1600
 * @param totalHours - Total de horas
 * @returns FTE calculado
 */
export const computeFTE = (totalHours: number): number => totalHours / 1600;

/**
 * Calcula el total de horas desde allocations
 * @param allocations - Array de allocations con horas
 * @returns Total de horas
 */
export const calculateTotalHours = (allocations: Allocation[]): number => {
  return (allocations ?? []).reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
};

/**
 * Calcula el total de FTEs desde allocations
 * @param allocations - Array de allocations
 * @returns Total de FTEs
 */
export const calculateTotalFTEs = (allocations: Allocation[]): number => {
  const totalHours = calculateTotalHours(allocations);
  return computeFTE(totalHours);
};

/**
 * Agrega horas y convierte a FTE por una clave específica
 * @param rows - Array de allocations
 * @param key - Clave para agrupar (country, profileType, workPackage, etc.)
 * @returns Array de objetos con name, hours y fte agrupados
 */
export const aggregateFTE = <T extends Allocation>(
  rows: T[], 
  key: keyof Allocation
): Array<{ name: string; hours: number; fte: number }> => {
  const map = new Map<string, number>();
  for (const r of rows) {
    const kRaw = r[key];
    const k =
      kRaw === undefined || kRaw === null || kRaw === ""
        ? "(N/D)"
        : String(kRaw);
    map.set(k, (map.get(k) || 0) + (r.hours || 0));
  }
  return Array.from(map.entries())
    .map(([name, hours]) => ({ name, hours, fte: round(computeFTE(hours)) }))
    .sort((a, b) => b.fte - a.fte);
};

/**
 * ============================
 *   FUNCIONES FINANCIERAS
 * ============================
 */

/**
 * Calcula KPIs financieros básicos
 * @param params - Parámetros de costes e ingresos
 * @returns Objeto con KPIs financieros calculados
 */
export const calculateFinancialKPIs = (params: {
  costs?: CostsInput;
  totalHours: number;
  hourlyPrice?: number;
  hourlyCost?: number;
}): FinancialKPIs => {
  const { costs, totalHours, hourlyPrice, hourlyCost } = params;
  const hasHours = totalHours > 0;

  // Calcular revenue
  const revenueInput =
    costs?.revenue ??
    (hourlyPrice && hasHours ? hourlyPrice * totalHours : undefined);

  // Calcular costes totales
  const personnel = costs?.personnel ?? 0;
  const nonPersonnel = costs?.nonPersonnel ?? 0;
  
  const costInput =
    personnel + nonPersonnel > 0
      ? personnel + nonPersonnel
      : (hourlyCost && hasHours ? hourlyCost * totalHours : undefined);

  // Calcular ratios por hora
  const hp = hasHours && revenueInput != null ? revenueInput / totalHours : undefined;
  const hc = hasHours && costInput != null ? costInput / totalHours : undefined;

  // Calcular Gross Margin
  const gmVal =
    revenueInput != null && costInput != null && revenueInput !== 0
      ? (revenueInput - costInput) / revenueInput
      : undefined;

  return {
    revenue: revenueInput ?? 0,
    costTotal: costInput ?? 0,
    hourlyPriceCalc: hp ?? 0,
    hourlyCostCalc: hc ?? 0,
    gm: gmVal ?? 0,
  };
};

/**
 * Calcula el precio por hora del proyecto
 * @param operationalRevenue - Ingresos operacionales totales
 * @param totalWorkingTime - Tiempo total de trabajo
 * @returns Precio por hora calculado
 */
export const calculateHourlyPrice = (
  operationalRevenue: number,
  totalWorkingTime: number
): number => {
  return totalWorkingTime > 0 ? Number((operationalRevenue / totalWorkingTime).toFixed(2)) : 0;
};

/**
 * Calcula el coste por hora del proyecto
 * @param totalCosts - Costes totales
 * @param totalWorkingTime - Tiempo total de trabajo
 * @returns Coste por hora calculado
 */
export const calculateHourlyCost = (
  totalCosts: number,
  totalWorkingTime: number
): number => {
  return totalWorkingTime > 0 ? Number((totalCosts / totalWorkingTime).toFixed(2)) : 0;
};

/**
 * ============================
 *   FUNCIONES DE MÁRGENES
 * ============================
 */

/**
 * Calcula Direct Margin (DM) - Margen Directo
 * Fórmula: DM = (1 - (operationalCosts / operationalTO)) * 100
 * @param operationalCosts - Costes operacionales
 * @param operationalTO - Total Offer operacional
 * @returns DM como porcentaje
 */
export const calculateDirectMargin = (
  operationalCosts: number,
  operationalTO: number
): number => {
  if (operationalTO <= 0) return 0;
  return Number(((1 - (operationalCosts / operationalTO)) * 100).toFixed(2));
};

/**
 * Calcula GMBS (Gross Margin Before Subcontracting)
 * Fórmula: GMBS = (1 - (opCost + nopCost) / TO) * 100
 * @param operationalCosts - Costes operacionales
 * @param nonOperationalCosts - Costes no operacionales
 * @param operationalTO - Total Offer operacional
 * @returns GMBS como porcentaje
 */
export const calculateGMBS = (
  operationalCosts: number,
  nonOperationalCosts: number,
  operationalTO: number
): number => {
  if (operationalTO <= 0) return 0;
  return Number(((1 - ((operationalCosts + nonOperationalCosts) / operationalTO)) * 100).toFixed(2));
};

/**
 * Calcula DM total desde workPackages
 * @param workPackages - Array de workPackages con DM
 * @returns DM total sumado
 */
export const calculateTotalDM = (workPackages: WorkPackageLite[]): number => {
  return (workPackages ?? []).reduce((acc, wp) => acc + (Number(wp?.dm) || 0), 0);
};

/**
 * ============================
 *   FUNCIONES DE OPERATIONAL TO
 * ============================
 */

/**
 * Calcula Operational TO según el tipo de margen
 * @param params - Parámetros de cálculo
 * @returns Operational TO calculado
 */
export const calculateOperationalTO = (params: {
  marginType: 'DM' | 'GMBS';
  marginGoal: number; // Porcentaje (ej: 20 para 20%)
  opCostYear: number;
  nopCostYear: number;
}): number => {
  const { marginType, marginGoal, opCostYear, nopCostYear } = params;
  const mgFrac = marginGoal / 100; // Convertir a decimal

  if (marginType === 'DM') {
    const denom = 1 - mgFrac;
    if (denom === 0) throw new Error('División por cero: margin_goal = 100%');
    return opCostYear / denom;
  } else if (marginType === 'GMBS') {
    const denom = 1 - mgFrac;
    if (denom === 0) throw new Error('División por cero: margin_goal = 100%');
    return (opCostYear + nopCostYear) / denom;
  } else {
    throw new Error('Unknown margin_type');
  }
};

/**
 * ============================
 *   FUNCIONES DE COSTES
 * ============================
 */

/**
 * Calcula FTE basado en process_time y annual_hours
 * @param processTime - Tiempo de proceso en horas
 * @param annualHours - Horas anuales
 * @returns FTE calculado
 */
export const calculateStepFTE = (processTime: number, annualHours: number): number => {
  return annualHours > 0 ? processTime / annualHours : 0;
};

/**
 * Calcula salario por hora con contribuciones sociales
 * @param yearlySalary - Salario anual
 * @param socialContributionRate - Tasa de contribuciones sociales (%)
 * @param annualHours - Horas anuales
 * @returns Salario por hora calculado
 */
export const calculateHourlyRate = (
  yearlySalary: number,
  socialContributionRate: number,
  annualHours: number
): number => {
  const adjustedYearlySalary = yearlySalary * (1 + socialContributionRate / 100);
  return annualHours > 0 ? adjustedYearlySalary / annualHours : 0;
};

/**
 * Calcula coste de salarios de un step
 * @param processHours - Horas de proceso
 * @param hourlyRate - Tasa por hora
 * @returns Coste de salarios
 */
export const calculateSalariesCost = (processHours: number, hourlyRate: number): number => {
  return processHours * hourlyRate;
};

/**
 * Calcula coste de gestión
 * @param processHours - Horas de proceso
 * @param managementHourlyRate - Tasa de gestión por hora
 * @param managementPercentage - Porcentaje de gestión
 * @returns Coste de gestión
 */
export const calculateManagementCost = (
  processHours: number,
  managementHourlyRate: number,
  managementPercentage: number
): number => {
  return processHours * managementHourlyRate * (managementPercentage / 100);
};

/**
 * Calcula coste de instalaciones (premises)
 * @param params - Parámetros de cálculo
 * @returns Coste de instalaciones
 */
export const calculatePremisesCost = (params: {
  processHours: number;
  managementPercentage: number;
  nptRate: number; // Non-Productive Time rate
  premisesRate: number;
}): number => {
  const { processHours, managementPercentage, nptRate, premisesRate } = params;
  const denom = 1 - (nptRate / 100);
  
  if (denom <= 0) {
    console.warn('Invalid NPT rate (>=100%), returning 0 for premises cost');
    return 0;
  }

  // Formula: process_time * (1 + mng/100) / (1 - npt_rate/100) * premises_rate
  return processHours * (1 + managementPercentage / 100) / denom * premisesRate;
};

/**
 * ============================
 *   FUNCIONES DE UTILIDAD
 * ============================
 */

/**
 * Redondea un número a los decimales especificados
 * @param value - Valor a redondear
 * @param decimals - Número de decimales (por defecto 2)
 * @returns Valor redondeado
 */
export const round = (value: number, decimals: number = 2): number => {
  return Number(value.toFixed(decimals));
};

/**
 * Redondea con precisión matemática
 * @param n - Número a redondear
 * @returns Número redondeado a 2 decimales
 */
export const round2 = (n: number): number => {
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

/**
 * Convierte días a horas basándose en las horas por día
 * @param days - Número de días
 * @param hoursPerDay - Horas por día
 * @returns Horas totales
 */
export const convertDaysToHours = (days: number, hoursPerDay: number): number => {
  return days * hoursPerDay;
};

/**
 * Convierte process_time a horas según la unidad
 * @param processTime - Tiempo de proceso
 * @param unit - Unidad ('days' o 'hours')
 * @param hoursPerDay - Horas por día (por defecto 8)
 * @returns Proceso en horas
 */
export const convertProcessTimeToHours = (
  processTime: number,
  unit: string,
  hoursPerDay: number = 8
): number => {
  const normalizedUnit = String(unit || '').toLowerCase();
  return normalizedUnit === 'days' ? processTime * hoursPerDay : processTime;
};

/**
 * Calcula las horas anuales basándose en working_days y hours_per_day
 * @param workingDays - Días laborables por año
 * @param hoursPerDay - Horas por día
 * @returns Horas anuales
 */
export const calculateAnnualHours = (workingDays: number, hoursPerDay: number): number => {
  return workingDays * hoursPerDay;
};

/**
 * Valida si un valor es un número válido y mayor que cero
 * @param value - Valor a validar
 * @returns true si es válido
 */
export const isValidPositiveNumber = (value: any): boolean => {
  const num = Number(value);
  return !isNaN(num) && num > 0;
};

/**
 * Formatea un número como moneda EUR
 * @param value - Valor numérico
 * @param options - Opciones de formato adicionales
 * @returns String formateado como moneda
 */
export const formatCurrency = (value: number, options: Intl.NumberFormatOptions = {}): string => {
  return value.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
    ...options
  });
};

/**
 * Formatea un número como porcentaje
 * @param value - Valor decimal (0.1 = 10%)
 * @param decimals - Decimales a mostrar (por defecto 1)
 * @returns String formateado como porcentaje
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * ============================
 *   FUNCIONES AGREGADAS
 * ============================
 */

/**
 * Calcula múltiples KPIs de proyecto de una sola vez
 * @param params - Parámetros completos del proyecto
 * @returns Objeto con todos los KPIs calculados
 */
export const calculateProjectKPIs = (params: {
  allocations?: Allocation[];
  costs?: CostsInput;
  workPackages?: WorkPackageLite[];
  hourlyPrice?: number;
  hourlyCost?: number;
  totalHoursOverride?: number;
  operationalRevenue?: number;
  totalWorkingTime?: number;
}) => {
  const {
    allocations = [],
    costs,
    workPackages = [],
    hourlyPrice,
    hourlyCost,
    totalHoursOverride,
    operationalRevenue = 0,
    totalWorkingTime = 0
  } = params;

  // Calcular horas y FTEs
  const totalHours = totalHoursOverride ?? calculateTotalHours(allocations);
  const totalFTEs = computeFTE(totalHours);

  // Calcular KPIs financieros
  const financialKPIs = calculateFinancialKPIs({
    costs,
    totalHours,
    hourlyPrice,
    hourlyCost
  });

  // Calcular DM total
  const totalDM = calculateTotalDM(workPackages);

  // Calcular precios por hora si hay datos
  const calculatedHourlyPrice = totalWorkingTime > 0 
    ? calculateHourlyPrice(operationalRevenue, totalWorkingTime) 
    : financialKPIs.hourlyPriceCalc;

  const calculatedHourlyCost = totalWorkingTime > 0 
    ? calculateHourlyCost(financialKPIs.costTotal, totalWorkingTime)
    : financialKPIs.hourlyCostCalc;

  return {
    // Horas y FTEs
    totalHours,
    totalFTEs,
    
    // KPIs financieros
    ...financialKPIs,
    
    // Precios por hora calculados
    hourlyPriceCalc: calculatedHourlyPrice,
    hourlyCostCalc: calculatedHourlyCost,
    
    // Márgenes
    totalDM,
    
    // Ingresos operacionales
    operationalRevenue,
    
    // Utilidades
    hasValidData: totalHours > 0 || operationalRevenue > 0
  };
};