// src/utils/functions.ts
// Funciones generales de cálculo para el proyecto Cotizador

/**
 * ============================
 *   EJEMPLOS DE USO
 * ============================
 * 
 * // Calcular horas anuales con activity_rate:
 * const annualHours = calculateAnnualHours(216, 8, 85); // 1468.8 horas
 * 
 * // Calcular FTE de un step:
 * const fte = calculateStepFTE(100, 1468.8); // 0.068 FTE
 * 
 * // Calcular FTE completo con configuración de país:
 * const config = { working_days: 216, hours_per_day: 8, activity_rate: 85 };
 * const completeFTE = calculateStepFTEComplete(12.5, 'days', config, 8); // FTE calculado
 * 
 * // Calcular tasa de gestión por hora:
 * const mgmtRate = calculateManagementHourlyRate(50000, 30, 1468.8); // €44.26/hora
 * 
 * // Coste de gestión básico (si ya tienes los valores calculados):
 * const basicMgmtCost = calculateManagementCost(160, 44.26, 15); // €1063.2
 * 
 * // Coste de gestión completo (desde datos básicos) - AHORA USA TOTAL PROCESS TIME:
 * const completeMgmtCost = calculateManagementCostComplete({
 *   processTime: 20, processTimeUnit: 'days', managementYearlySalary: 50000,
 *   socialContributionRate: 30, managementPercentage: 15, countryConfig: config, nptRate: 20
 * }); // Retorna: {managementCost, managementHourlyRate, processHours, totalProcessTimeHours, annualHours}
 * 
 * // Total Process Time (ajustado por gestión y tiempo no productivo):
 * const totalProcessTime = calculateTotalProcessTime(100, 15, 20); // 133.33 horas
 * 
 * // Total Process Time completo con conversión de unidades:
 * const totalProcessComplete = calculateTotalProcessTimeComplete(10, 'days', 8, 15, 20);
 * // Retorna: {totalProcessTime: 13.33 days, totalProcessTimeHours: 106.67 hours, ...}
 * 
 * // NPT Costs (Non-Productive Time Costs):
 * const nptCosts = calculateNPTCosts(106.67, 50, 20); // €1066.7
 * 
 * // NPT Costs completo desde datos básicos:
 * const nptCostsComplete = calculateNPTCostsComplete({
 *   processTime: 10, processTimeUnit: 'days', hoursPerDay: 8, mngPercentage: 15, 
 *   nptRate: 20, salary: 40000, socialContributionRate: 25, workingDays: 220, activityRate: 85
 * }); // Retorna: {nptCosts, totalProcessTimeHours, hourlyRate, nptRate}
 * 
 * 
 * // NPT Costs: totalProcessTimeHours × hourlyRate × (npt_rate/100)
 * 
 * // Premises Cost (nueva fórmula):
 * const premisesCost = calculatePremisesCost({
 *   premisesRate: 5.2, // Valor de project_countries.premises_rate para el país del step
 *   totalDays: 365, // Valor de project_countries.total_days para el país del step
 *   workingDays: 216, activityRate: 85, totalProcessTimeHours: 106.67
 * }); // €X según fórmula: premisesRate × (total_days/(working_days×activity_rate/100)) × totalProcessTimeHours
 * 
 * // Premises Cost completo desde datos básicos:
 * const premisesCostComplete = calculatePremisesCostComplete({
 *   processTime: 10, processTimeUnit: 'days', hoursPerDay: 8, workingDays: 216,
 *   activityRate: 85, mngPercentage: 15, nptRate: 20, 
 *   premisesRate: 5.2, // De project_countries.premises_rate
 *   totalDays: 365 // De project_countries.total_days
 * }); // Calcula totalProcessTimeHours internamente
 * 
 * // Obtener horas anuales desde API:
 * const apiHours = await fetchAnnualHoursForCountry(projectId, countryId);
 * 
 * ============================
 */

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

export type CountryConfig = {
  working_days?: number | null;
  hours_per_day?: number | null;
  activity_rate?: number | null;
  country_id?: number;
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
 * Calcula FTE de un step completo con configuración de país
 * @param processTime - Tiempo de proceso
 * @param unit - Unidad del tiempo ('days' o 'hours')
 * @param countryConfig - Configuración del país
 * @param hoursPerDay - Horas por día para conversión (por defecto 8)
 * @returns FTE calculado
 */
export const calculateStepFTEComplete = (
  processTime: number,
  unit: string,
  countryConfig: CountryConfig,
  hoursPerDay: number = 8
): number => {
  // Convertir process_time a horas si es necesario
  const processHours = convertProcessTimeToHours(processTime, unit, hoursPerDay);
  
  // Calcular horas anuales incluyendo activity_rate
  const annualHours = calculateAnnualHoursFromConfig(countryConfig);
  
  // Calcular FTE
  return calculateStepFTE(processHours, annualHours);
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
 * Calcula la tasa de gestión por hora (managementHourlyRate)
 * Fórmula: (management_yearly_salary * (1 + social_contribution_rate/100)) / annual_hours
 * @param managementYearlySalary - Salario anual de gestión del país
 * @param socialContributionRate - Tasa de contribuciones sociales (%)
 * @param annualHours - Horas anuales (ya incluye activity_rate)
 * @returns Tasa de gestión por hora
 */
export const calculateManagementHourlyRate = (
  managementYearlySalary: number,
  socialContributionRate: number,
  annualHours: number
): number => {
  if (annualHours <= 0) return 0;
  const adjustedYearlySalary = managementYearlySalary * (1 + socialContributionRate / 100);
  return adjustedYearlySalary / annualHours;
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
 * Calcula NPT Costs (Non-Productive Time Costs)
 * Fórmula: totalProcessTimeHours × hourlyRate × (npt_rate/100)
 * 
 * INTEGRACIÓN CON BD:
 * - Este coste debe almacenarse en step_yearly_data.npt_costs
 * - Se ejecuta junto con cálculos de costes salariales y management
 * - Requiere Total Process Time (que usa mng + npt_rate)
 * 
 * @param totalProcessTimeHours - Total Process Time en horas
 * @param hourlyRate - Tasa por hora del perfil (salary + social contributions / annual hours)
 * @param nptRate - Tasa de tiempo no productivo (npt_rate de project_countries)
 * @returns NPT Costs calculado
 */
export const calculateNPTCosts = (
  totalProcessTimeHours: number,
  hourlyRate: number,
  nptRate: number
): number => {
  // Validaciones para debugging
  if (!totalProcessTimeHours || totalProcessTimeHours <= 0) {
    console.warn('NPT Costs: totalProcessTimeHours is invalid:', totalProcessTimeHours);
    return 0;
  }
  
  if (!hourlyRate || hourlyRate <= 0) {
    console.warn('NPT Costs: hourlyRate is invalid:', hourlyRate);
    return 0;
  }
  
  if (nptRate === null || nptRate === undefined || nptRate < 0) {
    console.warn('NPT Costs: nptRate is invalid:', nptRate);
    return 0;
  }
  
  const result = totalProcessTimeHours * hourlyRate * (nptRate / 100);
  
  // Debug logging
  console.log(`NPT Costs Debug:
    - totalProcessTimeHours: ${totalProcessTimeHours}
    - hourlyRate: ${hourlyRate}
    - nptRate: ${nptRate}%
    - calculation: ${totalProcessTimeHours} × ${hourlyRate} × (${nptRate}/100) = ${result}`);
  
  return result;
};

/**
 * FUNCIÓN DE TESTING PARA MANAGEMENT COSTS
 * Usa esta función para verificar que los cálculos de management cost son correctos
 * @param params - Parámetros de testing
 * @returns Objeto con todos los valores calculados y esperados
 */
export const testManagementCosts = (params: {
  processTime: number;
  processTimeUnit: string;
  managementYearlySalary: number;
  socialContributionRate: number;
  managementPercentage: number;
  workingDays: number;
  hoursPerDay: number;
  activityRate: number;
  nptRate: number;
}): {
  calculations: any;
  expectedManagementCost: number;
  actualManagementCost: number;
  isCorrect: boolean;
} => {
  const {
    processTime,
    processTimeUnit,
    managementYearlySalary,
    socialContributionRate,
    managementPercentage,
    workingDays,
    hoursPerDay,
    activityRate,
    nptRate
  } = params;

  // Cálculo manual paso a paso
  const annualHours = workingDays * hoursPerDay * (activityRate / 100);
  const managementHourlyRate = (managementYearlySalary * (1 + socialContributionRate / 100)) / annualHours;
  const processHours = processTimeUnit.toLowerCase() === 'days' ? processTime * hoursPerDay : processTime;
  
  // Calcular Total Process Time manualmente
  const denominator = 1 - (managementPercentage / 100) - (nptRate / 100);
  const totalProcessTimeHours = processHours / denominator;
  
  const expectedManagementCost = totalProcessTimeHours * managementHourlyRate * (managementPercentage / 100);

  // Cálculo usando la función
  const countryConfig: CountryConfig = {
    working_days: workingDays,
    hours_per_day: hoursPerDay,
    activity_rate: activityRate
  };

  const result = calculateManagementCostComplete({
    processTime,
    processTimeUnit,
    managementYearlySalary,
    socialContributionRate,
    managementPercentage,
    countryConfig,
    hoursPerDay,
    nptRate
  });

  const calculations = {
    annualHours,
    managementHourlyRate,
    processHours,
    totalProcessTimeHours,
    denominator,
    expectedManagementCost,
    actualResult: result
  };

  console.log('=== MANAGEMENT COST TEST ===');
  console.log('Parámetros:', params);
  console.log('Annual Hours:', annualHours);
  console.log('Management Hourly Rate:', managementHourlyRate);
  console.log('Process Hours:', processHours);
  console.log('Denominator (1 - mng% - npt%):', denominator);
  console.log('Total Process Time Hours:', totalProcessTimeHours);
  console.log('Expected Management Cost:', expectedManagementCost);
  console.log('Actual Management Cost:', result.managementCost);
  console.log('Difference:', Math.abs(expectedManagementCost - result.managementCost));
  
  return {
    calculations,
    expectedManagementCost,
    actualManagementCost: result.managementCost,
    isCorrect: Math.abs(expectedManagementCost - result.managementCost) < 0.01
  };
};

/**
 * FUNCIÓN DE DEBUGGING PARA NPT COSTS
 * Usa esta función para diagnosticar por qué npt_costs aparece vacío
 * @param params - Todos los parámetros necesarios para el cálculo
 * @returns Objeto con todos los valores intermedios para debugging
 */
export const debugNPTCosts = (params: {
  processTime: number;
  processTimeUnit: string;
  hoursPerDay: number;
  mngPercentage: number;
  nptRate: number;
  salary: number;
  socialContributionRate: number;
  workingDays: number;
  activityRate: number;
}): {
  inputParams: any;
  annualHours: number;
  hourlyRate: number;
  totalProcessTimeResult: any;
  nptCosts: number;
  allCalculationsValid: boolean;
  issues: string[];
} => {
  const issues: string[] = [];
  
  console.log('=== NPT COSTS DEBUGGING ===');
  console.log('Input parameters:', params);
  
  // Validar parámetros de entrada
  if (params.nptRate === null || params.nptRate === undefined) {
    issues.push('nptRate is null or undefined');
  }
  if (params.processTime <= 0) {
    issues.push('processTime is invalid');
  }
  if (params.salary <= 0) {
    issues.push('salary is invalid');
  }
  
  // Calcular paso a paso
  const annualHours = calculateAnnualHours(params.workingDays, params.hoursPerDay, params.activityRate);
  console.log('Annual hours calculated:', annualHours);
  
  const hourlyRate = calculateHourlyRate(params.salary, params.socialContributionRate, annualHours);
  console.log('Hourly rate calculated:', hourlyRate);
  
  const totalProcessTimeResult = calculateTotalProcessTimeComplete(
    params.processTime,
    params.processTimeUnit,
    params.hoursPerDay,
    params.mngPercentage,
    params.nptRate
  );
  console.log('Total Process Time result:', totalProcessTimeResult);
  
  const nptCosts = calculateNPTCosts(
    totalProcessTimeResult.totalProcessTimeHours,
    hourlyRate,
    params.nptRate
  );
  console.log('Final NPT Costs:', nptCosts);
  
  return {
    inputParams: params,
    annualHours,
    hourlyRate,
    totalProcessTimeResult,
    nptCosts,
    allCalculationsValid: issues.length === 0,
    issues
  };
};

/**
 * Calcula NPT Costs completo desde datos básicos del step
 * Combina el cálculo de Total Process Time + Hourly Rate + NPT Costs
 * @param params - Parámetros completos para el cálculo
 * @returns Objeto con NPT Costs y datos intermedios
 */
export const calculateNPTCostsComplete = (params: {
  processTime: number;
  processTimeUnit: string;
  hoursPerDay: number;
  mngPercentage: number;
  nptRate: number;
  salary: number;
  socialContributionRate: number;
  workingDays: number;
  activityRate: number;
}): {
  nptCosts: number;
  totalProcessTimeHours: number;
  hourlyRate: number;
  nptRate: number;
} => {
  const {
    processTime,
    processTimeUnit,
    hoursPerDay,
    mngPercentage,
    nptRate,
    salary,
    socialContributionRate,
    workingDays,
    activityRate
  } = params;

  // 1. Calcular Total Process Time
  const totalProcessTimeResult = calculateTotalProcessTimeComplete(
    processTime,
    processTimeUnit,
    hoursPerDay,
    mngPercentage,
    nptRate
  );

  // 2. Calcular Hourly Rate (salario + contribuciones sociales / horas anuales)
  const annualHours = calculateAnnualHours(workingDays, hoursPerDay, activityRate);
  const hourlyRate = calculateHourlyRate(salary, socialContributionRate, annualHours);

  // 3. Calcular NPT Costs
  const nptCosts = calculateNPTCosts(
    totalProcessTimeResult.totalProcessTimeHours,
    hourlyRate,
    nptRate
  );

  return {
    nptCosts,
    totalProcessTimeHours: totalProcessTimeResult.totalProcessTimeHours,
    hourlyRate,
    nptRate
  };
};

/**
 * Calcula coste de gestión (función básica/atómica)
 * Usar cuando ya tienes processHours y managementHourlyRate calculados
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
 * Calcula el coste de gestión completo con todos los parámetros (función de alto nivel)
 * Usar cuando partes de datos básicos (processTime, salario anual, etc.)
 * 
 * IMPORTANTE: El coste de gestión se calcula sobre Total Process Time Hours.
 * 
 * Fórmula: Management Cost = Total Process Time Hours × Management Hourly Rate × (mng/100)
 * Donde Total Process Time = process_time / (1 - mng/100 - npt_rate/100)
 * 
 * Internamente usa calculateManagementCost + calculateTotalProcessTime + otros cálculos auxiliares
 * @param params - Parámetros completos para el cálculo (incluyendo nptRate)
 * @returns Objeto con el coste de gestión y datos intermedios (incluyendo totalProcessTimeHours)
 */
export const calculateManagementCostComplete = (params: {
  processTime: number;
  processTimeUnit: string;
  managementYearlySalary: number;
  socialContributionRate: number;
  managementPercentage: number;
  countryConfig: CountryConfig;
  hoursPerDay?: number;
  nptRate: number;
}): {
  managementCost: number;
  managementHourlyRate: number;
  processHours: number;
  totalProcessTimeHours: number;
  annualHours: number;
} => {
  const { 
    processTime, 
    processTimeUnit, 
    managementYearlySalary, 
    socialContributionRate, 
    managementPercentage, 
    countryConfig,
    hoursPerDay = 8,
    nptRate 
  } = params;

  // 1. Convertir process_time a horas (para referencia)
  const processHours = convertProcessTimeToHours(processTime, processTimeUnit, hoursPerDay);
  
  // 2. Calcular Total Process Time (nueva implementación)
  const totalProcessTimeResult = calculateTotalProcessTimeComplete(
    processTime,
    processTimeUnit,
    hoursPerDay,
    managementPercentage,
    nptRate
  );
  
  // 3. Calcular horas anuales (incluye activity_rate)
  const annualHours = calculateAnnualHoursFromConfig(countryConfig);
  
  // 4. Calcular tasa de gestión por hora
  const managementHourlyRate = calculateManagementHourlyRate(
    managementYearlySalary, 
    socialContributionRate, 
    annualHours
  );
  
  // 5. Calcular coste de gestión usando Total Process Time Hours
  // Management Cost = Total Process Time Hours × Management Hourly Rate × (mng/100)
  const managementCost = calculateManagementCost(
    totalProcessTimeResult.totalProcessTimeHours, 
    managementHourlyRate, 
    managementPercentage
  );

  return {
    managementCost,
    managementHourlyRate,
    processHours,
    totalProcessTimeHours: totalProcessTimeResult.totalProcessTimeHours,
    annualHours
  };
};

/**
 * Calcula el Total Process Time ajustado por gestión y tiempo no productivo
 * 
 * Esta función implementa la fórmula que ajusta el tiempo de proceso base
 * considerando el porcentaje de gestión y el tiempo no productivo.
 * 
 * Fórmula: process_time / (1 - mng/100 - npt_rate/100)
 * 
 * Donde:
 * - mng viene de la columna mng de step_yearly_data
 * - npt_rate viene de project_countries para el país del step
 * 
 * @param processTime - Tiempo de proceso base
 * @param mngPercentage - Porcentaje de gestión (mng de step_yearly_data)
 * @param nptRate - Tasa de tiempo no productivo (npt_rate de project_countries)
 * @returns Total Process Time calculado
 */
export const calculateTotalProcessTime = (
  processTime: number,
  mngPercentage: number,
  nptRate: number
): number => {
  // Validaciones de entrada
  if (!processTime || processTime <= 0) {
    console.warn('Total Process Time: processTime is invalid:', processTime);
    return 0;
  }
  
  if (mngPercentage === null || mngPercentage === undefined || mngPercentage < 0) {
    console.warn('Total Process Time: mngPercentage is invalid:', mngPercentage);
    return processTime; // Devolver processTime original si no hay gestión
  }
  
  if (nptRate === null || nptRate === undefined || nptRate < 0) {
    console.warn('Total Process Time: nptRate is invalid:', nptRate);
    return processTime; // Devolver processTime original si no hay NPT
  }
  
  // Calcular denominador: 1 - mng/100 - npt_rate/100
  const denominator = 1 - (mngPercentage / 100) - (nptRate / 100);
  
  // Debug logging
  console.log(`Total Process Time Debug:
    - processTime: ${processTime}
    - mngPercentage: ${mngPercentage}%
    - nptRate: ${nptRate}%
    - denominator: 1 - (${mngPercentage}/100) - (${nptRate}/100) = ${denominator}`);
  
  // Validar que el denominador sea positivo
  if (denominator <= 0) {
    console.warn(`Invalid denominator for Total Process Time calculation: ${denominator}. mng: ${mngPercentage}%, npt_rate: ${nptRate}%`);
    return 0;
  }
  
  // Calcular Total Process Time
  const totalProcessTime = processTime / denominator;
  
  console.log(`Total Process Time Result: ${processTime} / ${denominator} = ${totalProcessTime}`);
  
  return totalProcessTime;
};

/**
 * Calcula el Total Process Time completo con conversión de unidades
 * @param processTime - Tiempo de proceso
 * @param processTimeUnit - Unidad del tiempo ('days' o 'hours')
 * @param hoursPerDay - Horas por día para conversión (por defecto 8)
 * @param mngPercentage - Porcentaje de gestión (mng de step_yearly_data)
 * @param nptRate - Tasa de tiempo no productivo (npt_rate de project_countries)
 * @returns Objeto con Total Process Time en horas y en la unidad original
 */
export const calculateTotalProcessTimeComplete = (
  processTime: number,
  processTimeUnit: string,
  hoursPerDay: number = 8,
  mngPercentage: number,
  nptRate: number
): {
  totalProcessTime: number;
  totalProcessTimeHours: number;
  processTimeUnit: string;
  denominator: number;
} => {
  // 1. Calcular Total Process Time en la unidad original
  const totalProcessTime = calculateTotalProcessTime(processTime, mngPercentage, nptRate);
  
  // 2. Convertir a horas si es necesario
  const totalProcessTimeHours = processTimeUnit.toLowerCase() === 'days' 
    ? totalProcessTime * hoursPerDay 
    : totalProcessTime;
  
  // 3. Calcular denominador para referencia/debugging
  const denominator = 1 - (mngPercentage / 100) - (nptRate / 100);
  
  return {
    totalProcessTime,
    totalProcessTimeHours,
    processTimeUnit,
    denominator
  };
};

/**
 * Calcula coste de instalaciones (premises)
 * Nueva fórmula: premisesRate * (total_days/(working_days*activity_rate/100)) * totalProcessTimeHours
 * 
 * IMPORTANTE: 
 * - premisesRate debe obtenerse de project_countries.premises_rate según el país del step
 * - totalDays debe obtenerse de project_countries.total_days según el país del step
 * 
 * @param params - Parámetros de cálculo
 * @returns Coste de instalaciones
 */
export const calculatePremisesCost = (params: {
  premisesRate: number; // Valor de project_countries.premises_rate para el país del step
  totalDays: number; // Valor de project_countries.total_days para el país del step
  workingDays: number;
  activityRate: number;
  totalProcessTimeHours: number;
}): number => {
  const { premisesRate, totalDays, workingDays, activityRate, totalProcessTimeHours } = params;
  
  // Validaciones
  if (workingDays <= 0) {
    console.warn('Invalid working days (<=0), returning 0 for premises cost');
    return 0;
  }
  
  if (activityRate <= 0) {
    console.warn('Invalid activity rate (<=0), returning 0 for premises cost');
    return 0;
  }
  
  if (totalProcessTimeHours <= 0) {
    console.warn('Invalid total process time hours (<=0), returning 0 for premises cost');
    return 0;
  }

  // Nueva fórmula: premisesRate * (total_days/(working_days*activity_rate/100)) * totalProcessTimeHours
  const denominator = workingDays * (activityRate / 100);
  const utilization = totalDays / denominator;
  const premisesCost = premisesRate * utilization * totalProcessTimeHours;
  
  // Debug logging
  console.log(`Premises Cost Debug:
    - premisesRate: ${premisesRate}
    - totalDays: ${totalDays}
    - workingDays: ${workingDays}
    - activityRate: ${activityRate}%
    - totalProcessTimeHours: ${totalProcessTimeHours}
    - denominator (workingDays * activityRate/100): ${denominator}
    - utilization (totalDays/denominator): ${utilization}
    - calculation: ${premisesRate} × ${utilization} × ${totalProcessTimeHours} = ${premisesCost}`);

  return premisesCost;
};

/**
 * Calcula coste de instalaciones usando los parámetros completos de un step
 * Función helper que calcula totalProcessTimeHours internamente
 * 
 * IMPORTANTE: 
 * - premisesRate debe obtenerse de project_countries.premises_rate para el país del step
 * - totalDays debe obtenerse de project_countries.total_days para el país del step
 * 
 * @param params - Parámetros completos del step
 * @returns Coste de instalaciones
 */
export const calculatePremisesCostComplete = (params: {
  processTime: number;
  processTimeUnit: string;
  hoursPerDay: number;
  workingDays: number;
  activityRate: number;
  mngPercentage: number;
  nptRate: number;
  premisesRate: number; // Valor de project_countries.premises_rate para el país del step
  totalDays: number; // Valor de project_countries.total_days para el país del step
}): number => {
  const {
    processTime,
    processTimeUnit,
    hoursPerDay,
    workingDays,
    activityRate,
    mngPercentage,
    nptRate,
    premisesRate,
    totalDays
  } = params;

  // Calculate Total Process Time Hours
  const totalProcessTimeResult = calculateTotalProcessTimeComplete(
    processTime,
    processTimeUnit,
    hoursPerDay,
    mngPercentage,
    nptRate
  );

  // Call the main premises cost function
  return calculatePremisesCost({
    premisesRate,
    totalDays,
    workingDays,
    activityRate,
    totalProcessTimeHours: totalProcessTimeResult.totalProcessTimeHours
  });
};

/**
 * Calcula coste de IT (Information Technology)
 * Misma fórmula que premises cost pero usando it_cost de project_countries
 * Fórmula: itCost * (total_days/(working_days*activity_rate/100)) * totalProcessTimeHours
 * 
 * IMPORTANTE: 
 * - itCost debe obtenerse de project_countries.it_cost según el país del step
 * - totalDays debe obtenerse de project_countries.total_days según el país del step
 * 
 * @param params - Parámetros de cálculo
 * @returns Coste de IT
 */
export const calculateItCost = (params: {
  itCost: number; // Valor de project_countries.it_cost para el país del step
  totalDays: number; // Valor de project_countries.total_days para el país del step
  workingDays: number;
  activityRate: number;
  totalProcessTimeHours: number;
}): number => {
  const { itCost, totalDays, workingDays, activityRate, totalProcessTimeHours } = params;
  
  // Validaciones
  if (workingDays <= 0) {
    console.warn('Invalid working days (<=0), returning 0 for IT cost');
    return 0;
  }
  
  if (activityRate <= 0) {
    console.warn('Invalid activity rate (<=0), returning 0 for IT cost');
    return 0;
  }
  
  if (totalProcessTimeHours <= 0) {
    console.warn('Invalid total process time hours (<=0), returning 0 for IT cost');
    return 0;
  }

  // Misma fórmula que premises cost: itCost * (total_days/(working_days*activity_rate/100)) * totalProcessTimeHours
  const denominator = workingDays * (activityRate / 100);
  const utilization = totalDays / denominator;
  const itCostResult = itCost * utilization * totalProcessTimeHours;
  
  // Debug logging
  console.log(`IT Cost Debug:
    - itCost: ${itCost}
    - totalDays: ${totalDays}
    - workingDays: ${workingDays}
    - activityRate: ${activityRate}%
    - totalProcessTimeHours: ${totalProcessTimeHours}
    - denominator (workingDays * activityRate/100): ${denominator}
    - utilization (totalDays/denominator): ${utilization}
    - calculation: ${itCost} × ${utilization} × ${totalProcessTimeHours} = ${itCostResult}`);

  return itCostResult;
};

/**
 * Calcula coste de IT usando los parámetros completos de un step
 * Función helper que calcula totalProcessTimeHours internamente
 * 
 * IMPORTANTE: 
 * - itCost debe obtenerse de project_countries.it_cost para el país del step
 * - totalDays debe obtenerse de project_countries.total_days para el país del step
 * 
 * @param params - Parámetros completos del step
 * @returns Coste de IT
 */
export const calculateItCostComplete = (params: {
  processTime: number;
  processTimeUnit: string;
  hoursPerDay: number;
  workingDays: number;
  activityRate: number;
  mngPercentage: number;
  nptRate: number;
  itCost: number; // Valor de project_countries.it_cost para el país del step
  totalDays: number; // Valor de project_countries.total_days para el país del step
}): number => {
  const {
    processTime,
    processTimeUnit,
    hoursPerDay,
    workingDays,
    activityRate,
    mngPercentage,
    nptRate,
    itCost,
    totalDays
  } = params;

  // Calculate Total Process Time Hours
  const totalProcessTimeResult = calculateTotalProcessTimeComplete(
    processTime,
    processTimeUnit,
    hoursPerDay,
    mngPercentage,
    nptRate
  );

  // Call the main IT cost function
  return calculateItCost({
    itCost,
    totalDays,
    workingDays,
    activityRate,
    totalProcessTimeHours: totalProcessTimeResult.totalProcessTimeHours
  });
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
 * Calcula las horas anuales basándose en working_days, hours_per_day y activity_rate
 * @param workingDays - Días laborables por año
 * @param hoursPerDay - Horas por día
 * @param activityRate - Tasa de actividad del país (en porcentaje, ej: 85 para 85%)
 * @returns Horas anuales ajustadas por la tasa de actividad
 */
export const calculateAnnualHours = (workingDays: number, hoursPerDay: number, activityRate: number): number => {
  return workingDays * hoursPerDay * (activityRate / 100);
};

/**
 * Calcula las horas anuales desde un objeto de configuración de país del proyecto
 * @param countryConfig - Configuración del país con working_days, hours_per_day, activity_rate
 * @returns Horas anuales calculadas
 */
export const calculateAnnualHoursFromConfig = (countryConfig: CountryConfig): number => {
  const workingDays = Number(countryConfig.working_days || 0);
  const hoursPerDay = Number(countryConfig.hours_per_day || 0);
  const activityRate = Number(countryConfig.activity_rate || 0);
  
  if (workingDays <= 0 || hoursPerDay <= 0 || activityRate <= 0) {
    return 0;
  }
  
  return calculateAnnualHours(workingDays, hoursPerDay, activityRate);
};

/**
 * Obtiene las horas anuales para un país específico del proyecto (frontend)
 * @param projectId - ID del proyecto
 * @param countryId - ID del país
 * @returns Promise con las horas anuales calculadas
 */
export const fetchAnnualHoursForCountry = async (projectId: number, countryId: number): Promise<number> => {
  try {
    // Hacer las tres consultas necesarias
    const [wdRes, hpdRes, arRes] = await Promise.all([
      fetch(`/projects/${projectId}/countries-working-days`),
      fetch(`/projects/${projectId}/countries-hours-per-day`),
      fetch(`/projects/${projectId}/countries-activity-rate`)
    ]);

    if (!wdRes.ok || !hpdRes.ok || !arRes.ok) {
      console.warn('Error fetching country configuration for annual hours calculation');
      return 0;
    }

    const [wdData, hpdData, arData] = await Promise.all([
      wdRes.json(),
      hpdRes.json(),
      arRes.json()
    ]);

    // Buscar los datos del país específico
    const countryWd = (wdData || []).find((item: any) => item.country_id === countryId);
    const countryHpd = (hpdData || []).find((item: any) => item.country_id === countryId);
    const countryAr = (arData || []).find((item: any) => item.country_id === countryId);

    const workingDays = Number(countryWd?.working_days || 0);
    const hoursPerDay = Number(countryHpd?.hours_per_day || 0);
    const activityRate = Number(countryAr?.activity_rate || 0);

    return calculateAnnualHours(workingDays, hoursPerDay, activityRate);
  } catch (error) {
    console.error('Error calculating annual hours:', error);
    return 0;
  }
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
 * Calcula working_days con validación para España
 * @param totalDays - Total de días del año
 * @param holidays - Días de vacaciones
 * @param countryName - Nombre del país para validaciones especiales
 * @returns Objeto con working_days calculado y información de validación
 */
export const calculateWorkingDaysWithValidation = (
  totalDays: number,
  holidays: number,
  countryName: string = 'Other'
): {
  workingDays: number;
  isValid: boolean;
  maxDays: number | null;
  warningMessage: string | null;
} => {
  let workingDays = totalDays - holidays;
  let isValid = true;
  let maxDays: number | null = null;
  let warningMessage: string | null = null;

  // Validación específica para España (máximo 216 días laborables)
  if (countryName === 'Spain' && workingDays > 216) {
    workingDays = 216;
    isValid = false;
    maxDays = 216;
    warningMessage = 'Para España, el máximo de días laborables es 216. Se ha ajustado automáticamente.';
  }

  // Validación general: no puede ser negativo
  if (workingDays < 0) {
    workingDays = 0;
    isValid = false;
    warningMessage = 'Los días laborables no pueden ser negativos.';
  }

  return {
    workingDays,
    isValid,
    maxDays,
    warningMessage
  };
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

// ================================
// FUNCIONES ADICIONALES DEL BACKEND CONSOLIDADAS
// ================================

/**
 * Calculate non-productive costs for a step
 * Formula: (salariesCost + managementCosts) * (nonProductiveRate / 100)
 * Non-productive rate = (100 - activity_rate)
 */
export function calculateNonProductiveCosts(
  salariesCost: number,
  managementCosts: number,
  activityRate: number
): number {
  const nonProductiveRate = 100 - activityRate;
  return (salariesCost + managementCosts) * (nonProductiveRate / 100);
}

/**
 * Calculate step salary cost components
 * Returns detailed breakdown of salary calculations
 */
export function calculateStepSalaryCostBreakdown(
  processTime: number,
  processTimeUnit: string,
  hoursPerDay: number,
  activityRate: number,
  workingDays: number,
  salary: number,
  socialContributionRate: number
): {
  annualHours: number;
  hourlyRate: number;
  processHours: number;
  salariesCost: number;
  grossHourlyRate: number;
} {
  // Calculate annual hours
  const annualHours = calculateAnnualHours(workingDays, hoursPerDay, activityRate);
  
  // Calculate gross hourly rate (salary + social contributions) / annual hours
  const grossHourlyRate = (salary * (1 + socialContributionRate / 100)) / annualHours;
  
  // Calculate process hours
  const processHours = processTimeUnit.toLowerCase() === 'days' ? processTime * hoursPerDay : processTime;
  
  // Calculate total salaries cost
  const salariesCost = processHours * grossHourlyRate;
  
  return {
    annualHours,
    hourlyRate: grossHourlyRate,
    processHours,
    salariesCost,
    grossHourlyRate
  };
}

/**
 * Calculate complete step costs breakdown
 * Combines all cost calculations for a step
 */
export function calculateStepCompleteBreakdown(
  processTime: number,
  processTimeUnit: string,
  hoursPerDay: number,
  workingDays: number,
  activityRate: number,
  salary: number,
  socialContributionRate: number,
  managementYearlySalary: number,
  mngPercentage: number,
  nptRate: number,
  premisesRate: number = 0
): {
  annualHours: number;
  salariesCost: number;
  managementCost: number;
  premisesCost: number;
  nonProductiveCosts: number;
  nptCosts: number;
  totalCost: number;
  fte: number;
  totalProcessTime: number;
  totalProcessTimeHours: number;
} {
  // Calculate annual hours
  const annualHours = calculateAnnualHours(workingDays, hoursPerDay, activityRate);
  
  // Calculate salary costs
  const salaryBreakdown = calculateStepSalaryCostBreakdown(
    processTime, 
    processTimeUnit, 
    hoursPerDay, 
    activityRate, 
    workingDays,
    salary, 
    socialContributionRate
  );
  
  // Create country config for calculations
  const countryConfig: CountryConfig = {
    working_days: workingDays,
    activity_rate: activityRate,
    hours_per_day: hoursPerDay
  };

  // Calculate management costs
  const managementCostResult = calculateManagementCostComplete({
    processTime,
    processTimeUnit,
    managementYearlySalary,
    socialContributionRate,
    managementPercentage: mngPercentage,
    countryConfig,
    hoursPerDay,
    nptRate
  });
  
  // Calculate Total Process Time first (needed for premises cost)
  const totalProcessTimeResult = calculateTotalProcessTimeComplete(
    processTime,
    processTimeUnit,
    hoursPerDay,
    mngPercentage,
    nptRate
  );

  // Calculate premises cost with new formula
  const premisesCost = calculatePremisesCost({
    premisesRate,
    totalDays: 365, // Total calendar days in year
    workingDays,
    activityRate,
    totalProcessTimeHours: totalProcessTimeResult.totalProcessTimeHours
  });
  
  // Calculate non-productive costs
  const nonProductiveCosts = calculateNonProductiveCosts(
    salaryBreakdown.salariesCost,
    managementCostResult.managementCost,
    activityRate
  );
  
  // Calculate NPT Costs (nuevo cálculo)
  const nptCosts = calculateNPTCosts(
    totalProcessTimeResult.totalProcessTimeHours,
    salaryBreakdown.hourlyRate,
    nptRate
  );
  
  // Calculate FTE
  const fte = calculateStepFTEComplete(
    processTime, 
    processTimeUnit, 
    countryConfig,
    hoursPerDay
  );
  
  // Calculate total cost (incluyendo NPT Costs)
  const totalCost = salaryBreakdown.salariesCost + managementCostResult.managementCost + premisesCost + nonProductiveCosts + nptCosts;
  
  return {
    annualHours,
    salariesCost: salaryBreakdown.salariesCost,
    managementCost: managementCostResult.managementCost,
    premisesCost,
    nonProductiveCosts,
    nptCosts,
    totalCost,
    fte,
    totalProcessTime: totalProcessTimeResult.totalProcessTime,
    totalProcessTimeHours: totalProcessTimeResult.totalProcessTimeHours
  };
}

/**
 * Calculate batch project costs for multiple steps and years
 * Utility function to process cost calculations for entire projects
 */
export function calculateBatchProjectCosts(
  steps: Array<{
    stepId: number;
    processTime: number;
    processTimeUnit: string;
    year: number;
    hoursPerDay: number;
    workingDays: number;
    activityRate: number;
    salary: number;
    socialContributionRate: number;
    managementYearlySalary: number;
    mngPercentage: number;
    nptRate: number;
    premisesRate?: number;
  }>
): Array<{
  stepId: number;
  year: number;
  salariesCost: number;
  managementCost: number;
  premisesCost: number;
  nonProductiveCosts: number;
  nptCosts: number;
  totalCost: number;
  fte: number;
  totalProcessTime: number;
  totalProcessTimeHours: number;
}> {
  return steps.map(step => {
    const breakdown = calculateStepCompleteBreakdown(
      step.processTime,
      step.processTimeUnit,
      step.hoursPerDay,
      step.workingDays,
      step.activityRate,
      step.salary,
      step.socialContributionRate,
      step.managementYearlySalary,
      step.mngPercentage,
      step.nptRate,
      step.premisesRate || 0
    );

    return {
      stepId: step.stepId,
      year: step.year,
      salariesCost: breakdown.salariesCost,
      managementCost: breakdown.managementCost,
      premisesCost: breakdown.premisesCost,
      nonProductiveCosts: breakdown.nonProductiveCosts,
      nptCosts: breakdown.nptCosts,
      totalCost: breakdown.totalCost,
      fte: breakdown.fte,
      totalProcessTime: breakdown.totalProcessTime,
      totalProcessTimeHours: breakdown.totalProcessTimeHours
    };
  });
}

/**
 * EXAMPLE: HOW TO GET PREMISES RATE FROM PROJECT_COUNTRIES
 * Demonstrates the correct way to obtain premisesRate for calculations
 */
export const exampleGetPremisesRate = () => {
  console.log('\n=== HOW TO GET PREMISES RATE FOR A STEP ===');
  console.log('');
  console.log('⚠️  IMPORTANT: premisesRate must come from project_countries.premises_rate');
  console.log('');
  console.log('📋 Backend SQL Query Example:');
  console.log(`
  SELECT premises_rate, working_days, activity_rate, hours_per_day, npt_rate, mng
  FROM project_countries 
  WHERE project_id = $1 AND country_id = $2
  `);
  console.log('');
  console.log('📋 Frontend API Call Example:');
  console.log(`
  const response = await fetch('/projects/\${projectId}/countries/\${countryId}');
  const countryData = await response.json();
  const premisesRate = countryData.premises_rate;
  `);
  console.log('');
  console.log('✅ Then use this premisesRate in calculatePremisesCost()');
  console.log('🚫 DO NOT use cities.premises_cost_by_default anymore');
};

/**
 * EXAMPLE: CONSISTENT PREMISES COST CALCULATION
 * Demonstrates how to use the new premises cost formula correctly
 */
export const examplePremisesCostUsage = () => {
  console.log('\n=== PREMISES COST - CORRECT USAGE EXAMPLES ===');
  
  // Example 1: Using calculatePremisesCost directly
  console.log('\n📋 Example 1: Direct calculation with known values');
  const directResult = calculatePremisesCost({
    premisesRate: 5.2, // From project_countries.premises_rate
    totalDays: 365, // From project_countries.total_days
    workingDays: 216, // From project_countries.working_days
    activityRate: 85, // From project_countries.activity_rate
    totalProcessTimeHours: 106.67
  });
  console.log(`Result: €${directResult.toFixed(2)}`);

  // Example 2: Using calculatePremisesCostComplete
  console.log('\n📋 Example 2: Complete calculation from step parameters');
  const completeResult = calculatePremisesCostComplete({
    processTime: 10,
    processTimeUnit: 'days',
    hoursPerDay: 8, // From project_countries.hours_per_day
    workingDays: 216, // From project_countries.working_days
    activityRate: 85, // From project_countries.activity_rate
    mngPercentage: 15, // From project_countries.mng
    nptRate: 20, // From project_countries.npt_rate
    premisesRate: 5.2, // From project_countries.premises_rate
    totalDays: 365 // From project_countries.total_days
  });
  console.log(`Result: €${completeResult.toFixed(2)}`);

  // Example 3: Full workflow test
  console.log('\n📋 Example 3: Full workflow with step-by-step breakdown');
  testPremisesCostWorkflow({
    processTime: 10,
    processTimeUnit: 'days',
    hoursPerDay: 8,
    workingDays: 216,
    activityRate: 85,
    mngPercentage: 15,
    nptRate: 20,
    premisesRate: 5.2
  });

  console.log('✅ All examples use the SAME formula: premisesRate × (total_days/(working_days×activity_rate/100)) × totalProcessTimeHours');
  
  return { directResult, completeResult };
};

/**
 * TEST FUNCTION FOR BACKEND VALIDATION
 * Use this to verify the backend calculation with your exact data
 */
export const testBackendExpectedResult = () => {
  console.log('\n=== EXPECTED BACKEND CALCULATION (with unit conversion) ===');
  
  // Your test data
  const processTime = 201; // days
  const processTimeUnit = 'days';
  const hoursPerDay = 8;
  const managementYearlySalary = 25000;
  const socialContributionRate = 32;
  const managementPercentage = 10;
  const nptRate = 10;
  const workingDays = 201;
  const activityRate = 85;
  
  // Step 1: Convert process_time to hours (this is what was missing in backend)
  const processHours = processTimeUnit === 'days' ? processTime * hoursPerDay : processTime;
  console.log(`1. Process Time Conversion: ${processTime} ${processTimeUnit} = ${processHours} hours`);
  
  // Step 2: Calculate annual hours
  const annualHours = workingDays * hoursPerDay * (activityRate / 100);
  console.log(`2. Annual Hours: ${workingDays} × ${hoursPerDay} × (${activityRate}/100) = ${annualHours} hours`);
  
  // Step 3: Calculate management hourly rate
  const adjustedSalary = managementYearlySalary * (1 + socialContributionRate / 100);
  const managementHourlyRate = adjustedSalary / annualHours;
  console.log(`3. Management Hourly Rate: ${adjustedSalary} / ${annualHours} = €${managementHourlyRate.toFixed(4)}/hour`);
  
  // Step 4: Calculate Total Process Time
  const denominator = 1 - (managementPercentage / 100) - (nptRate / 100);
  const totalProcessTimeHours = processHours / denominator;
  console.log(`4. Total Process Time: ${processHours} / ${denominator} = ${totalProcessTimeHours.toFixed(2)} hours`);
  
  // Step 5: Calculate Management Cost
  const managementCost = totalProcessTimeHours * managementHourlyRate * (managementPercentage / 100);
  console.log(`5. Management Cost: ${totalProcessTimeHours.toFixed(2)} × ${managementHourlyRate.toFixed(4)} × (${managementPercentage}/100) = €${managementCost.toFixed(2)}`);
  
  console.log(`\n✅ EXPECTED RESULT: €${managementCost.toFixed(2)}`);
  console.log('Now the backend should match this calculation!\n');
  
  return {
    processHours,
    annualHours,
    managementHourlyRate,
    totalProcessTimeHours,
    managementCost
  };
};

/**
 * TEST FUNCTION FOR PREMISES COST
 * Use this to verify the new premises cost calculation matches backend
 * 
 * IMPORTANTE: premisesRate debe ser el valor de project_countries.premises_rate
 */
export const testPremisesCost = (params: {
  premisesRate: number; // Valor de project_countries.premises_rate para el país del step
  totalDays?: number;
  workingDays: number;
  activityRate: number;
  totalProcessTimeHours: number;
}): {
  inputs: any;
  utilization: number;
  premisesCost: number;
  formula: string;
} => {
  const { premisesRate, totalDays = 365, workingDays, activityRate, totalProcessTimeHours } = params;
  
  const denominator = workingDays * (activityRate / 100);
  const utilization = totalDays / denominator;
  const premisesCost = premisesRate * utilization * totalProcessTimeHours;
  
  console.log('\n=== PREMISES COST TEST ===');
  console.log('Inputs:', params);
  console.log(`Formula: ${premisesRate} × (${totalDays}/(${workingDays}×${activityRate}/100)) × ${totalProcessTimeHours}`);
  console.log(`Calculation: ${premisesRate} × ${utilization.toFixed(4)} × ${totalProcessTimeHours} = ${premisesCost.toFixed(2)}`);
  console.log('✅ This should match the backend calcStepPremisesCost result');
  
  return {
    inputs: params,
    utilization,
    premisesCost,
    formula: `${premisesRate} × (${totalDays}/(${workingDays}×${activityRate}/100)) × ${totalProcessTimeHours}`
  };
};

/**
 * TEST FUNCTION FOR COMPLETE PREMISES COST WORKFLOW
 * Tests the entire calculation from basic step parameters to final cost
 * 
 * IMPORTANTE: premisesRate debe ser el valor de project_countries.premises_rate
 */
export const testPremisesCostWorkflow = (params: {
  processTime: number;
  processTimeUnit: string;
  hoursPerDay: number;
  workingDays: number;
  activityRate: number;
  mngPercentage: number;
  nptRate: number;
  premisesRate: number; // Valor de project_countries.premises_rate para el país del step
  totalDays?: number;
}): {
  processHours: number;
  totalProcessTimeHours: number;
  utilization: number;
  premisesCost: number;
  steps: string[];
} => {
  const { 
    processTime, processTimeUnit, hoursPerDay, workingDays, activityRate,
    mngPercentage, nptRate, premisesRate, totalDays = 365 
  } = params;

  console.log('\n=== COMPLETE PREMISES COST WORKFLOW TEST ===');
  
  // Step 1: Convert to hours
  const processHours = processTimeUnit.toLowerCase() === 'days' ? processTime * hoursPerDay : processTime;
  console.log(`1. Process Hours: ${processTime} ${processTimeUnit} = ${processHours} hours`);

  // Step 2: Calculate Total Process Time
  const denominator = 1 - (mngPercentage / 100) - (nptRate / 100);
  const totalProcessTimeHours = processHours / denominator;
  console.log(`2. Total Process Time: ${processHours} / ${denominator} = ${totalProcessTimeHours.toFixed(2)} hours`);

  // Step 3: Calculate utilization
  const utilizationDenominator = workingDays * (activityRate / 100);
  const utilization = totalDays / utilizationDenominator;
  console.log(`3. Utilization: ${totalDays} / (${workingDays} × ${activityRate}/100) = ${utilization.toFixed(4)}`);

  // Step 4: Calculate premises cost
  const premisesCost = premisesRate * utilization * totalProcessTimeHours;
  console.log(`4. Premises Cost: ${premisesRate} × ${utilization.toFixed(4)} × ${totalProcessTimeHours.toFixed(2)} = €${premisesCost.toFixed(2)}`);

  const steps = [
    `Process Hours: ${processTime} ${processTimeUnit} → ${processHours} hours`,
    `Total Process Time: ${processHours} ÷ (1 - ${mngPercentage}% - ${nptRate}%) = ${totalProcessTimeHours.toFixed(2)} hours`,
    `Utilization: ${totalDays} ÷ (${workingDays} × ${activityRate}%) = ${utilization.toFixed(4)}`,
    `Premises Cost: ${premisesRate} × ${utilization.toFixed(4)} × ${totalProcessTimeHours.toFixed(2)} = €${premisesCost.toFixed(2)}`
  ];

  console.log('\n📋 Summary:');
  steps.forEach((step, i) => console.log(`${i + 1}. ${step}`));
  console.log(`\n✅ Final Result: €${premisesCost.toFixed(2)}\n`);

  return {
    processHours,
    totalProcessTimeHours,
    utilization,
    premisesCost,
    steps
  };
};

/**
 * TEST FUNCTION FOR IT COST
 * Use this to verify the IT cost calculation matches backend
 * 
 * IMPORTANTE: itCost debe ser el valor de project_countries.it_cost
 */
export const testItCost = (params: {
  itCost: number; // Valor de project_countries.it_cost para el país del step
  totalDays?: number;
  workingDays: number;
  activityRate: number;
  totalProcessTimeHours: number;
}): {
  inputs: any;
  utilization: number;
  itCostResult: number;
  formula: string;
} => {
  const { itCost, totalDays = 365, workingDays, activityRate, totalProcessTimeHours } = params;
  
  const denominator = workingDays * (activityRate / 100);
  const utilization = totalDays / denominator;
  const itCostResult = itCost * utilization * totalProcessTimeHours;
  
  console.log('\n=== IT COST TEST ===');
  console.log('Inputs:', params);
  console.log(`Formula: ${itCost} × (${totalDays}/(${workingDays}×${activityRate}/100)) × ${totalProcessTimeHours}`);
  console.log(`Calculation: ${itCost} × ${utilization.toFixed(4)} × ${totalProcessTimeHours} = ${itCostResult.toFixed(2)}`);
  console.log('✅ This should match the backend calcStepItCost result');
  
  return {
    inputs: params,
    utilization,
    itCostResult,
    formula: `${itCost} × (${totalDays}/(${workingDays}×${activityRate}/100)) × ${totalProcessTimeHours}`
  };
};

/**
 * TEST FUNCTION FOR COMPLETE IT COST WORKFLOW
 * Tests the entire calculation from basic step parameters to final IT cost
 * 
 * IMPORTANTE: itCost debe ser el valor de project_countries.it_cost
 */
export const testItCostWorkflow = (params: {
  processTime: number;
  processTimeUnit: string;
  hoursPerDay: number;
  workingDays: number;
  activityRate: number;
  mngPercentage: number;
  nptRate: number;
  itCost: number; // Valor de project_countries.it_cost para el país del step
  totalDays?: number;
}): {
  processHours: number;
  totalProcessTimeHours: number;
  utilization: number;
  itCostResult: number;
  steps: string[];
} => {
  const { 
    processTime, processTimeUnit, hoursPerDay, workingDays, activityRate,
    mngPercentage, nptRate, itCost, totalDays = 365 
  } = params;

  console.log('\n=== COMPLETE IT COST WORKFLOW TEST ===');
  
  // Step 1: Convert to hours
  const processHours = processTimeUnit.toLowerCase() === 'days' ? processTime * hoursPerDay : processTime;
  console.log(`1. Process Hours: ${processTime} ${processTimeUnit} = ${processHours} hours`);

  // Step 2: Calculate Total Process Time
  const denominator = 1 - (mngPercentage / 100) - (nptRate / 100);
  const totalProcessTimeHours = processHours / denominator;
  console.log(`2. Total Process Time: ${processHours} / ${denominator} = ${totalProcessTimeHours.toFixed(2)} hours`);

  // Step 3: Calculate utilization
  const utilizationDenominator = workingDays * (activityRate / 100);
  const utilization = totalDays / utilizationDenominator;
  console.log(`3. Utilization: ${totalDays} / (${workingDays} × ${activityRate}/100) = ${utilization.toFixed(4)}`);

  // Step 4: Calculate IT cost
  const itCostResult = itCost * utilization * totalProcessTimeHours;
  console.log(`4. IT Cost: ${itCost} × ${utilization.toFixed(4)} × ${totalProcessTimeHours.toFixed(2)} = €${itCostResult.toFixed(2)}`);

  const steps = [
    `Process Hours: ${processTime} ${processTimeUnit} → ${processHours} hours`,
    `Total Process Time: ${processHours} ÷ (1 - ${mngPercentage}% - ${nptRate}%) = ${totalProcessTimeHours.toFixed(2)} hours`,
    `Utilization: ${totalDays} ÷ (${workingDays} × ${activityRate}%) = ${utilization.toFixed(4)}`,
    `IT Cost: ${itCost} × ${utilization.toFixed(4)} × ${totalProcessTimeHours.toFixed(2)} = €${itCostResult.toFixed(2)}`
  ];

  console.log('\n📋 Summary:');
  steps.forEach((step, i) => console.log(`${i + 1}. ${step}`));
  console.log(`\n✅ Final Result: €${itCostResult.toFixed(2)}\n`);

  return {
    processHours,
    totalProcessTimeHours,
    utilization,
    itCostResult,
    steps
  };
};

/**
 * EXAMPLE: CONSISTENT IT COST CALCULATION
 * Demonstrates how to use the new IT cost formula correctly
 */
export const exampleItCostUsage = () => {
  console.log('\n=== IT COST - CORRECT USAGE EXAMPLES ===');
  
  // Example 1: Using calculateItCost directly
  console.log('\n📋 Example 1: Direct calculation with known values');
  const directResult = calculateItCost({
    itCost: 3.5, // From project_countries.it_cost
    totalDays: 365, // From project_countries.total_days
    workingDays: 216, // From project_countries.working_days
    activityRate: 85, // From project_countries.activity_rate
    totalProcessTimeHours: 106.67
  });
  console.log(`Result: €${directResult.toFixed(2)}`);

  // Example 2: Using calculateItCostComplete
  console.log('\n📋 Example 2: Complete calculation from step parameters');
  const completeResult = calculateItCostComplete({
    processTime: 10,
    processTimeUnit: 'days',
    hoursPerDay: 8, // From project_countries.hours_per_day
    workingDays: 216, // From project_countries.working_days
    activityRate: 85, // From project_countries.activity_rate
    mngPercentage: 15, // From project_countries.mng
    nptRate: 20, // From project_countries.npt_rate
    itCost: 3.5, // From project_countries.it_cost
    totalDays: 365 // From project_countries.total_days
  });
  console.log(`Result: €${completeResult.toFixed(2)}`);

  // Example 3: Full workflow test
  console.log('\n📋 Example 3: Full workflow with step-by-step breakdown');
  testItCostWorkflow({
    processTime: 10,
    processTimeUnit: 'days',
    hoursPerDay: 8,
    workingDays: 216,
    activityRate: 85,
    mngPercentage: 15,
    nptRate: 20,
    itCost: 3.5
  });

  console.log('✅ All examples use the SAME formula: itCost × (total_days/(working_days×activity_rate/100)) × totalProcessTimeHours');
  
  return { directResult, completeResult };
};

/**
 * CALCULATE: LICENSE PER USE COST
 * Calculates the cost share for a step using License Per Use formula
 */
export const calculateLicensePerUseCost = (params: {
  totalCost: number;
  processTime: number;
  processTimeUnit: 'days' | 'hours';
  workingDays: number;
  hoursPerDay: number;
  activityRate: number;
}): number => {
  const { totalCost, processTime, processTimeUnit, workingDays, hoursPerDay, activityRate } = params;
  
  // Validate inputs
  if (workingDays <= 0 || hoursPerDay <= 0 || activityRate <= 0) {
    console.warn('Invalid parameters for License Per Use calculation:', { workingDays, hoursPerDay, activityRate });
    return 0;
  }
  
  // Calculate productive hours per year (NO NPT adjustment)
  const productiveHoursPerYear = workingDays * hoursPerDay * (activityRate / 100);
  
  // Convert process time to hours
  const processTimeHours = processTimeUnit === 'days' ? processTime * hoursPerDay : processTime;
  
  // Calculate hourly cost
  const hourlyCost = totalCost / productiveHoursPerYear;
  
  // Calculate final cost for this step (NO NPT adjustment)
  const shareRaw = hourlyCost * processTimeHours;
  const share = Math.round(shareRaw * 100) / 100;
  
  console.log(`License Per Use Calculation:
    - totalCost: ${totalCost}
    - processTime: ${processTime} ${processTimeUnit}
    - processTimeHours: ${processTimeHours}
    - workingDays: ${workingDays}
    - hoursPerDay: ${hoursPerDay}
    - activityRate: ${activityRate}%
    - productiveHoursPerYear: ${productiveHoursPerYear}
    - hourlyCost: ${hourlyCost.toFixed(6)}
    - formula: (${totalCost} / ${productiveHoursPerYear}) × ${processTimeHours} = ${shareRaw}
    - result: ${share}`);
  
  return share;
};

/**
 * TEST: LICENSE PER USE CALCULATION
 * Tests the License Per Use formula with example data
 */
export const testLicensePerUse = (params?: {
  totalCost?: number;
  processTime?: number;
  processTimeUnit?: 'days' | 'hours';
  workingDays?: number;
  hoursPerDay?: number;
  activityRate?: number;
}) => {
  console.log('\n=== LICENSE PER USE - FORMULA TEST ===');
  
  const testParams = {
    totalCost: 1,
    processTime: 201,
    processTimeUnit: 'days' as const,
    workingDays: 216,
    hoursPerDay: 8,
    activityRate: 90,
    ...params
  };
  
  console.log('🧪 Testing with parameters:', testParams);
  
  const result = calculateLicensePerUseCost(testParams);
  
  console.log(`\n✅ Result: €${result}`);
  console.log('\n📋 Expected calculation:');
  console.log('1. Productive hours/year: 216 × 8 × 90% = 1555.2h');
  console.log('2. Hourly cost: €1 / 1555.2h = €0.000643/h');
  console.log('3. Process time: 201 days × 8h = 1608h');
  console.log('4. Final cost: €0.000643 × 1608h = €1.03');
  
  return result;
};

/**
 * TEST: IT COST BACKEND INTEGRATION
 * Tests that IT costs are being calculated and stored in database correctly
 */
export const testItCostBackendIntegration = async (projectId: number) => {
  console.log('\n=== TESTING IT COST BACKEND INTEGRATION ===');
  console.log(`🧪 Testing IT cost calculation and storage for project ${projectId}`);
  
  try {
    // Call the recalc endpoint
    console.log('📡 Calling backend recalc endpoint...');
    const response = await fetch(`/api/projects/${projectId}/steps/recalc-costs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Backend response received:', result);
    
    // Check if IT costs are present in the results
    const stepsWithItCosts = result.costs?.filter((cost: any) => cost.itCosts > 0) || [];
    
    console.log('\n📊 IT Costs Analysis:');
    console.log(`Total steps processed: ${result.costs?.length || 0}`);
    console.log(`Steps with IT costs > 0: ${stepsWithItCosts.length}`);
    
    if (stepsWithItCosts.length > 0) {
      console.log('\n✅ SUCCESS: IT costs are being calculated and returned!');
      console.log('Sample results:');
      stepsWithItCosts.slice(0, 3).forEach((step: any, i: number) => {
        console.log(`  ${i + 1}. Step ${step.stepId}, Year ${step.year}: €${step.itCosts?.toFixed(2) || '0.00'}`);
      });
    } else {
      console.warn('⚠️  WARNING: No steps have IT costs > 0. This might indicate:');
      console.warn('   - No it_cost configured in project_countries');
      console.warn('   - Steps have 0 process time or invalid data');
      console.warn('   - Database column it_costs might not exist');
    }
    
    // Calculate expected IT cost for validation
    if (result.costs && result.costs.length > 0) {
      console.log('\n🔍 Validation check:');
      console.log('To verify calculations, you can manually check with:');
      console.log('window.testItCost({ itCost: [it_cost from project_countries], totalDays: 365, workingDays: [working_days], activityRate: [activity_rate], totalProcessTimeHours: [calculated_hours] })');
    }
    
    return {
      success: true,
      totalSteps: result.costs?.length || 0,
      stepsWithItCosts: stepsWithItCosts.length,
      sampleResults: stepsWithItCosts.slice(0, 5),
      response: result
    };
    
  } catch (error) {
    console.error('❌ ERROR testing backend integration:', error);
    console.log('Possible issues:');
    console.log('1. Backend server not running');
    console.log('2. Invalid project ID');
    console.log('3. Database connection issues');
    console.log('4. Missing it_costs column in step_yearly_data table');
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// ============================
// MARGIN CALCULATION DIAGNOSIS
// ============================

/**
 * Diagnose bulk margin calculation data
 */
export async function diagnoseBulkMarginData(projectId: number, year?: number): Promise<any> {
  try {
    const currentYear = year || new Date().getFullYear();
    const response = await fetch(`/projects/${projectId}/diagnose-margin-data?year=${currentYear}`);
    const data = await response.json();
    
    console.log('🔍 MARGIN DATA DIAGNOSIS');
    console.log('========================');
    console.log(`📊 Project: ${projectId} | Year: ${currentYear}`);
    console.log('');
    
    if (data.diagnosis) {
      console.log('📋 Project Configuration:', data.diagnosis.project);
      console.log(`📦 Deliverables: ${data.diagnosis.deliverables.length}`);
      console.log(`🔧 Steps: ${data.diagnosis.stepsCount}`);
      console.log(`📅 Step Yearly Data: ${data.diagnosis.stepYearlyDataSample.length} records`);
      console.log(`🌍 Project Countries: ${data.diagnosis.projectCountries.length} records`);
      console.log(`📈 Deliverable Quantities: ${data.diagnosis.deliverableQuantities.length} records`);
      
      if (data.diagnosis.stepYearlyDataSample.length > 0) {
        console.log('\n💰 Sample Cost Data:');
        data.diagnosis.stepYearlyDataSample.forEach((sample: any, idx: number) => {
          console.log(`  Step ${idx + 1}: salaries=${sample.salaries_costs}, mgmt=${sample.management_costs}, it=${sample.it_costs}`);
        });
      }
      
      if (data.diagnosis.deliverableQuantities.length > 0) {
        console.log('\n📊 Current Margin Values:');
        data.diagnosis.deliverableQuantities.forEach((qty: any) => {
          console.log(`  Deliverable ${qty.deliverable_id} Year ${qty.year_number}: TO=${qty.operational_to}, DM=${qty.dm_real}, GMBS=${qty.gmbs_real}`);
        });
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error diagnosing margin data:', error);
    return { error: error };
  }
}

/**
 * Test bulk margin calculation
 */
export async function testBulkMarginCalculation(projectId: number, year?: number): Promise<any> {
  try {
    const currentYear = year || new Date().getFullYear();
    const response = await fetch(`/projects/${projectId}/test-margins?year=${currentYear}`);
    const data = await response.json();
    
    console.log('🧮 MARGIN CALCULATION TEST');
    console.log('==========================');
    console.log(`📊 Project: ${projectId} | Year: ${currentYear}`);
    console.log('');
    
    if (data.projectMargins) {
      console.log('🏢 Project-Level Margins:');
      console.log(`  TO (Turnover): €${data.projectMargins.TO}`);
      console.log(`  DM: ${data.projectMargins.DM}%`);
      console.log(`  GMBS: ${data.projectMargins.GMBS}%`);
      console.log(`  Total DM Costs: €${data.projectMargins.total_dm_costs}`);
      console.log(`  Total GMBS Costs: €${data.projectMargins.total_gmbs_costs}`);
      console.log('');
    }
    
    if (data.deliverableResults && data.deliverableResults.length > 0) {
      console.log('📦 Deliverable-Level Results:');
      data.deliverableResults.forEach((result: any) => {
        if (result.margins) {
          console.log(`  Deliverable ${result.deliverableId}: TO=${result.margins.TO}, DM=${result.margins.DM}%, GMBS=${result.margins.GMBS}%`);
        } else {
          console.log(`  Deliverable ${result.deliverableId}: ERROR - ${result.error}`);
        }
      });
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error testing margin calculation:', error);
    return { error: error };
  }
}

/**
 * Test complete margin calculation workflow
 */
export async function testMarginCalculationWorkflow(projectId: number, year?: number): Promise<any> {
  console.log('🚀 COMPLETE MARGIN CALCULATION WORKFLOW TEST');
  console.log('=============================================');
  
  try {
    // Step 1: Diagnose data
    console.log('Step 1: Diagnosing data availability...');
    const diagnosis = await diagnoseBulkMarginData(projectId, year);
    
    // Step 2: Test calculation
    console.log('\nStep 2: Testing margin calculations...');
    const testResults = await testBulkMarginCalculation(projectId, year);
    
    // Step 3: Trigger recalculation
    console.log('\nStep 3: Triggering recalculation...');
    const recalcResponse = await fetch(`/projects/${projectId}/recalc-margins-yearly`, {
      method: 'POST'
    });
    const recalcData = await recalcResponse.json();
    
    console.log('📈 Recalculation Results:');
    console.log(`  Processed ${recalcData.count} deliverable-year combinations`);
    
    if (recalcData.rows && recalcData.rows.length > 0) {
      console.log('\n📊 Updated Values:');
      recalcData.rows.forEach((row: any) => {
        console.log(`  Deliverable ${row.deliverableId} Year ${row.year}: TO=${row.operationalTo}, DM=${row.dmRealPct}%, GMBS=${row.gmbsRealPct}%`);
      });
    }
    
    console.log('\n✅ Workflow completed successfully!');
    return {
      diagnosis,
      testResults,
      recalculation: recalcData
    };
    
  } catch (error) {
    console.error('❌ Workflow failed:', error);
    return { error: error };
  }
}

// Exportar funciones de test al window para debugging en navegador
if (typeof window !== 'undefined') {
  (window as any).testManagementCosts = testManagementCosts;
  (window as any).debugNPTCosts = debugNPTCosts;
  (window as any).calculateManagementCostComplete = calculateManagementCostComplete;
  (window as any).testBackendExpectedResult = testBackendExpectedResult;
  (window as any).testPremisesCost = testPremisesCost;
  (window as any).testPremisesCostWorkflow = testPremisesCostWorkflow;
  (window as any).exampleGetPremisesRate = exampleGetPremisesRate;
  (window as any).examplePremisesCostUsage = examplePremisesCostUsage;
  (window as any).calculatePremisesCost = calculatePremisesCost;
  (window as any).calculatePremisesCostComplete = calculatePremisesCostComplete;
  
  // IT Cost functions
  (window as any).testItCost = testItCost;
  (window as any).testItCostWorkflow = testItCostWorkflow;
  (window as any).exampleItCostUsage = exampleItCostUsage;
  (window as any).calculateItCost = calculateItCost;
  (window as any).calculateItCostComplete = calculateItCostComplete;
  (window as any).testItCostBackendIntegration = testItCostBackendIntegration;
  
  // License Per Use functions
  (window as any).calculateLicensePerUseCost = calculateLicensePerUseCost;
  (window as any).testLicensePerUse = testLicensePerUse;
  
  // Margin calculation diagnosis functions
  (window as any).diagnoseBulkMarginData = diagnoseBulkMarginData;
  (window as any).testBulkMarginCalculation = testBulkMarginCalculation;
  (window as any).testMarginCalculationWorkflow = testMarginCalculationWorkflow;
  
  // Mostrar ayuda al cargar
  console.log('🎯 Management Cost Testing is available!');
  console.log('💡 Type window.testManagementCosts({...}) to test calculations');
  console.log('🔧 Type window.testBackendExpectedResult() to see expected backend result');
  console.log('🏢 Type window.testPremisesCost({...}) to test premises cost calculation');
  console.log('🏗️ Type window.testPremisesCostWorkflow({...}) to test complete premises workflow');
  console.log('📊 Type window.diagnoseBulkMarginData(projectId) to diagnose margin calculation data');
  console.log('🧮 Type window.testBulkMarginCalculation(projectId) to test new margin calculations');
  console.log('🚀 Type window.testMarginCalculationWorkflow(projectId) for complete workflow test');
  console.log('� Type window.exampleGetPremisesRate() to see how to get premises rate from DB');
  console.log('�📖 Type window.examplePremisesCostUsage() to see usage examples');
}