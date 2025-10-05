// src/utils/marginCalculations.ts

import { Step } from '../types/workPackages';

export interface MarginCalculationResult {
  TO: number;
  DM: number;
  GMBS: number;
  totalDmCosts: number;
  totalGmbsCosts: number;
}

export interface StepCostBreakdown {
  stepId: number;
  deliverableId?: number;
  operationalCosts: number;
  nonOperationalCosts: number;
  dmCosts: number;
  gmbsCosts: number;
  quantity: number;
  activityRate: number;
}

/**
 * Calcula DM y GMBS dado un TO fijo y una lista de steps
 * Replica la lógica del backend pero usando TO como input en lugar de calcularlo
 * 
 * @param steps - Lista de steps con su información de costos
 * @param givenTO - Turnover dado como input
 * @param stepsCostData - Datos de costos por step (salarios, gestión, etc.)
 * @param quantities - Cantidades por deliverable (Map deliverableId -> quantity)
 * @param activityRates - Tasas de actividad por country (Map countryId -> activity_rate)
 * @returns Resultado con DM, GMBS calculados y breakdown de costos
 */
export function calculateMarginsWithGivenTO(params: {
  steps: Step[];
  givenTO: number;
  stepsCostData: Map<number, {
    salaries_costs: number;
    management_costs: number;
    npt_costs: number;
    it_costs: number;
    premises_costs: number;
    it_recurrent_costs: number;
    travel_costs: number;
    subco_costs: number;
    purchases_costs: number;
  }>;
  quantities?: Map<number, number>; // deliverableId -> quantity (default: 1)
  activityRates?: Map<string, number>; // country -> activity_rate (default: 100)
}): MarginCalculationResult {
  
  const { steps, givenTO, stepsCostData, quantities = new Map(), activityRates = new Map() } = params;
  
  console.log('\n🔄 [calculateMarginsWithGivenTO] Starting calculation');
  console.log('📊 Input params:', { 
    stepsCount: steps.length,
    givenTO,
    hasStepsCostData: stepsCostData.size > 0,
    hasQuantities: quantities.size > 0,
    hasActivityRates: activityRates.size > 0
  });

  if (steps.length === 0 || givenTO <= 0) {
    console.log('⚠️ [calculateMarginsWithGivenTO] Invalid inputs, returning zeros');
    return { TO: givenTO, DM: 0, GMBS: 0, totalDmCosts: 0, totalGmbsCosts: 0 };
  }

  let totalDmCosts = 0;
  let totalGmbsCosts = 0;
  const stepBreakdowns: StepCostBreakdown[] = [];

  // Calcular costos por cada step
  for (const step of steps) {
    const stepCosts = stepsCostData.get(step.id);
    
    if (!stepCosts) {
      console.warn(`⚠️ No cost data found for step ${step.id}, skipping`);
      continue;
    }

    // Obtener cantidad del deliverable (default: 1)
    const quantity = quantities.get(step.id) || 1; // Nota: Podría necesitar deliverableId en lugar de stepId
    
    // Obtener activity rate del país (default: 100%)
    const activityRate = activityRates.get(step.country) || 100;

    // Extraer y asegurar que todos los valores son números
    const salariesNum = Number(stepCosts.salaries_costs || 0);
    const managementNum = Number(stepCosts.management_costs || 0);
    const nptNum = Number(stepCosts.npt_costs || 0);
    const itNum = Number(stepCosts.it_costs || 0);
    const premisesNum = Number(stepCosts.premises_costs || 0);
    const itRecurrentNum = Number(stepCosts.it_recurrent_costs || 0);
    const travelNum = Number(stepCosts.travel_costs || 0);
    const subcoNum = Number(stepCosts.subco_costs || 0);
    const purchasesNum = Number(stepCosts.purchases_costs || 0);

    // OPERATIONAL COSTS: Multiply base costs by quantity, then apply activity rate
    const operationalBase = (salariesNum + managementNum + nptNum + itNum + premisesNum) * quantity;
    const adjustedOperational = (operationalBase * activityRate) / 100;

    // NON-OPERATIONAL COSTS: Add directly without multiplying by quantity
    const nonOperational = itRecurrentNum + travelNum + subcoNum + purchasesNum;

    const stepDmCosts = adjustedOperational + nonOperational;
    const stepGmbsCosts = operationalBase + nonOperational;

    console.log(`💰 Step ${step.id} (${step.name}) costs calculation:`, {
      quantity,
      operationalBaseCosts: `${operationalBase.toFixed(2)} (base: ${salariesNum + managementNum + nptNum + itNum + premisesNum} × ${quantity})`,
      activityRate: activityRate + '%',
      adjustedOperational: adjustedOperational.toFixed(2),
      nonOperational: nonOperational.toFixed(2),
      stepDmCosts: stepDmCosts.toFixed(2),
      stepGmbsCosts: stepGmbsCosts.toFixed(2)
    });

    // Agregar al breakdown detallado
    stepBreakdowns.push({
      stepId: step.id,
      operationalCosts: adjustedOperational,
      nonOperationalCosts: nonOperational,
      dmCosts: stepDmCosts,
      gmbsCosts: stepGmbsCosts,
      quantity,
      activityRate
    });

    totalDmCosts += stepDmCosts;
    totalGmbsCosts += stepGmbsCosts;
  }

  // Calcular márgenes basado en el TO dado
  console.log('🧮 Calculation totals:', {
    givenTO: givenTO.toFixed(2),
    totalDmCosts: totalDmCosts.toFixed(2),
    totalGmbsCosts: totalGmbsCosts.toFixed(2)
  });

  // DM = (TO - DM_costs) / TO * 100
  const DM = totalDmCosts > 0 ? ((givenTO - totalDmCosts) / givenTO) * 100 : 0;
  
  // GMBS = (TO - GMBS_costs) / TO * 100  
  const GMBS = totalGmbsCosts > 0 ? ((givenTO - totalGmbsCosts) / givenTO) * 100 : 0;

  const result: MarginCalculationResult = {
    TO: Math.round((givenTO + Number.EPSILON) * 100) / 100,
    DM: Math.round((DM + Number.EPSILON) * 100) / 100,
    GMBS: Math.round((GMBS + Number.EPSILON) * 100) / 100,
    totalDmCosts: Math.round((totalDmCosts + Number.EPSILON) * 100) / 100,
    totalGmbsCosts: Math.round((totalGmbsCosts + Number.EPSILON) * 100) / 100
  };

  console.log('📈 Margin calculations:', {
    DM_formula: `((${givenTO.toFixed(2)} - ${totalDmCosts.toFixed(2)}) / ${givenTO.toFixed(2)}) × 100 = ${DM.toFixed(2)}%`,
    GMBS_formula: `((${givenTO.toFixed(2)} - ${totalGmbsCosts.toFixed(2)}) / ${givenTO.toFixed(2)}) × 100 = ${GMBS.toFixed(2)}%`,
    result
  });

  return result;
}

/**
 * Versión simplificada que solo requiere el TO y costos totales ya calculados
 */
export function calculateMarginsSimple(params: {
  givenTO: number;
  totalDmCosts: number;
  totalGmbsCosts: number;
}): Pick<MarginCalculationResult, 'TO' | 'DM' | 'GMBS'> {
  
  const { givenTO, totalDmCosts, totalGmbsCosts } = params;
  
  if (givenTO <= 0) {
    return { TO: givenTO, DM: 0, GMBS: 0 };
  }

  // DM = (TO - DM_costs) / TO * 100
  const DM = totalDmCosts > 0 ? ((givenTO - totalDmCosts) / givenTO) * 100 : 0;
  
  // GMBS = (TO - GMBS_costs) / TO * 100  
  const GMBS = totalGmbsCosts > 0 ? ((givenTO - totalGmbsCosts) / givenTO) * 100 : 0;

  return {
    TO: Math.round((givenTO + Number.EPSILON) * 100) / 100,
    DM: Math.round((DM + Number.EPSILON) * 100) / 100,
    GMBS: Math.round((GMBS + Number.EPSILON) * 100) / 100
  };
}