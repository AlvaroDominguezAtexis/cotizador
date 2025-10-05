import type { QueryResult } from 'pg';

export interface DBClient {
  query: (text: string, params?: any[]) => Promise<QueryResult<any>>;
}

export async function calcAnnualHours(params: {
  projectId: number;
  countryId: number;
  db: DBClient;
}): Promise<number> {
  const { projectId, countryId, db } = params;
  const { rows } = await db.query(
    `SELECT working_days, activity_rate, hours_per_day
       FROM project_countries
      WHERE project_id=$1 AND country_id=$2
      LIMIT 1`,
    [projectId, countryId]
  );
  if (rows.length === 0) {
    const err: any = new Error('No existe configuración de país para el proyecto');
    err.status = 400;
    err.code = 'PROJECT_COUNTRY_NOT_FOUND';
    throw err;
  }
  const wd = Number(rows[0].working_days || 0);
  const ar = Number(rows[0].activity_rate || 0);
  const hpd = Number(rows[0].hours_per_day || 0);
  const annualHours = wd * ar/100 * hpd;
  if (!(annualHours > 0)) {
    const err: any = new Error('annual_hours debe ser > 0');
    err.status = 400;
    err.code = 'INVALID_ANNUAL_HOURS';
    throw err;
  }
  return annualHours;
}

export async function calcStepSalariesCost(params: {
  stepId: number;
  db: DBClient;
  year?: number;
}): Promise<{
  annualHours: number;
  hourlyRate: number;
  processHours: number;
  salariesCost: number;
  salary: number;
  year: number;
}> {
  const { stepId, db, year } = params;

  // 1) Load step with project
  const stepRes = await db.query(
    `SELECT s.id, s.profile_id, s.country_id, s.nombre AS name, s.unit AS process_time_unit,
            wp.project_id
       FROM steps s
       JOIN deliverables d ON d.id = s.deliverable_id
       JOIN workpackages wp ON wp.id = d.workpackage_id
      WHERE s.id = $1
      LIMIT 1`,
    [stepId]
  );
  if (stepRes.rows.length === 0) {
    const err: any = new Error('Step no encontrado');
    err.status = 404;
    throw err;
  }
  const step = stepRes.rows[0];
  if (!step.name || !step.profile_id || !step.country_id) {
    const err: any = new Error('name, profile_id y country_id son obligatorios en el step');
    err.status = 400;
    err.code = 'STEP_REQUIRED_FIELDS';
    throw err;
  }

  // process_time and target year
  let targetYear: number | null = null;
  let process_time = 0;
  if (typeof year === 'number') {
    const pr = await db.query(
      `SELECT year, process_time FROM step_yearly_data WHERE step_id=$1 AND year=$2 LIMIT 1`,
      [stepId, year]
    );
    if (pr.rows.length === 0) {
      const err: any = new Error('No existe registro anual para el step en el año indicado');
      err.status = 404;
      err.code = 'STEP_YEAR_NOT_FOUND';
      throw err;
    }
    targetYear = Number(pr.rows[0].year);
    process_time = Number(pr.rows[0].process_time || 0);
  } else {
    const pr = await db.query(
      `SELECT year, process_time
         FROM step_yearly_data
        WHERE step_id = $1
        ORDER BY year ASC NULLS LAST
        LIMIT 1`,
      [stepId]
    );
    if (pr.rows.length === 0) {
      const err: any = new Error('No existen registros anuales para el step');
      err.status = 404;
      err.code = 'STEP_YEARS_EMPTY';
      throw err;
    }
    targetYear = Number(pr.rows[0].year);
    process_time = Number(pr.rows[0].process_time || 0);
  }

  // 2) Annual hours
  const annualHours = await calcAnnualHours({ projectId: Number(step.project_id), countryId: Number(step.country_id), db });

  // 3) Salary from project_profile_salaries for the target year
  const salRes = await db.query(
    `SELECT pps.salary
       FROM project_profile_salaries pps
       JOIN project_profiles pp ON pp.id = pps.project_profile_id
      WHERE pp.project_id=$1 AND pp.profile_id=$2 AND pps.country_id=$3 AND pps.year=$4
      LIMIT 1`,
    [step.project_id, step.profile_id, step.country_id, targetYear]
  );
  if (salRes.rows.length === 0 || salRes.rows[0].salary == null) {
    const err: any = new Error('No existe salary para (project_id, profile_id, country_id, year)');
    err.status = 400;
    err.code = 'SALARY_NOT_FOUND';
    throw err;
  }
  const salary = Number(salRes.rows[0].salary);

  // 4) Social contribution rate and hours_per_day for process_hours
  const pcRes = await db.query(
    `SELECT hours_per_day, social_contribution_rate
       FROM project_countries
      WHERE project_id=$1 AND country_id=$2
      LIMIT 1`,
    [step.project_id, step.country_id]
  );
  if (pcRes.rows.length === 0) {
    const err: any = new Error('No existe configuración de país para el proyecto');
    err.status = 400;
    err.code = 'PROJECT_COUNTRY_NOT_FOUND';
    throw err;
  }
  const hours_per_day = Number(pcRes.rows[0].hours_per_day || 0);
  const social_contribution_rate = Number(pcRes.rows[0].social_contribution_rate || 0);

  const unit = String(step.process_time_unit || '').toLowerCase();
  const processHours = unit === 'days' ? process_time * hours_per_day : process_time;
  const hourlyRate = (salary * (1 + social_contribution_rate/100)) / annualHours;
  const salariesCost = processHours * hourlyRate;

  return {
    annualHours,
    hourlyRate,
    processHours,
    salariesCost,
    salary,
    year: targetYear!,
  };
}

export async function calcStepManagementCost(params: {
  stepId: number;
  db: DBClient;
  year?: number;
}): Promise<{
  managementCost: number;
  year: number;
  managementHourlyRate: number;
  processHours: number;
  totalProcessTimeHours: number;
  mngPercentage: number;
}> {
  const { stepId, db, year } = params;

  console.log(`\n🚀 STARTING calcStepManagementCost for Step ID: ${stepId}, Year: ${year || 'auto'}`);

  // 1) Load step with project and country info
  const stepRes = await db.query(
    `SELECT s.id, s.country_id, s.unit, wp.project_id
     FROM steps s
     JOIN deliverables d ON d.id = s.deliverable_id
     JOIN workpackages wp ON wp.id = d.workpackage_id
     WHERE s.id = $1
     LIMIT 1`,
    [stepId]
  );

  if (stepRes.rows.length === 0) {
    console.error(`❌ Step ${stepId} not found in database`);
    const err: any = new Error('Step no encontrado');
    err.status = 404;
    throw err;
  }

  const stepInfo = stepRes.rows[0];
  const stepUnit = String(stepInfo.unit || 'days').toLowerCase(); // Default to 'days' if unit is not specified
  console.log(`✅ Step found: Project ID ${stepInfo.project_id}, Country ID ${stepInfo.country_id}, Unit: ${stepUnit}`);

  // 2) Get yearly data if it exists
  console.log(`📊 Loading yearly data from step_yearly_data...`);
  let yearlyData;
  if (typeof year === 'number') {
    console.log(`   Looking for specific year: ${year}`);
    const yearRes = await db.query(
      `SELECT year, process_time, mng 
       FROM step_yearly_data 
       WHERE step_id = $1 AND year = $2
       LIMIT 1`,
      [stepId, year]
    );
    yearlyData = yearRes.rows[0];
  } else {
    console.log(`   Looking for any year (first available)`);
    const yearRes = await db.query(
      `SELECT year, process_time, mng 
       FROM step_yearly_data 
       WHERE step_id = $1 
       ORDER BY year ASC 
       LIMIT 1`,
      [stepId]
    );
    yearlyData = yearRes.rows[0];
  }

  // If no yearly data found, try to get defaults from project_countries
  if (!yearlyData) {
    console.log(`⚠️  No yearly data found in step_yearly_data, loading defaults from project_countries...`);
    const defaultsRes = await db.query(
      `SELECT mng FROM project_countries 
       WHERE project_id = $1 AND country_id = $2 
       LIMIT 1`,
      [stepInfo.project_id, stepInfo.country_id]
    );
    yearlyData = {
      year: year || new Date().getFullYear(),
      process_time: 0,
      mng: defaultsRes.rows[0]?.mng || 0
    };
    console.log(`   Using defaults: year=${yearlyData.year}, process_time=${yearlyData.process_time}, mng=${yearlyData.mng}%`);
  } else {
    console.log(`✅ Yearly data found: year=${yearlyData.year}, process_time=${yearlyData.process_time}, mng=${yearlyData.mng}%`);
  }

  const step = stepRes.rows[0];
  const targetYear = Number(yearlyData.year);
  const processTime = Number(yearlyData.process_time || 0);
  const mngPercentage = Number(yearlyData.mng || 0);

  // 2) Get management yearly salary, social contribution rate, and npt_rate
  console.log(`🌍 Loading country configuration from project_countries...`);
  const countryConfigRes = await db.query(
    `SELECT management_yearly_salary, social_contribution_rate, npt_rate, hours_per_day
     FROM project_countries
     WHERE project_id = $1 AND country_id = $2`,
    [stepInfo.project_id, stepInfo.country_id]
  );

  if (countryConfigRes.rows.length === 0) {
    console.error(`❌ Country configuration not found for Project ID ${stepInfo.project_id}, Country ID ${stepInfo.country_id}`);
    const err: any = new Error('Configuración de país no encontrada');
    err.status = 404;
    throw err;
  }

  const configRow = countryConfigRes.rows[0];
  const managementYearlySalary = Number(configRow.management_yearly_salary || 0);
  const socialContributionRate = Number(configRow.social_contribution_rate || 0);
  const nptRate = Number(configRow.npt_rate || 0);
  const hoursPerDay = Number(configRow.hours_per_day || 8);
  
  console.log(`✅ Country config loaded:`, {
    management_yearly_salary: managementYearlySalary,
    social_contribution_rate: socialContributionRate,
    npt_rate: nptRate,
    hours_per_day: hoursPerDay
  });

  // 3) Calculate annual hours
  const annualHours = await calcAnnualHours({
    projectId: Number(stepInfo.project_id),
    countryId: Number(stepInfo.country_id),
    db
  });

  // 4) Calculate management hourly rate
  const adjustedYearlySalary = managementYearlySalary * (1 + socialContributionRate/100);
  const managementHourlyRate = adjustedYearlySalary / annualHours;

  // 5) Calculate Total Process Time Hours and Management Cost
  console.log(`\n=== MANAGEMENT COST CALCULATION STEP BY STEP - Step ${stepId}, Year ${targetYear} ===`);
  
  // Convert process_time to hours based on unit
  let processHours: number;
  if (stepUnit === 'days') {
    processHours = processTime * hoursPerDay;
    console.log(`1. Process Time Conversion: ${processTime} days × ${hoursPerDay} hours/day = ${processHours} hours`);
  } else {
    processHours = processTime;
    console.log(`1. Process Hours (already in hours): ${processHours}`);
  }
  console.log(`   - Original process_time: ${processTime} ${stepUnit}`);
  
  // Log all input parameters
  console.log(`2. Input Parameters:`);
  console.log(`   - Management Yearly Salary: ${managementYearlySalary} €`);
  console.log(`   - Social Contribution Rate: ${socialContributionRate}%`);
  console.log(`   - Management Percentage: ${mngPercentage}%`);
  console.log(`   - NPT Rate: ${nptRate}%`);
  console.log(`   - Hours Per Day: ${hoursPerDay}`);
  console.log(`   - Annual Hours: ${annualHours}`);
  
  // Calculate adjusted yearly salary
  console.log(`3. Management Hourly Rate Calculation:`);
  console.log(`   - Adjusted Yearly Salary = ${managementYearlySalary} × (1 + ${socialContributionRate}/100)`);
  console.log(`   - Adjusted Yearly Salary = ${managementYearlySalary} × ${1 + socialContributionRate/100} = ${adjustedYearlySalary} €`);
  console.log(`   - Management Hourly Rate = ${adjustedYearlySalary} / ${annualHours} = ${managementHourlyRate} €/hour`);
  
  // Calculate Total Process Time using the same formula as NPT Costs
  // Formula: processHours / (1 - mng/100 - npt_rate/100)
  console.log(`4. Total Process Time Calculation:`);
  console.log(`   - Formula: processHours / (1 - mng/100 - npt_rate/100)`);
  console.log(`   - Denominator = 1 - (${mngPercentage}/100) - (${nptRate}/100)`);
  const denominator = 1 - (mngPercentage / 100) - (nptRate / 100);
  console.log(`   - Denominator = 1 - ${mngPercentage/100} - ${nptRate/100} = ${denominator}`);
  
  if (denominator <= 0) {
    console.error(`❌ INVALID DENOMINATOR: ${denominator} (must be > 0)`);
    console.error(`   This happens when mng% + npt_rate% >= 100%`);
    console.error(`   Current: ${mngPercentage}% + ${nptRate}% = ${mngPercentage + nptRate}%`);
    const managementCost = 0;
    console.log(`   Management Cost = 0 (due to invalid denominator)\n`);
    return {
      managementCost,
      year: targetYear,
      managementHourlyRate,
      processHours,
      totalProcessTimeHours: processHours, // Fallback to processHours when denominator is invalid
      mngPercentage
    };
  }
  
  const totalProcessTimeHours = processHours / denominator;
  console.log(`   - Total Process Time Hours = ${processHours} / ${denominator} = ${totalProcessTimeHours} hours`);
  
  // Management Cost = Total Process Time Hours × Management Hourly Rate × (mng/100)
  console.log(`5. Management Cost Calculation:`);
  console.log(`   - Formula: Total Process Time Hours × Management Hourly Rate × (mng/100)`);
  console.log(`   - Management Cost = ${totalProcessTimeHours} × ${managementHourlyRate} × (${mngPercentage}/100)`);
  console.log(`   - Management Cost = ${totalProcessTimeHours} × ${managementHourlyRate} × ${mngPercentage/100}`);
  const managementCost = totalProcessTimeHours * managementHourlyRate * (mngPercentage/100);
  console.log(`   - Management Cost = ${managementCost} €`);
  
  console.log(`\n✅ FINAL RESULT - Management Cost: ${managementCost} €`);
  console.log(`=== END MANAGEMENT COST CALCULATION ===\n`);

  return {
    managementCost,
    year: targetYear,
    managementHourlyRate,
    processHours,
    totalProcessTimeHours,
    mngPercentage
  };
}

export async function saveStepManagementCost(params: {
  stepId: number;
  year: number;
  managementCost: number;
  db: DBClient;
}): Promise<void> {
  const { stepId, year, managementCost, db } = params;
  await db.query(
    `UPDATE step_yearly_data 
     SET management_costs = $3
     WHERE step_id = $1 AND year = $2`,
    [stepId, year, managementCost]
  );
}

export async function calculateStepFTE(params: {
  stepId: number;
  year: number;
  processTime: number;
  db: DBClient;
}): Promise<number> {
  const { stepId, db } = params;
  
  // Get project and country info for the step
  const stepRes = await db.query(
    `SELECT s.id, s.country_id, wp.project_id
     FROM steps s
     JOIN deliverables d ON d.id = s.deliverable_id
     JOIN workpackages wp ON wp.id = d.workpackage_id
     WHERE s.id = $1
     LIMIT 1`,
    [stepId]
  );

  if (stepRes.rows.length === 0) {
    throw new Error('Step not found');
  }

  const step = stepRes.rows[0];
  
  // Calculate annual hours
  const annualHours = await calcAnnualHours({
    projectId: Number(step.project_id),
    countryId: Number(step.country_id),
    db
  });

  // Calculate FTE
  const fte = params.processTime / annualHours;
  return fte;
}

export async function saveStepFTE(params: {
  stepId: number;
  year: number;
  fte: number;
  db: DBClient;
}): Promise<void> {
  const { stepId, year, fte, db } = params;
  await db.query(
    `UPDATE step_yearly_data 
     SET fte = $3
     WHERE step_id = $1 AND year = $2`,
    [stepId, year, fte]
  );
}

export async function saveStepSalariesCost(params: {
  stepId: number;
  year: number;
  salariesCost: number;
  db: DBClient;
}): Promise<void> {
  const { stepId, year, salariesCost, db } = params;
  await db.query(
    `INSERT INTO step_yearly_data (step_id, year, salaries_cost)
     VALUES ($1, $2, $3)
     ON CONFLICT (step_id, year)
     DO UPDATE SET salaries_cost = EXCLUDED.salaries_cost`,
    [stepId, year, salariesCost]
  );
}

export async function calcStepNonProductiveCosts(params: {
  stepId: number;
  db: DBClient;
  year: number;
}): Promise<{ nonProductiveCosts: number; year: number }> {
  const { stepId, db, year } = params;

  // 1) Load step to get project and country
  const stepRes = await db.query(
    `SELECT s.id, s.country_id, wp.project_id
       FROM steps s
       JOIN deliverables d ON d.id = s.deliverable_id
       JOIN workpackages wp ON wp.id = d.workpackage_id
      WHERE s.id = $1
      LIMIT 1`,
    [stepId]
  );
  if (stepRes.rows.length === 0) {
    const err: any = new Error('Step no encontrado');
    err.status = 404;
    throw err;
  }
  const step = stepRes.rows[0];

  // 2) Read salaries_cost and management_costs for the year
  const sydRes = await db.query(
    `SELECT salaries_cost, management_costs FROM step_yearly_data WHERE step_id = $1 AND year = $2 LIMIT 1`,
    [stepId, year]
  );
  const salariesCost = Number(sydRes.rows[0]?.salaries_cost || 0);
  const managementCosts = Number(sydRes.rows[0]?.management_costs || 0);

  // 3) Read activity_rate from project_countries and calculate non-productive as (100 - activity_rate)
  const pcRes = await db.query(
    `SELECT activity_rate FROM project_countries WHERE project_id = $1 AND country_id = $2 LIMIT 1`,
    [step.project_id, step.country_id]
  );
  const activityRate = Number(pcRes.rows[0]?.activity_rate || 0);
  const npRate = 100 - activityRate; // Non-productive rate = (100 - activity_rate)

  // 4) Compute
  const nonProductiveCosts = (salariesCost + managementCosts) * (npRate / 100);

  return { nonProductiveCosts, year };
}







export async function calcStepNPTCosts(params: {
  stepId: number;
  db: DBClient;
  year?: number;
}): Promise<{ nptCosts: number; year: number }> {
  const { stepId, db, year } = params;

  console.log('[calcStepNPTCosts] called for stepId=', stepId, 'year=', year ?? 'latest');

  // 1) Load step with project and country info
  const stepRes = await db.query(
    `SELECT s.id, s.country_id, s.unit AS process_time_unit, wp.project_id
     FROM steps s
     JOIN deliverables d ON d.id = s.deliverable_id
     JOIN workpackages wp ON wp.id = d.workpackage_id
    WHERE s.id = $1
    LIMIT 1`,
    [stepId]
  );
  if (stepRes.rows.length === 0) {
    const err: any = new Error('Step no encontrado');
    err.status = 404;
    throw err;
  }

  const { country_id, process_time_unit, project_id } = stepRes.rows[0];

  // 2) Get project country info (npt_rate)
  const pcRes = await db.query(
    `SELECT npt_rate FROM project_countries WHERE project_id = $1 AND country_id = $2 LIMIT 1`,
    [project_id, country_id]
  );
  if (pcRes.rows.length === 0) {
    console.warn('[calcStepNPTCosts] No project_countries found for', { project_id, country_id });
    return { nptCosts: 0, year: year ?? new Date().getFullYear() };
  }
  const { npt_rate } = pcRes.rows[0];

  // 3) Get yearly data
  let targetYear = year;
  if (!targetYear) {
    // Get latest year
    const latestYearRes = await db.query(
      `SELECT year FROM step_yearly_data WHERE step_id = $1 ORDER BY year DESC LIMIT 1`,
      [stepId]
    );
    targetYear = latestYearRes.rows[0]?.year;
  }

  if (!targetYear) {
    console.warn('[calcStepNPTCosts] No yearly data found for step', stepId);
    return { nptCosts: 0, year: new Date().getFullYear() };
  }

  const yearlyRes = await db.query(
    `SELECT process_time, mng FROM step_yearly_data WHERE step_id = $1 AND year = $2 LIMIT 1`,
    [stepId, targetYear]
  );
  if (yearlyRes.rows.length === 0) {
    console.warn('[calcStepNPTCosts] No data found for', { stepId, year: targetYear });
    return { nptCosts: 0, year: targetYear };
  }

  const { process_time, mng: yearlyMng } = yearlyRes.rows[0];
  
  // 4) Get salary data for hourly rate calculation
  const salaryData = await calcStepSalariesCost({ stepId, year: targetYear, db });
  const { hourlyRate } = salaryData;

  // 5) Convert process_time to hours
  const processHours = process_time_unit?.toLowerCase() === 'days' ? process_time * 8 : process_time;

  // 6) Calculate Total Process Time Hours
  // Formula: processHours / (1 - mng/100 - npt_rate/100)
  const mngPercentage = yearlyMng != null ? yearlyMng : 0;
  const denominator = 1 - (mngPercentage / 100) - (npt_rate / 100);
  
  if (denominator <= 0) {
    console.warn('[calcStepNPTCosts] Invalid denominator', { mngPercentage, npt_rate, denominator });
    return { nptCosts: 0, year: targetYear };
  }

  const totalProcessTimeHours = processHours / denominator;

  // 7) Calculate NPT Costs
  // Formula: totalProcessTimeHours × hourlyRate × (npt_rate/100)
  const nptCosts = totalProcessTimeHours * hourlyRate * (npt_rate / 100);

  console.log('[calcStepNPTCosts] computed', { 
    stepId, 
    year: targetYear, 
    processHours, 
    mngPercentage, 
    npt_rate, 
    hourlyRate,
    totalProcessTimeHours,
    nptCosts 
  });

  return { nptCosts, year: targetYear };
}

export async function saveStepNPTCosts(params: {
  stepId: number;
  year: number;
  nptCosts: number;
  db: DBClient;
}): Promise<void> {
  const { stepId, year, nptCosts, db } = params;
  console.log('[saveStepNPTCosts] saving NPT costs', { stepId, year, nptCosts });

  await db.query(
    `UPDATE step_yearly_data SET npt_costs = $1 WHERE step_id = $2 AND year = $3`,
    [nptCosts, stepId, year]
  );
}

export async function calcStepPremisesCost(params: {
  stepId: number;
  db: DBClient;
  year?: number;
}): Promise<{ premisesCost: number; year: number }> {
  const { stepId, db, year } = params;

  console.log('[calcStepPremisesCost] called for stepId=', stepId, 'year=', year ?? 'latest');

  // 1) Load step with project and city/country info
  const stepRes = await db.query(
    `SELECT s.id, s.country_id, s.city_id, s.unit AS process_time_unit, wp.project_id
     FROM steps s
     JOIN deliverables d ON d.id = s.deliverable_id
     JOIN workpackages wp ON wp.id = d.workpackage_id
    WHERE s.id = $1
    LIMIT 1`,
    [stepId]
  );
  if (stepRes.rows.length === 0) {
    const err: any = new Error('Step no encontrado');
    err.status = 404;
    throw err;
  }
  const step = stepRes.rows[0];

  console.log('[calcStepPremisesCost] step loaded', { id: step.id, country_id: step.country_id, city_id: step.city_id, process_time_unit: step.process_time_unit, project_id: step.project_id });

  // 2) determine target year (use yearly row if exists, else earliest)
  let targetYear: number | null = null;
  if (typeof year === 'number') {
    const pr = await db.query(
      `SELECT year FROM step_yearly_data WHERE step_id=$1 AND year=$2 LIMIT 1`,
      [stepId, year]
    );
    if (pr.rows.length === 0) {
      const err: any = new Error('No existe registro anual para el step en el año indicado');
      err.status = 404;
      err.code = 'STEP_YEAR_NOT_FOUND';
      throw err;
    }
    targetYear = Number(pr.rows[0].year);
  } else {
    const pr = await db.query(
      `SELECT year FROM step_yearly_data WHERE step_id = $1 ORDER BY year ASC NULLS LAST LIMIT 1`,
      [stepId]
    );
    if (pr.rows.length === 0) {
      const err: any = new Error('No existen registros anuales para el step');
      err.status = 404;
      err.code = 'STEP_YEARS_EMPTY';
      throw err;
    }
    targetYear = Number(pr.rows[0].year);
  }

  // 3) Get process_time and mng for the target year, and country-level npt_rate / hours_per_day / mng default
  const prRes = await db.query(
    `SELECT process_time, mng FROM step_yearly_data WHERE step_id=$1 AND year=$2 LIMIT 1`,
    [stepId, targetYear]
  );
  const process_time = Number(prRes.rows[0]?.process_time || 0);
  const yearlyMng = prRes.rows[0] && prRes.rows[0].mng != null ? Number(prRes.rows[0].mng) : null;

  console.log('[calcStepPremisesCost] targetYear/process_time/mng(from yearly)', { targetYear, process_time, yearlyMng });

  const pcRes = await db.query(
    `SELECT hours_per_day, npt_rate, mng, working_days, activity_rate, premises_rate, total_days
       FROM project_countries
      WHERE project_id=$1 AND country_id=$2
      LIMIT 1`,
    [step.project_id, step.country_id]
  );
  if (pcRes.rows.length === 0) {
    // If no country-level config, premises cost is 0
    console.log('[calcStepPremisesCost] no project_countries config for project/country', { project_id: step.project_id, country_id: step.country_id });
    return { premisesCost: 0, year: targetYear! };
  }
  const hours_per_day = Number(pcRes.rows[0].hours_per_day || 0);
  const npt_rate = Number(pcRes.rows[0].npt_rate || 0);
  const pcMng = Number(pcRes.rows[0].mng || 0);
  const working_days = Number(pcRes.rows[0].working_days || 0);
  const activity_rate = Number(pcRes.rows[0].activity_rate || 0);
  const premisesRate = Number(pcRes.rows[0].premises_rate || 0);
  const total_days = Number(pcRes.rows[0].total_days || 365);

  console.log('[calcStepPremisesCost] project_countries', { hours_per_day, npt_rate, pcMng, working_days, activity_rate, premisesRate, total_days });

  // Validaciones para la nueva fórmula
  if (working_days <= 0 || activity_rate <= 0) {
    console.log('[calcStepPremisesCost] invalid working_days or activity_rate, returning 0', { working_days, activity_rate });
    return { premisesCost: 0, year: targetYear! };
  }

  const unit = String(step.process_time_unit || '').toLowerCase();
  
  // Use yearly mng if present, otherwise fallback to project country default mng
  const mngPercentage = yearlyMng != null ? yearlyMng : pcMng;

  // Calculate Total Process Time Hours using the same formula as frontend
  const processHours = unit === 'days' ? process_time * hours_per_day : process_time;
  const denominator = 1 - (mngPercentage / 100) - (npt_rate / 100);
  
  if (denominator <= 0) {
    console.log('[calcStepPremisesCost] invalid denominator for total process time, returning 0', { mngPercentage, npt_rate, denominator });
    return { premisesCost: 0, year: targetYear! };
  }
  
  const totalProcessTimeHours = processHours / denominator;

  // Nueva fórmula: premisesRate * (total_days/(working_days*activity_rate/100)) * totalProcessTimeHours
  const utilizationDenominator = working_days * (activity_rate / 100);
  const utilization = total_days / utilizationDenominator;
  const premisesCost = premisesRate * utilization * totalProcessTimeHours;

  console.log('[calcStepPremisesCost] computed with NEW formula', { 
    stepId, 
    year: targetYear, 
    unit, 
    processHours, 
    mngPercentage, 
    npt_rate, 
    totalProcessTimeHours,
    premisesRate: `${premisesRate} (from project_countries.premises_rate)`, 
    total_days: `${total_days} (from project_countries.total_days)`,
    working_days,
    activity_rate,
    utilization,
    premisesCost,
    formula: `${premisesRate} × (${total_days}/(${working_days}×${activity_rate}/100)) × ${totalProcessTimeHours} = ${premisesCost}`
  });

  return { premisesCost, year: targetYear! };
}

export async function saveStepPremisesCost(params: {
  stepId: number;
  year: number;
  premisesCost: number;
  db: DBClient;
}): Promise<void> {
  const { stepId, year, premisesCost, db } = params;
  await db.query(
    `INSERT INTO step_yearly_data (step_id, year, premises_costs)
     VALUES ($1, $2, $3)
     ON CONFLICT (step_id, year)
     DO UPDATE SET premises_costs = EXCLUDED.premises_costs`,
    [stepId, year, premisesCost]
  );
}

/**
 * Calculate IT Costs for a step using the same formula as premises cost
 * Formula: itCost * (total_days/(working_days*activity_rate/100)) * totalProcessTimeHours
 * 
 * Data sources:
 * - itCost: project_countries.it_cost for the step's country
 * - total_days, working_days, activity_rate: project_countries table
 * - totalProcessTimeHours: calculated from process_time adjusted by mng and npt_rate
 */
export async function calcStepItCost(params: {
  stepId: number;
  db: DBClient;
  year?: number;
}): Promise<{ itCost: number; year: number }> {
  const { stepId, db, year } = params;

  console.log('[calcStepItCost] called for stepId=', stepId, 'year=', year ?? 'latest');

  // 1) Load step with project and city/country info
  const stepRes = await db.query(
    `SELECT s.id, s.country_id, s.city_id, s.unit AS process_time_unit, wp.project_id
     FROM steps s
     JOIN deliverables d ON d.id = s.deliverable_id
     JOIN workpackages wp ON wp.id = d.workpackage_id
    WHERE s.id = $1
    LIMIT 1`,
    [stepId]
  );
  if (stepRes.rows.length === 0) {
    const err: any = new Error('Step no encontrado');
    err.status = 404;
    throw err;
  }
  const step = stepRes.rows[0];

  console.log('[calcStepItCost] step loaded', { id: step.id, country_id: step.country_id, city_id: step.city_id, process_time_unit: step.process_time_unit, project_id: step.project_id });

  // 2) determine target year (use yearly row if exists, else earliest)
  let targetYear: number | null = null;
  if (year) {
    targetYear = year;
  } else {
    // Find the earliest year with data for this step
    const yearRes = await db.query(
      'SELECT year FROM step_yearly_data WHERE step_id = $1 ORDER BY year ASC LIMIT 1',
      [stepId]
    );
    if (yearRes.rows.length > 0) {
      targetYear = yearRes.rows[0].year;
    } else {
      console.log('[calcStepItCost] no yearly data found, returning 0');
      return { itCost: 0, year: new Date().getFullYear() };
    }
  }

  // 3) Get step yearly data (process_time and mng)
  const yearlyRes = await db.query(
    'SELECT process_time, mng FROM step_yearly_data WHERE step_id = $1 AND year = $2 LIMIT 1',
    [stepId, targetYear]
  );
  if (yearlyRes.rows.length === 0) {
    console.log('[calcStepItCost] no yearly data for target year, returning 0');
    return { itCost: 0, year: targetYear! };
  }
  const { process_time, mng: yearlyMng } = yearlyRes.rows[0];

  console.log('[calcStepItCost] targetYear/process_time/mng(from yearly)', { targetYear, process_time, yearlyMng });

  // 4) Get project_countries configuration (it_cost, working_days, activity_rate, hours_per_day, npt_rate, total_days)
  const pcRes = await db.query(
    `SELECT hours_per_day, npt_rate, mng, working_days, activity_rate, it_cost, total_days
     FROM project_countries 
     WHERE project_id = $1 AND country_id = $2 LIMIT 1`,
    [step.project_id, step.country_id]
  );
  if (pcRes.rows.length === 0) {
    // If no country-level config, IT cost is 0
    console.log('[calcStepItCost] no project_countries config for project/country', { project_id: step.project_id, country_id: step.country_id });
    return { itCost: 0, year: targetYear! };
  }

  const { hours_per_day, npt_rate, mng: pcMng, working_days, activity_rate, it_cost, total_days } = pcRes.rows[0];
  const itRate = Number(it_cost || 0);
  const totalDays = Number(total_days || 365);

  console.log('[calcStepItCost] project_countries', { hours_per_day, npt_rate, pcMng, working_days, activity_rate, itRate, total_days });

  // 5) Validate required parameters
  if (!working_days || working_days <= 0 || !activity_rate || activity_rate <= 0) {
    console.log('[calcStepItCost] invalid working_days or activity_rate, returning 0', { working_days, activity_rate });
    return { itCost: 0, year: targetYear! };
  }

  // 6) Calculate Total Process Time Hours
  // Convert process_time to hours
  const processHours = step.process_time_unit?.toLowerCase() === 'days' ? process_time * hours_per_day : process_time;
  
  // Use step-specific mng if available, otherwise use country-level mng
  const mngPercentage = yearlyMng != null ? yearlyMng : (pcMng || 0);
  
  // Calculate denominator: 1 - mng/100 - npt_rate/100
  const denominator = 1 - (mngPercentage / 100) - (npt_rate / 100);
  
  if (denominator <= 0) {
    console.log('[calcStepItCost] invalid denominator for total process time, returning 0', { mngPercentage, npt_rate, denominator });
    return { itCost: 0, year: targetYear! };
  }
  
  const totalProcessTimeHours = processHours / denominator;

  // 7) Calculate IT Cost using same formula as premises cost
  // Nueva fórmula: itRate * (total_days/(working_days*activity_rate/100)) * totalProcessTimeHours
  const utilizationDenominator = working_days * (activity_rate / 100);
  const utilization = totalDays / utilizationDenominator;
  const itCostResult = itRate * utilization * totalProcessTimeHours;

  console.log('[calcStepItCost] computed with formula', { 
    itRate: `${itRate} (from project_countries.it_cost)`, 
    totalDays: `${totalDays} (from project_countries.total_days)`,
    working_days, 
    activity_rate, 
    totalProcessTimeHours: `${totalProcessTimeHours.toFixed(2)} hours`,
    utilization: `${utilization.toFixed(4)}`,
    result: `${itCostResult.toFixed(2)}`,
    formula: `${itRate} × (${totalDays}/(${working_days}×${activity_rate}/100)) × ${totalProcessTimeHours} = ${itCostResult}`
  });

  return { itCost: itCostResult, year: targetYear! };
}

export async function saveStepItCost(params: {
  stepId: number;
  year: number;
  itCost: number;
  db: DBClient;
}): Promise<void> {
  const { stepId, year, itCost, db } = params;
  console.log('[saveStepItCost] attempting to save', { stepId, year, itCost });
  
  try {
    const result = await db.query(
      `INSERT INTO step_yearly_data (step_id, year, it_costs)
       VALUES ($1, $2, $3)
       ON CONFLICT (step_id, year)
       DO UPDATE SET it_costs = EXCLUDED.it_costs`,
      [stepId, year, itCost]
    );
    console.log('[saveStepItCost] SUCCESS - rows affected:', result.rowCount, { stepId, year, itCost });
  } catch (error) {
    console.error('[saveStepItCost] ERROR saving IT costs:', error, { stepId, year, itCost });
    throw error;
  }
}

export async function verifyItCostsColumn(db: DBClient): Promise<boolean> {
  try {
    // Check if it_costs column exists
    const result = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'step_yearly_data' 
      AND column_name = 'it_costs'
    `);
    
    const columnExists = result.rows.length > 0;
    console.log('[verifyItCostsColumn] it_costs column exists:', columnExists);
    
    if (!columnExists) {
      console.error('[verifyItCostsColumn] ERROR: it_costs column does not exist in step_yearly_data table!');
      console.log('[verifyItCostsColumn] To create the column, run: ALTER TABLE step_yearly_data ADD COLUMN it_costs NUMERIC DEFAULT 0;');
    }
    
    return columnExists;
  } catch (error) {
    console.error('[verifyItCostsColumn] Error checking column:', error);
    return false;
  }
}

export async function diagnoseItCostsSetup(params: {
  projectId: number;
  db: DBClient;
}): Promise<void> {
  const { projectId, db } = params;
  console.log('\n[diagnoseItCostsSetup] 🔍 DIAGNOSING IT COSTS SETUP FOR PROJECT', projectId);
  
  try {
    // 1. Check it_costs column
    const columnExists = await verifyItCostsColumn(db);
    
    // 2. Check project_countries configuration
    const pcResult = await db.query(`
      SELECT pc.country_id, pc.it_cost, pc.total_days, pc.working_days, pc.activity_rate, c.name
      FROM project_countries pc
      LEFT JOIN countries c ON c.id = pc.country_id
      WHERE pc.project_id = $1
    `, [projectId]);
    
    console.log('[diagnoseItCostsSetup] 📊 Project countries configuration:');
    if (pcResult.rows.length === 0) {
      console.warn('[diagnoseItCostsSetup] ⚠️  WARNING: No project_countries configuration found!');
    } else {
      pcResult.rows.forEach(row => {
        console.log(`  - ${row.name} (${row.country_id}): it_cost=${row.it_cost}, working_days=${row.working_days}, activity_rate=${row.activity_rate}%`);
        if (!row.it_cost || row.it_cost <= 0) {
          console.warn(`    ⚠️  WARNING: it_cost is ${row.it_cost} for country ${row.name}`);
        }
      });
    }
    
    // 3. Check steps in project
    const stepsResult = await db.query(`
      SELECT s.id, s.country_id, s.city_id, COUNT(syd.id) as yearly_data_count
      FROM steps s
      JOIN deliverables d ON d.id = s.deliverable_id
      JOIN workpackages wp ON wp.id = d.workpackage_id
      LEFT JOIN step_yearly_data syd ON syd.step_id = s.id
      WHERE wp.project_id = $1
      GROUP BY s.id, s.country_id, s.city_id
      ORDER BY s.id
    `, [projectId]);
    
    console.log('[diagnoseItCostsSetup] 🎯 Steps in project:', stepsResult.rows.length);
    if (stepsResult.rows.length > 0) {
      console.log('Sample steps:');
      stepsResult.rows.slice(0, 3).forEach(row => {
        console.log(`  - Step ${row.id}: country_id=${row.country_id}, yearly_data_rows=${row.yearly_data_count}`);
      });
    }
    
  } catch (error) {
    console.error('[diagnoseItCostsSetup] Error during diagnosis:', error);
  }
  
  console.log('[diagnoseItCostsSetup] 🏁 Diagnosis complete\n');
}

export async function batchCalculateProjectCosts(params: {
  projectId: number;
  db: DBClient;
}): Promise<Array<{
  stepId: number;
  year: number;
  salariesCost: number;
  managementCost: number;
  nptCosts?: number;
  fte: number;
  premisesCost?: number;
  itCosts?: number;
  itProductionSupport?: number;
  operationalQualityCosts?: number;
  operationsManagementCosts?: number;
  leanManagementCosts?: number;
}>> {
  const { projectId, db } = params;

  console.log('[batchCalculateProjectCosts] Starting batch calculation for project:', projectId);
  
  // Verify it_costs column exists
  await verifyItCostsColumn(db);
  
  // Run comprehensive diagnosis
  await diagnoseItCostsSetup({ projectId, db });
  
  // 1) Get all steps in the project
  const stepRes = await db.query(
    `SELECT s.id
     FROM steps s
     JOIN deliverables d ON d.id = s.deliverable_id
     JOIN workpackages wp ON wp.id = d.workpackage_id
     WHERE wp.project_id = $1`,
    [projectId]
  );
  
  console.log('[batchCalculateProjectCosts] Found steps:', stepRes.rows.length);

  const result: Array<{
    stepId: number;
    year: number;
    salariesCost: number;
    managementCost: number;
    nptCosts?: number;
    fte: number;
  premisesCost?: number;
  itCosts?: number;
  itProductionSupport?: number;
  operationalQualityCosts?: number;
  operationsManagementCosts?: number;
  leanManagementCosts?: number;
  }> = [];

  // 2) Calculate costs for each step
  for (const { id: stepId } of stepRes.rows) {
    console.log('[batchCalculateProjectCosts] Processing step:', stepId);
    
    // Get years for this step
    const yearRes = await db.query(
      `SELECT year FROM step_yearly_data WHERE step_id = $1 ORDER BY year`,
      [stepId]
    );
    
    console.log('[batchCalculateProjectCosts] Found years for step:', stepId, yearRes.rows.length);

    // Calculate costs for each year
    for (const { year } of yearRes.rows) {
      try {
        // Get process_time for FTE calculation
        const processTimeRes = await db.query(
          `SELECT process_time FROM step_yearly_data WHERE step_id = $1 AND year = $2`,
          [stepId, year]
        );
        const processTime = Number(processTimeRes.rows[0]?.process_time || 0);

        // Calculate and save FTE
        const fte = await calculateStepFTE({
          stepId,
          year: Number(year),
          processTime,
          db
        });
        await saveStepFTE({
          stepId,
          year: Number(year),
          fte,
          db
        });

        // Calculate and save salary costs
        const { salariesCost } = await calcStepSalariesCost({ 
          stepId, 
          year: Number(year), 
          db 
        });
        await saveStepSalariesCost({ 
          stepId, 
          year: Number(year), 
          salariesCost, 
          db 
        });

        // Calculate and save management costs
        const { managementCost } = await calcStepManagementCost({ 
          stepId, 
          year: Number(year), 
          db 
        });
        await saveStepManagementCost({ 
          stepId, 
          year: Number(year), 
          managementCost, 
          db 
        });

        // Calculate and save NPT costs
        let nptCosts = 0;
        try {
          const nptResult = await calcStepNPTCosts({ 
            stepId, 
            year: Number(year), 
            db 
          });
          nptCosts = nptResult.nptCosts;
          await saveStepNPTCosts({ 
            stepId, 
            year: Number(year), 
            nptCosts, 
            db 
          });
          console.log('[batchCalculateProjectCosts] NPT costs calculated and saved:', { stepId, year, nptCosts });
        } catch (err) {
          console.warn('Failed to calc/save NPT costs for', stepId, year, err);
        }

        // Calculate and save premises costs
        let premisesCost = 0;
        try {
          const premisesResult = await calcStepPremisesCost({ stepId, year: Number(year), db });
          premisesCost = premisesResult.premisesCost;
          await saveStepPremisesCost({ stepId, year: Number(year), premisesCost, db });
          console.log('[batchCalculateProjectCosts] Premises costs calculated and saved:', { stepId, year, premisesCost });
        } catch (err) {
          console.warn('Failed to calc/save premises costs for', stepId, year, err);
        }

        // Calculate and save IT costs
        let itCosts = 0;
        try {
          const itResult = await calcStepItCost({ stepId, year: Number(year), db });
          itCosts = itResult.itCost;
          await saveStepItCost({ stepId, year: Number(year), itCost: itCosts, db });
          
          // Verify the data was saved
          const verifyResult = await db.query(
            `SELECT it_costs FROM step_yearly_data WHERE step_id = $1 AND year = $2`,
            [stepId, Number(year)]
          );
          const savedValue = verifyResult.rows[0]?.it_costs;
          console.log('[batchCalculateProjectCosts] IT costs calculated and saved:', { 
            stepId, 
            year, 
            calculated: itCosts, 
            savedInDB: savedValue,
            match: Math.abs(Number(savedValue) - itCosts) < 0.01
          });
        } catch (err) {
          console.warn('Failed to calc/save IT costs for', stepId, year, err);
        }

        result.push({
          stepId,
          year: Number(year),
          salariesCost,
          managementCost,
          nptCosts,
          fte,
          premisesCost,
          itCosts,
        });
      } catch (error) {
        console.error(`Error calculating costs for step ${stepId} year ${year}:`, error);
        // Continue with next year/step even if one fails
      }
    }
  }

  return result;
}
