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
