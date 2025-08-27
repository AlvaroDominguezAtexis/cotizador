import type { QueryResult } from 'pg';
import { DBClient } from './costs';
import { calcStepSalariesCost, calcStepManagementCost } from './costs';

export async function batchCalcCosts(params: {
  projectId: number;
  db: DBClient;
}): Promise<{
  stepId: number;
  year: number;
  salariesCost: number;
  managementCost: number;
}[]> {
  const { projectId, db } = params;

  // Get all steps for the project
  const stepsRes = await db.query(
    `SELECT s.id, syd.year
     FROM steps s
     JOIN step_yearly_data syd ON syd.step_id = s.id
     JOIN deliverables d ON d.id = s.deliverable_id
     JOIN workpackages wp ON wp.id = d.workpackage_id
     WHERE wp.project_id = $1
     ORDER BY s.id, syd.year`,
    [projectId]
  );

  const results: {
    stepId: number;
    year: number;
    salariesCost: number;
    managementCost: number;
  }[] = [];

  // Calculate costs for each step and year
  for (const row of stepsRes.rows) {
    const stepId = Number(row.id);
    const year = Number(row.year);

    try {
      // Calculate salaries cost
      const { salariesCost } = await calcStepSalariesCost({
        stepId,
        year,
        db
      });

      // Calculate management cost
      const { managementCost } = await calcStepManagementCost({
        stepId,
        year,
        db
      });

      // Update costs in database
      await db.query(
        `UPDATE step_yearly_data 
         SET salaries_cost = $1, management_costs = $2
         WHERE step_id = $3 AND year = $4`,
        [salariesCost, managementCost, stepId, year]
      );

      results.push({
        stepId,
        year,
        salariesCost,
        managementCost
      });
    } catch (e) {
      console.error(`Error calculating costs for step ${stepId} year ${year}:`, e);
      // Continue with next step
    }
  }

  return results;
}
