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
  mngPercentage: number;
}> {
  const { stepId, db, year } = params;

  // 1) Load step with project and country info
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

  // 2) Get yearly data if it exists
  let yearlyData;
  if (typeof year === 'number') {
    const yearRes = await db.query(
      `SELECT year, process_time, mng 
       FROM step_yearly_data 
       WHERE step_id = $1 AND year = $2
       LIMIT 1`,
      [stepId, year]
    );
    yearlyData = yearRes.rows[0];
  } else {
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
    const defaultsRes = await db.query(
      `SELECT mng FROM project_countries 
       WHERE project_id = $1 AND country_id = $2 
       LIMIT 1`,
      [stepRes.rows[0].project_id, stepRes.rows[0].country_id]
    );
    yearlyData = {
      year: year || new Date().getFullYear(),
      process_time: 0,
      mng: defaultsRes.rows[0]?.mng || 0
    };
  }

  const step = stepRes.rows[0];
  const targetYear = Number(yearlyData.year);
  const processTime = Number(yearlyData.process_time || 0);
  const mngPercentage = Number(yearlyData.mng || 0);

  // 2) Get management yearly salary and social contribution rate
  const countryConfigRes = await db.query(
    `SELECT management_yearly_salary, social_contribution_rate
     FROM project_countries
     WHERE project_id = $1 AND country_id = $2`,
    [step.project_id, step.country_id]
  );

  if (countryConfigRes.rows.length === 0) {
    const err: any = new Error('Configuración de país no encontrada');
    err.status = 404;
    throw err;
  }

  const managementYearlySalary = Number(countryConfigRes.rows[0].management_yearly_salary || 0);
  const socialContributionRate = Number(countryConfigRes.rows[0].social_contribution_rate || 0);

  // 3) Calculate annual hours
  const annualHours = await calcAnnualHours({
    projectId: Number(step.project_id),
    countryId: Number(step.country_id),
    db
  });

  // 4) Calculate management hourly rate
  const adjustedYearlySalary = managementYearlySalary * (1 + socialContributionRate/100);
  const managementHourlyRate = adjustedYearlySalary / annualHours;

  // 5) Calculate management cost
  const processHours = processTime;  // Assuming process_time is already in hours
  const managementCost = processHours * managementHourlyRate * (mngPercentage/100);

  return {
    managementCost,
    year: targetYear,
    managementHourlyRate,
    processHours,
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

export async function batchCalculateProjectCosts(params: {
  projectId: number;
  db: DBClient;
}): Promise<Array<{
  stepId: number;
  year: number;
  salariesCost: number;
  managementCost: number;
}>> {
  const { projectId, db } = params;

  console.log('[batchCalculateProjectCosts] Starting batch calculation for project:', projectId);
  
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
    fte: number;
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

        result.push({
          stepId,
          year: Number(year),
          salariesCost,
          managementCost,
          fte
        });
      } catch (error) {
        console.error(`Error calculating costs for step ${stepId} year ${year}:`, error);
        // Continue with next year/step even if one fails
      }
    }
  }

  return result;
}
