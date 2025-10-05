import type { QueryResult } from 'pg';

export interface DB { query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount?: number }>; }

export interface YearlyCalcRow {
  deliverableId: number;
  year: number;
  quantity: number;
  operationalTo: number;
  dmRealPct: number;   // already *100
  gmbsRealPct: number; // already *100
  opCostYear: number;
  nopCostYear: number;
}

// Interface for step cost data
export interface StepCostData {
  step_id: number;
  deliverable_id: number;
  year: number;
  salaries_costs: number;
  management_costs: number;
  npt_costs: number;
  it_costs: number;
  premises_costs: number;
  it_recurrent_costs: number;
  travel_costs: number;
  subco_costs: number;
  purchases_costs: number;
  activity_rate: number;
}

// New interface for margin calculation results
export interface BulkMarginResult {
  TO: number;
  DM: number;
  GMBS: number;
  total_dm_costs: number;
  total_gmbs_costs: number;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// NEW BULK MARGIN CALCULATION FUNCTION
export async function calcBulkMargins(params: {
  stepIds: number[];
  year: number;
  marginType: 'DM' | 'GMBS';
  marginGoal: number;
  db: DB;
}): Promise<BulkMarginResult> {
  const { stepIds, year, marginType, marginGoal, db } = params;
  
  console.log('\n🔄 [calcBulkMargins] STARTING calculation');
  console.log('📊 Input params:', { 
    stepIds: stepIds.length > 0 ? stepIds : 'EMPTY ARRAY',
    year, 
    marginType, 
    marginGoal 
  });
  
  if (stepIds.length === 0) {
    console.log('⚠️ [calcBulkMargins] No stepIds provided, returning zeros');
    return { TO: 0, DM: 0, GMBS: 0, total_dm_costs: 0, total_gmbs_costs: 0 };
  }
  

  
  // Fetch all cost data for the specified steps and year
  const costQuery = `
    SELECT 
      s.id as step_id,
      s.deliverable_id,
      syd.year,
      COALESCE(syd.salaries_cost, 0) as salaries_costs,
      COALESCE(syd.management_costs, 0) as management_costs,
      COALESCE(syd.npt_costs, 0) as npt_costs,
      COALESCE(syd.it_costs, 0) as it_costs,
      COALESCE(syd.premises_costs, 0) as premises_costs,
      COALESCE(syd.it_recurrent_costs, 0) as it_recurrent_costs,
      COALESCE(syd.travel_costs, 0) as travel_costs,
      COALESCE(syd.subco_costs, 0) as subco_costs,
      COALESCE(syd.purchases_costs, 0) as purchases_costs,
      COALESCE(pc.activity_rate, 100) as activity_rate
    FROM steps s
    JOIN step_yearly_data syd ON s.id = syd.step_id AND syd.year = $2
    LEFT JOIN project_countries pc ON s.country_id = pc.country_id 
      AND pc.project_id = (SELECT wp.project_id FROM deliverables d JOIN workpackages wp ON d.workpackage_id = wp.id WHERE d.id = s.deliverable_id LIMIT 1)
    WHERE s.id = ANY($1::int[])
  `;
  
  console.log('🗃️ [calcBulkMargins] Executing cost query for year:', year);
  const costResult = await db.query<StepCostData>(costQuery, [stepIds, year]);
  const stepCosts = costResult.rows;
  
  console.log('📋 [calcBulkMargins] Cost data retrieved:', {
    stepsFound: stepCosts.length,
    stepsRequested: stepIds.length,
    year: year,
    sampleCosts: stepCosts.length > 0 ? stepCosts[0] : 'No data found'
  });
  
  // Fetch deliverable quantities for the specified year
  const deliverableIds = [...new Set(stepCosts.map(sc => sc.deliverable_id))];
  console.log('🔢 [calcBulkMargins] Fetching quantities for deliverables:', deliverableIds, 'for year:', year);
  console.log('🔢 [calcBulkMargins] Deliverable IDs type check:', typeof deliverableIds[0], 'Year type check:', typeof year);
  
  const quantityQuery = `
    SELECT 
      deliverable_id, 
      quantity,
      year_number
    FROM deliverable_yearly_quantities 
    WHERE deliverable_id = ANY($1::int[]) AND year_number = $2
  `;
  
  console.log('🗄️ [calcBulkMargins] Quantity query:', quantityQuery);
  console.log('🗄️ [calcBulkMargins] Query parameters:', [deliverableIds, year]);
  
  const quantityResult = await db.query<{ deliverable_id: number; quantity: number; year_number: number }>(
    quantityQuery, 
    [deliverableIds, year]
  );
  
  console.log('📊 [calcBulkMargins] Raw quantity query result:', quantityResult.rows);
  
  // If no quantities found, let's check what data exists for these deliverables
  if (quantityResult.rows.length === 0) {
    console.log('🔍 [calcBulkMargins] No quantities found, checking what data exists...');
    const debugQuery = `
      SELECT 
        deliverable_id, 
        quantity,
        year_number
      FROM deliverable_yearly_quantities 
      WHERE deliverable_id = ANY($1::int[])
      ORDER BY deliverable_id, year_number
    `;
    
    const debugResult = await db.query(debugQuery, [deliverableIds]);
    console.log('🔍 [calcBulkMargins] Available quantity data for these deliverables:', debugResult.rows);
    
    // Also check if the table has any data at all
    const tableCheckQuery = `SELECT COUNT(*) as total_records FROM deliverable_yearly_quantities LIMIT 5`;
    const tableCheckResult = await db.query(tableCheckQuery);
    console.log('🔍 [calcBulkMargins] Total records in deliverable_yearly_quantities table:', tableCheckResult.rows[0]);
    
    // Check for any records with the specified year
    const yearCheckQuery = `SELECT deliverable_id, quantity, year_number FROM deliverable_yearly_quantities WHERE year_number = $1 LIMIT 5`;
    const yearCheckResult = await db.query(yearCheckQuery, [year]);
    console.log('🔍 [calcBulkMargins] Any records for year', year, ':', yearCheckResult.rows);
  }
  
  // Create a map for quick quantity lookup
  const quantityMap = new Map<number, number>();
  
  // If no quantities found for the specific year, try to get any available quantities
  let finalQuantityRows = quantityResult.rows;
  
  if (quantityResult.rows.length === 0 && deliverableIds.length > 0) {
    console.log('🔄 [calcBulkMargins] No quantities for specific year, trying to get any available quantities...');
    const fallbackQuantityQuery = `
      SELECT DISTINCT ON (deliverable_id)
        deliverable_id, 
        quantity,
        year_number
      FROM deliverable_yearly_quantities 
      WHERE deliverable_id = ANY($1::int[])
      ORDER BY deliverable_id, year_number DESC
    `;
    
    const fallbackQuantityResult = await db.query<{ deliverable_id: number; quantity: number; year_number: number }>(
      fallbackQuantityQuery, 
      [deliverableIds]
    );
    
    console.log('🔄 [calcBulkMargins] Fallback quantity result:', fallbackQuantityResult.rows);
    finalQuantityRows = fallbackQuantityResult.rows;
  }
  
  finalQuantityRows.forEach(row => {
    quantityMap.set(row.deliverable_id, row.quantity || 1); // Default to 1 if no quantity
  });
  
  console.log('📊 [calcBulkMargins] Quantities retrieved:', {
    deliverables: deliverableIds.length,
    quantitiesFound: finalQuantityRows.length,
    quantityMap: Object.fromEntries(quantityMap)
  });
  
  if (stepCosts.length === 0) {
    console.log('⚠️ [calcBulkMargins] No cost data found for specified year, trying fallback...');
    // Try to find data for any year as a fallback
    const fallbackQuery = `
      SELECT 
        s.id as step_id,
        s.deliverable_id,
        syd.year,
        COALESCE(syd.salaries_cost, 0) as salaries_costs,
        COALESCE(syd.management_costs, 0) as management_costs,
        COALESCE(syd.npt_costs, 0) as npt_costs,
        COALESCE(syd.it_costs, 0) as it_costs,
        COALESCE(syd.premises_costs, 0) as premises_costs,
        COALESCE(syd.it_recurrent_costs, 0) as it_recurrent_costs,
        COALESCE(syd.travel_costs, 0) as travel_costs,
        COALESCE(syd.subco_costs, 0) as subco_costs,
        COALESCE(syd.purchases_costs, 0) as purchases_costs,
        COALESCE(pc.activity_rate, 100) as activity_rate
      FROM steps s
      JOIN step_yearly_data syd ON s.id = syd.step_id
      LEFT JOIN project_countries pc ON s.country_id = pc.country_id 
        AND pc.project_id = (SELECT wp.project_id FROM deliverables d JOIN workpackages wp ON d.workpackage_id = wp.id WHERE d.id = s.deliverable_id LIMIT 1)
      WHERE s.id = ANY($1::int[])
      ORDER BY syd.year DESC
      LIMIT 50
    `;
    
    const fallbackResult = await db.query<StepCostData>(fallbackQuery, [stepIds]);
    if (fallbackResult.rows.length > 0) {
      console.log('✅ [calcBulkMargins] Fallback data found:', {
        stepsFound: fallbackResult.rows.length,
        sampleYear: fallbackResult.rows[0]?.year || 'N/A'
      });
      const stepCostsFallback = fallbackResult.rows;
      
      // Fetch deliverable quantities for fallback (try the requested year first, then any year)
      const fallbackDeliverableIds = [...new Set(stepCostsFallback.map(sc => sc.deliverable_id))];
      console.log('🔢 [calcBulkMargins] FALLBACK: Fetching quantities for deliverables:', fallbackDeliverableIds);
      
      let fallbackQuantityResult = await db.query<{ deliverable_id: number; quantity: number }>(
        `SELECT deliverable_id, quantity FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1::int[]) AND year_number = $2`, 
        [fallbackDeliverableIds, year]
      );
      
      // If no quantities found for the requested year, try to find any quantity
      if (fallbackQuantityResult.rows.length === 0) {
        console.log('🔍 [calcBulkMargins] FALLBACK: No quantities for requested year, trying any year...');
        fallbackQuantityResult = await db.query<{ deliverable_id: number; quantity: number }>(
          `SELECT DISTINCT ON (deliverable_id) deliverable_id, quantity FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1::int[]) ORDER BY deliverable_id, year_number DESC`, 
          [fallbackDeliverableIds]
        );
      }
      
      // Create quantity map for fallback
      const fallbackQuantityMap = new Map<number, number>();
      fallbackQuantityResult.rows.forEach(row => {
        fallbackQuantityMap.set(row.deliverable_id, row.quantity || 1);
      });
      
      console.log('📊 [calcBulkMargins] FALLBACK quantities:', Object.fromEntries(fallbackQuantityMap));
      
      // Use the fallback data
      let totalDmCosts = 0;
      let totalGmbsCosts = 0;
      
      for (const stepCost of stepCostsFallback) {
        const { 
          deliverable_id, salaries_costs, management_costs, npt_costs, it_costs, premises_costs,
          it_recurrent_costs, travel_costs, subco_costs, purchases_costs, activity_rate 
        } = stepCost;
        
        // Get quantity for this deliverable (default to 1 if not found)
        const quantity = fallbackQuantityMap.get(deliverable_id) || 1;
        
        // Ensure all values are numbers to avoid toFixed errors
        const salariesNum = Number(salaries_costs || 0);
        const managementNum = Number(management_costs || 0);
        const nptNum = Number(npt_costs || 0);
        const itNum = Number(it_costs || 0);
        const premisesNum = Number(premises_costs || 0);
        const itRecurrentNum = Number(it_recurrent_costs || 0);
        const travelNum = Number(travel_costs || 0);
        const subcoNum = Number(subco_costs || 0);
        const purchasesNum = Number(purchases_costs || 0);
        const activityRateNum = Number(activity_rate || 100);
        
        // OPERATIONAL COSTS: Multiply base costs by quantity, then apply activity rate
        const operationalBase = (salariesNum + managementNum + nptNum + itNum + premisesNum) * quantity;
        const adjustedOperational = (operationalBase * activityRateNum) / 100;
        
        // NON-OPERATIONAL COSTS: Add directly without multiplying by quantity
        const nonOperational = itRecurrentNum + travelNum + subcoNum + purchasesNum;
        
        const stepDmCosts = adjustedOperational + nonOperational;
        const stepGmbsCosts = operationalBase + nonOperational;
        
        console.log(`💰 [calcBulkMargins] FALLBACK Step ${stepCost.step_id} (Deliverable ${deliverable_id}) costs calculation:`, {
          quantity: quantity,
          operationalBaseCosts: `${salariesNum + managementNum + nptNum + itNum + premisesNum} × ${quantity} = ${operationalBase.toFixed(2)}`,
          activity_rate: activityRateNum + '%',
          adjustedOperational: adjustedOperational.toFixed(2),
          nonOperational: nonOperational.toFixed(2),
          stepDmCosts: stepDmCosts.toFixed(2),
          stepGmbsCosts: stepGmbsCosts.toFixed(2)
        });
        
        totalDmCosts += stepDmCosts;
        totalGmbsCosts += stepGmbsCosts;
      }
      
      // Calculate margins with fallback data
      console.log('🧮 [calcBulkMargins] FALLBACK calculation totals:', {
        totalDmCosts: totalDmCosts.toFixed(2),
        totalGmbsCosts: totalGmbsCosts.toFixed(2),
        marginType,
        marginGoal: marginGoal + '%'
      });
      
      const marginGoalDecimal = marginGoal / 100;
      let TO: number, DM: number, GMBS: number;
      
      if (marginType === 'DM') {
        TO = totalDmCosts / (1 - marginGoalDecimal);
        DM = marginGoal;
        GMBS = totalGmbsCosts > 0 ? (1 - (totalGmbsCosts / TO)) * 100 : 0;
        console.log('📈 [calcBulkMargins] DM calculation:', {
          formula: `${totalDmCosts.toFixed(2)} / (1 - ${marginGoalDecimal}) = ${TO.toFixed(2)}`,
          TO: TO.toFixed(2),
          DM: DM.toFixed(2) + '%',
          GMBS: GMBS.toFixed(2) + '%'
        });
      } else {
        TO = totalGmbsCosts / (1 - marginGoalDecimal);
        GMBS = marginGoal;
        DM = totalDmCosts > 0 ? (1 - (totalDmCosts / TO)) * 100 : 0;
        console.log('📈 [calcBulkMargins] GMBS calculation:', {
          formula: `${totalGmbsCosts.toFixed(2)} / (1 - ${marginGoalDecimal}) = ${TO.toFixed(2)}`,
          TO: TO.toFixed(2),
          GMBS: GMBS.toFixed(2) + '%',
          DM: DM.toFixed(2) + '%'
        });
      }
      
      const result = {
        TO: round2(TO),
        DM: round2(DM),
        GMBS: round2(GMBS),
        total_dm_costs: round2(totalDmCosts),
        total_gmbs_costs: round2(totalGmbsCosts)
      };
      
      console.log('✅ [calcBulkMargins] FALLBACK result:', result);
      return result;
    }
    
    console.log('❌ [calcBulkMargins] No data found even in fallback, returning zeros');
    return { TO: 0, DM: 0, GMBS: 0, total_dm_costs: 0, total_gmbs_costs: 0 };
  }
  
  // Calculate total costs using the new formulas
  console.log('🧮 [calcBulkMargins] Starting main calculation with valid data...');
  let totalDmCosts = 0;
  let totalGmbsCosts = 0;
  
  for (const stepCost of stepCosts) {
    const { 
      deliverable_id, salaries_costs, management_costs, npt_costs, it_costs, premises_costs,
      it_recurrent_costs, travel_costs, subco_costs, purchases_costs, activity_rate 
    } = stepCost;
    
    // Get quantity for this deliverable (default to 1 if not found)
    const quantity = quantityMap.get(deliverable_id) || 1;
    
    // Ensure all values are numbers to avoid toFixed errors
    const salariesNum = Number(salaries_costs || 0);
    const managementNum = Number(management_costs || 0);
    const nptNum = Number(npt_costs || 0);
    const itNum = Number(it_costs || 0);
    const premisesNum = Number(premises_costs || 0);
    const itRecurrentNum = Number(it_recurrent_costs || 0);
    const travelNum = Number(travel_costs || 0);
    const subcoNum = Number(subco_costs || 0);
    const purchasesNum = Number(purchases_costs || 0);
    const activityRateNum = Number(activity_rate || 100);
    
    // OPERATIONAL COSTS: Multiply base costs by quantity, then apply activity rate
    const operationalBase = (salariesNum + managementNum + nptNum + itNum + premisesNum) * quantity;
    const adjustedOperational = (operationalBase * activityRateNum) / 100;
    
    // NON-OPERATIONAL COSTS: Add directly without multiplying by quantity
    const nonOperational = itRecurrentNum + travelNum + subcoNum + purchasesNum;
    
    const stepDmCosts = adjustedOperational + nonOperational;
    const stepGmbsCosts = operationalBase + nonOperational;
    
    console.log(`💰 [calcBulkMargins] Step ${stepCost.step_id} (Deliverable ${deliverable_id}) costs calculation:`, {
      quantity: quantity,
      operationalBaseCosts: `${salariesNum + managementNum + nptNum + itNum + premisesNum} × ${quantity} = ${operationalBase.toFixed(2)}`,
      activity_rate: activityRateNum + '%',
      adjustedOperational: adjustedOperational.toFixed(2),
      nonOperational: nonOperational.toFixed(2),
      stepDmCosts: stepDmCosts.toFixed(2),
      stepGmbsCosts: stepGmbsCosts.toFixed(2)
    });
    
    totalDmCosts += stepDmCosts;
    totalGmbsCosts += stepGmbsCosts;
  }
  
  console.log('🧮 [calcBulkMargins] MAIN calculation totals:', {
    totalDmCosts: totalDmCosts.toFixed(2),
    totalGmbsCosts: totalGmbsCosts.toFixed(2),
    marginType,
    marginGoal: marginGoal + '%'
  });
  
  // Calculate margins based on margin type
  let TO: number;
  let DM: number;
  let GMBS: number;
  
  const marginGoalDecimal = marginGoal / 100;
  
  if (marginType === 'DM') {
    // If margin_type is DM:
    // TO = del_total_dm_costs / (1 - margin_goal/100)
    // GMBS = (1 - del_total_gmbs_costs/TO) * 100
    TO = totalDmCosts / (1 - marginGoalDecimal);
    DM = marginGoal; // DM is the target margin
    GMBS = totalGmbsCosts > 0 ? (1 - (totalGmbsCosts / TO)) * 100 : 0;
    
    console.log('📈 [calcBulkMargins] DM calculation:', {
      formula: `${totalDmCosts.toFixed(2)} / (1 - ${marginGoalDecimal}) = ${TO.toFixed(2)}`,
      TO: TO.toFixed(2),
      DM: DM.toFixed(2) + '%',
      GMBS: GMBS.toFixed(2) + '%'
    });
  } else if (marginType === 'GMBS') {
    // If margin_type is GMBS:
    // TO = del_total_gmbs_costs / (1 - margin_goal/100)
    // DM = (1 - del_total_dm_costs/TO) * 100
    TO = totalGmbsCosts / (1 - marginGoalDecimal);
    GMBS = marginGoal; // GMBS is the target margin
    DM = totalDmCosts > 0 ? (1 - (totalDmCosts / TO)) * 100 : 0;
    
    console.log('📈 [calcBulkMargins] GMBS calculation:', {
      formula: `${totalGmbsCosts.toFixed(2)} / (1 - ${marginGoalDecimal}) = ${TO.toFixed(2)}`,
      TO: TO.toFixed(2),
      GMBS: GMBS.toFixed(2) + '%',
      DM: DM.toFixed(2) + '%'
    });
  } else {
    throw new Error(`Invalid margin type: ${marginType}`);
  }
  
  // Round results
  TO = round2(TO);
  DM = round2(DM);
  GMBS = round2(GMBS);
  
  const result = {
    TO,
    DM,
    GMBS,
    total_dm_costs: round2(totalDmCosts),
    total_gmbs_costs: round2(totalGmbsCosts)
  };
  
  console.log('✅ [calcBulkMargins] MAIN RESULT:', result);
  return result;
}

export async function recalcDeliverablesYearlyForProject(projectId: number, db: DB): Promise<YearlyCalcRow[]> {
  console.log('\n🔄 [recalcDeliverablesYearlyForProject] Starting for project:', projectId);
  
  // 1) Get project margin info
  const pRes = await db.query<{ margin_type: string; margin_goal: number; start_date?: string }>(`SELECT margin_type, margin_goal, start_date FROM projects WHERE id=$1`, [projectId]);
  if (!pRes.rows || pRes.rows.length === 0) throw new Error('Project not found');
  const { margin_type, margin_goal } = pRes.rows[0];
  if (margin_type == null || margin_goal == null) throw new Error('Project margin_type or margin_goal undefined');

  const marginType = String(margin_type).toUpperCase() as 'DM' | 'GMBS';
  console.log('📋 [recalcDeliverablesYearlyForProject] Project config:', {
    marginType,
    marginGoal: margin_goal + '%'
  });
  
  // 2) Get deliverable ids for project
  const dRes = await db.query<{ id: number }>(`SELECT d.id FROM deliverables d JOIN workpackages wp ON d.workpackage_id = wp.id WHERE wp.project_id = $1`, [projectId]);
  const deliverableIds = dRes.rows.map(r => r.id);
  console.log('📦 [recalcDeliverablesYearlyForProject] Found deliverables:', deliverableIds);
  if (deliverableIds.length === 0) {
    console.log('⚠️ [recalcDeliverablesYearlyForProject] No deliverables found for project');
    return [];
  }

  // 3) Get all yearly quantities for these deliverables
  const qtyRes = await db.query<{ deliverable_id: number; year_number: number; quantity: number }>(`SELECT deliverable_id, year_number, quantity FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1::int[]) ORDER BY deliverable_id, year_number`, [deliverableIds]);
  console.log('📅 [recalcDeliverablesYearlyForProject] Found yearly quantities:', {
    count: qtyRes.rows.length,
    sample: qtyRes.rows.length > 0 ? qtyRes.rows[0] : 'No data'
  });

  // 4) Get project start year for calendar year mapping
  const startDateRaw: any = pRes.rows[0]?.start_date;
  const projectStartYear = startDateRaw ? new Date(startDateRaw).getFullYear() : new Date().getFullYear();

  const rows: YearlyCalcRow[] = [];

  // Group quantities by deliverable and year
  const deliverableYears: Record<string, { deliverableId: number; year: number; quantity: number; calendarYear: number }> = {};
  for (const q of qtyRes.rows) {
    const calendarYear = projectStartYear + q.year_number - 1;
    deliverableYears[`${q.deliverable_id}_${q.year_number}`] = {
      deliverableId: q.deliverable_id,
      year: q.year_number,
      quantity: Number(q.quantity || 0),
      calendarYear
    };
  }

  // Calculate margins for each deliverable-year combination using the new bulk calculation
  console.log('🧮 [recalcDeliverablesYearlyForProject] Processing deliverable-year combinations...');
  for (const key of Object.keys(deliverableYears)) {
    const { deliverableId, year, quantity, calendarYear } = deliverableYears[key];
    
    console.log(`🎯 [recalcDeliverablesYearlyForProject] Processing deliverable ${deliverableId}, year ${year} (calendar ${calendarYear})`);
    
    // Get all steps for this deliverable
    const stepsRes = await db.query<{ id: number }>(`SELECT id FROM steps WHERE deliverable_id = $1`, [deliverableId]);
    const stepIds = stepsRes.rows.map(r => r.id);
    
    console.log(`📊 [recalcDeliverablesYearlyForProject] Found ${stepIds.length} steps for deliverable ${deliverableId}:`, stepIds);
    
    if (stepIds.length === 0) {
      console.log(`⚠️ [recalcDeliverablesYearlyForProject] No steps found for deliverable ${deliverableId}, adding empty row`);
      // Add empty row
      rows.push({ 
        deliverableId, 
        year, 
        quantity, 
        operationalTo: 0, 
        dmRealPct: 0, 
        gmbsRealPct: 0, 
        opCostYear: 0, 
        nopCostYear: 0 
      });
      continue;
    }
    
    // Calculate bulk margins for all steps in this deliverable
    console.log(`🧮 [recalcDeliverablesYearlyForProject] Calling calcBulkMargins for deliverable ${deliverableId} with:`, {
      stepIds,
      calendarYear,
      marginType,
      marginGoal: Number(margin_goal)
    });
    
    try {
      const marginResult = await calcBulkMargins({
        stepIds,
        year: calendarYear,
        marginType,
        marginGoal: Number(margin_goal),
        db
      });
      
      console.log(`✅ [recalcDeliverablesYearlyForProject] calcBulkMargins result for deliverable ${deliverableId}:`, marginResult);
      
      // Store the result
      const calculatedRow = {
        deliverableId,
        year,
        quantity,
        operationalTo: marginResult.TO,
        dmRealPct: marginResult.DM,
        gmbsRealPct: marginResult.GMBS,
        opCostYear: marginResult.total_dm_costs, // Using DM costs as operational approximation
        nopCostYear: marginResult.total_gmbs_costs - marginResult.total_dm_costs // Difference as non-op approximation
      };
      
      console.log(`📊 [recalcDeliverablesYearlyForProject] Adding calculated row for deliverable ${deliverableId}:`, calculatedRow);
      rows.push(calculatedRow);
      
    } catch (error) {
      console.log(`❌ [recalcDeliverablesYearlyForProject] Error calculating margins for deliverable ${deliverableId}:`, error);
      
      // Add error row with zeros
      rows.push({ 
        deliverableId, 
        year, 
        quantity, 
        operationalTo: 0, 
        dmRealPct: 0, 
        gmbsRealPct: 0, 
        opCostYear: 0, 
        nopCostYear: 0 
      });
    }
  }

  console.log(`✅ [recalcDeliverablesYearlyForProject] COMPLETED: Generated ${rows.length} calculation rows for project ${projectId}`);
  return rows;
}

export interface DeliverableCostRow {
  deliverableId: number;
  year_number: number;
  calendarYear: number;
  opRecurrentSum: number;
  opNonRecurrentSum: number;
  nopSum: number;
}

// Calculate costs (recurrent op, non-recurrent op, non-operational) for an array of deliverables.
// Each deliverable has { id, yearlyQuantities?: number[] } where index 0 -> year_number 1.
export async function calcDeliverablesCosts(deliverables: { id: number; yearlyQuantities?: number[] }[], projectStartDate: string | undefined, db: DB): Promise<DeliverableCostRow[]> {
  if (!Array.isArray(deliverables) || deliverables.length === 0) return [];
  const projectStartYear = projectStartDate ? new Date(projectStartDate).getFullYear() : new Date().getFullYear();

  const tuples: number[] = [];
  const valuesParts: string[] = [];
  let paramIdx = 1;
  for (const d of deliverables) {
    const id = Number(d.id);
    const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
    for (let i = 0; i < yq.length; i++) {
      const calendarYear = projectStartYear + i;
      valuesParts.push(`($${paramIdx++}::int, $${paramIdx++}::int, $${paramIdx++}::int)`); // id, calendarYear, year_number
      tuples.push(id, calendarYear, i + 1);
    }
  }
  if (valuesParts.length === 0) return [];

  const valuesSql = valuesParts.join(',');
  const q = `
    WITH dy(did, year, year_number) AS (VALUES ${valuesSql})
    SELECT dy.did AS deliverable_id, dy.year_number::int AS year_number, dy.year::int AS calendar_year,
      COALESCE(SUM(
        COALESCE(syd.salaries_cost,0) + COALESCE(syd.management_costs,0) + COALESCE(syd.it_recurrent_costs,0) + COALESCE(syd.premises_costs,0)
      ),0)::numeric AS op_recurrent_sum,
      COALESCE(SUM(
        COALESCE(syd.it_costs,0) + COALESCE(syd.travel_costs,0) + COALESCE(syd.subco_costs,0) + COALESCE(syd.purchases_costs,0)
      ),0)::numeric AS op_non_recurrent_sum,
      0::numeric AS nop_sum
    FROM steps s
    JOIN dy ON dy.did = s.deliverable_id
    JOIN step_yearly_data syd ON syd.step_id = s.id AND syd.year = dy.year
    GROUP BY dy.did, dy.year_number, dy.year
  `;

  const r = await db.query<{ deliverable_id: number; year_number: number; calendar_year: number; op_recurrent_sum: string; op_non_recurrent_sum: string; nop_sum: string }>(q, tuples);
  const resRows = r.rows || [];

  // Build map for quick lookup
  const byKey: Record<string, DeliverableCostRow> = {};
  for (const rr of resRows) {
    const did = Number(rr.deliverable_id);
    const yrn = Number(rr.year_number);
    byKey[`${did}_${yrn}`] = {
      deliverableId: did,
      year_number: yrn,
      calendarYear: Number(rr.calendar_year),
      opRecurrentSum: Number(rr.op_recurrent_sum || 0),
      opNonRecurrentSum: Number(rr.op_non_recurrent_sum || 0),
      nopSum: Number(rr.nop_sum || 0),
    };
  }

  const out: DeliverableCostRow[] = [];
  // ensure we return an entry for every deliverable-year requested (zeros when missing)
  for (const d of deliverables) {
    const id = Number(d.id);
    const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
    for (let i = 0; i < yq.length; i++) {
      const year_number = i + 1;
      const existing = byKey[`${id}_${year_number}`];
      if (existing) out.push(existing);
      else out.push({ deliverableId: id, year_number, calendarYear: projectStartYear + (year_number - 1), opRecurrentSum: 0, opNonRecurrentSum: 0, nopSum: 0 });
    }
  }

  return out;
}

// Calculate operational DM for a set of deliverables.
// - deliverables: array of { id, yearlyQuantities?: number[] }
// - projectStartDate: optional project start date to map ordinal years
// Returns totals and the computed operational DM: (1 - (operationalCosts / TO)) * 100
export async function calcOperationalDMForDeliverables(deliverables: { id: number; yearlyQuantities?: number[] }[], projectStartDate: string | undefined, db: DB): Promise<{ totalOpRecurrent: number; totalOpNonRecurrent: number; totalNop: number; totalOperationalCosts: number; totalTO: number; projectDM: number }> {
  if (!Array.isArray(deliverables) || deliverables.length === 0) {
    return { totalOpRecurrent: 0, totalOpNonRecurrent: 0, totalNop: 0, totalOperationalCosts: 0, totalTO: 0, projectDM: 0 };
  }

  // use the existing helper to get per-deliverable-year cost sums
  const costRows = await calcDeliverablesCosts(deliverables, projectStartDate, db);

  // build a map of quantities by deliverable-year from the input deliverables array
  const qtyMap: Record<string, number> = {};
  for (const d of deliverables) {
    const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
    for (let i = 0; i < yq.length; i++) {
      const year_number = i + 1;
      qtyMap[`${d.id}_${year_number}`] = Number(yq[i] || 0);
    }
  }

  let totalOpRecurrent = 0;
  let totalOpNonRecurrent = 0;
  let totalNop = 0;
  let totalOperationalCosts = 0;

  for (const cr of costRows) {
    const key = `${cr.deliverableId}_${cr.year_number}`;
    const qty = Number(qtyMap[key] || 0);
    const opRecurrentContribution = Number(cr.opRecurrentSum || 0) * qty;
    const opNonRecurrentContribution = Number(cr.opNonRecurrentSum || 0);
    const nopContribution = Number(cr.nopSum || 0) * qty;

    totalOpRecurrent += opRecurrentContribution;
    totalOpNonRecurrent += opNonRecurrentContribution;
    totalNop += nopContribution;
    totalOperationalCosts += opRecurrentContribution + opNonRecurrentContribution; // operational costs include both
  }

  // compute TO as sum of deliverable_yearly_quantities.operational_to for the deliverables provided
  const ids = deliverables.map(d => d.id);
  const q = `SELECT COALESCE(SUM(operational_to),0)::numeric AS total_to FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1::int[])`;
  const r = await db.query<{ total_to: string }>(q, [ids]);
  const totalTO = Number(r.rows[0]?.total_to || 0);

  let projectDM = 0;
  if (totalTO > 0) {
    projectDM = Number(((1 - (totalOperationalCosts / totalTO)) * 100).toFixed(2));
  }

  return { totalOpRecurrent: round2(totalOpRecurrent), totalOpNonRecurrent: round2(totalOpNonRecurrent), totalNop: round2(totalNop), totalOperationalCosts: round2(totalOperationalCosts), totalTO: round2(totalTO), projectDM };
}

// Calculate GMBS for a set of deliverables.
// GMBS = (1 - (opCost + nopCost) / TO) * 100
export async function calcGMBSForDeliverables(deliverables: { id: number; yearlyQuantities?: number[] }[], projectStartDate: string | undefined, db: DB): Promise<{ totalOpRecurrent: number; totalOpNonRecurrent: number; totalNop: number; totalOperationalCosts: number; totalTO: number; projectGMBS: number }> {
  if (!Array.isArray(deliverables) || deliverables.length === 0) {
    return { totalOpRecurrent: 0, totalOpNonRecurrent: 0, totalNop: 0, totalOperationalCosts: 0, totalTO: 0, projectGMBS: 0 };
  }

  // reuse cost calculation helper
  const costRows = await calcDeliverablesCosts(deliverables, projectStartDate, db);

  const qtyMap: Record<string, number> = {};
  for (const d of deliverables) {
    const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
    for (let i = 0; i < yq.length; i++) {
      const year_number = i + 1;
      qtyMap[`${d.id}_${year_number}`] = Number(yq[i] || 0);
    }
  }

  let totalOpRecurrent = 0;
  let totalOpNonRecurrent = 0;
  let totalNop = 0;
  let totalOperationalCosts = 0;

  for (const cr of costRows) {
    const key = `${cr.deliverableId}_${cr.year_number}`;
    const qty = Number(qtyMap[key] || 0);
    const opRecurrentContribution = Number(cr.opRecurrentSum || 0) * qty;
    const opNonRecurrentContribution = Number(cr.opNonRecurrentSum || 0);
    const nopContribution = Number(cr.nopSum || 0) * qty;

    totalOpRecurrent += opRecurrentContribution;
    totalOpNonRecurrent += opNonRecurrentContribution;
    totalNop += nopContribution;
    totalOperationalCosts += opRecurrentContribution + opNonRecurrentContribution;
  }

  const ids = deliverables.map(d => d.id);
  const q = `SELECT COALESCE(SUM(operational_to),0)::numeric AS total_to FROM deliverable_yearly_quantities WHERE deliverable_id = ANY($1::int[])`;
  const r = await db.query<{ total_to: string }>(q, [ids]);
  const totalTO = Number(r.rows[0]?.total_to || 0);

  let projectGMBS = 0;
  if (totalTO > 0) {
    projectGMBS = Number(((1 - ((totalOperationalCosts + totalNop) / totalTO)) * 100).toFixed(2));
  }

  return { totalOpRecurrent: round2(totalOpRecurrent), totalOpNonRecurrent: round2(totalOpNonRecurrent), totalNop: round2(totalNop), totalOperationalCosts: round2(totalOperationalCosts), totalTO: round2(totalTO), projectGMBS };
}

// Compute total working time for a project: SUM(step_yearly_data.process_time * deliverable_yearly_quantities.quantity)
// Compute total working time from an array of deliverables. Each deliverable should
// be an object { id: number, yearlyQuantities?: number[] } where yearlyQuantities
// is an array indexed by ordinal year (index 0 -> year_number 1) with the quantity.
// projectStartDate is optional; if provided it is used to map ordinal year -> calendar year,
// otherwise current year is used as baseline.
export async function calcProjectTotalWorkingTime(deliverables: { id: number; yearlyQuantities?: number[] }[], projectStartDate: string | undefined, db: DB): Promise<number> {
  if (!Array.isArray(deliverables) || deliverables.length === 0) return 0;

  const projectStartYear = projectStartDate ? new Date(projectStartDate).getFullYear() : new Date().getFullYear();

  // Build a VALUES list of (deliverable_id, calendar_year, quantity) from the deliverables' yearlyQuantities
  const tuples: Array<number> = []; // will hold params in order
  const valuesParts: string[] = [];
  let paramIdx = 1;
  for (const d of deliverables) {
    const id = Number(d.id);
    const yq = Array.isArray(d.yearlyQuantities) ? d.yearlyQuantities : [];
    for (let i = 0; i < yq.length; i++) {
      const qty = Number(yq[i] || 0);
      const calendarYear = projectStartYear + i; // year_number = i+1 -> calendarYear = startYear + (year_number-1)
    // cast to ensure Postgres infers the correct types (int for ids/years, numeric for quantities)
    valuesParts.push(`($${paramIdx++}::int, $${paramIdx++}::int, $${paramIdx++}::numeric)`);
      tuples.push(id, calendarYear, qty);
    }
  }

  if (valuesParts.length === 0) return 0;

  const valuesSql = valuesParts.join(',');

  const q = `
    WITH dy(did, year, qty) AS (VALUES ${valuesSql})
    SELECT COALESCE(SUM(
      CASE 
        WHEN LOWER(s.unit) = 'days' 
        THEN syd.process_time * pc.hours_per_day * dy.qty
        ELSE syd.process_time * dy.qty 
      END
    ),0)::numeric AS total_work_time
    FROM steps s
    JOIN step_yearly_data syd ON syd.step_id = s.id
    JOIN deliverables d ON s.deliverable_id = d.id
    JOIN workpackages wp ON d.workpackage_id = wp.id
    JOIN project_countries pc ON s.country_id = pc.country_id AND wp.project_id = pc.project_id
    JOIN dy ON dy.did = s.deliverable_id AND syd.year = dy.year
  `;

  const r = await db.query<{ total_work_time: string }>(q, tuples);
  const val = r.rows[0] ? Number(r.rows[0].total_work_time || 0) : 0;

  return val;
}

// Calculate margins for entire project (all deliverables aggregated)
export async function calcProjectMargins(projectId: number, year: number, db: DB): Promise<BulkMarginResult> {
  // Get project margin configuration
  const pRes = await db.query<{ margin_type: string; margin_goal: number }>(`SELECT margin_type, margin_goal FROM projects WHERE id=$1`, [projectId]);
  if (!pRes.rows || pRes.rows.length === 0) throw new Error('Project not found');
  const { margin_type, margin_goal } = pRes.rows[0];
  if (margin_type == null || margin_goal == null) throw new Error('Project margin_type or margin_goal undefined');

  const marginType = String(margin_type).toUpperCase() as 'DM' | 'GMBS';
  
  // Get all steps for this project through deliverables and workpackages
  const stepsRes = await db.query<{ id: number }>(`
    SELECT s.id 
    FROM steps s
    JOIN deliverables d ON s.deliverable_id = d.id
    JOIN workpackages wp ON d.workpackage_id = wp.id
    WHERE wp.project_id = $1
  `, [projectId]);
  
  const stepIds = stepsRes.rows.map(r => r.id);
  
  if (stepIds.length === 0) {
    return {
      TO: 0,
      DM: 0,
      GMBS: 0,
      total_dm_costs: 0,
      total_gmbs_costs: 0
    };
  }
  
  // Calculate bulk margins for all steps in the project
  return await calcBulkMargins({
    stepIds,
    year,
    marginType,
    marginGoal: Number(margin_goal),
    db
  });
}

// Calculate margins for specific deliverable
export async function calcDeliverableMargins(deliverableId: number, year: number, db: DB): Promise<BulkMarginResult> {
  // Get project margin configuration through deliverable
  const pRes = await db.query<{ margin_type: string; margin_goal: number }>(`
    SELECT p.margin_type, p.margin_goal 
    FROM projects p
    JOIN workpackages wp ON p.id = wp.project_id
    JOIN deliverables d ON wp.id = d.workpackage_id
    WHERE d.id = $1
  `, [deliverableId]);
  
  if (!pRes.rows || pRes.rows.length === 0) throw new Error('Deliverable or project not found');
  const { margin_type, margin_goal } = pRes.rows[0];
  if (margin_type == null || margin_goal == null) throw new Error('Project margin_type or margin_goal undefined');

  const marginType = String(margin_type).toUpperCase() as 'DM' | 'GMBS';
  
  // Get all steps for this deliverable
  const stepsRes = await db.query<{ id: number }>(`SELECT id FROM steps WHERE deliverable_id = $1`, [deliverableId]);
  const stepIds = stepsRes.rows.map(r => r.id);
  
  if (stepIds.length === 0) {
    return {
      TO: 0,
      DM: 0,
      GMBS: 0,
      total_dm_costs: 0,
      total_gmbs_costs: 0
    };
  }
  
  // Calculate bulk margins for all steps in the deliverable
  return await calcBulkMargins({
    stepIds,
    year,
    marginType,
    marginGoal: Number(margin_goal),
    db
  });
}
