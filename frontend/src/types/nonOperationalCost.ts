// Unified NonOperationalCost interface merging legacy UI shape and backend DTO
export interface NonOperationalCost {
  id?: number;
  project_id?: number; // optional for legacy in-memory rows
  context: 'it' | 'subcontract' | 'travel';
  type: string;
  concept: string; // canonical name (replaces legacy subcontractorName)
  quantity: number;
  unit_cost: number; // canonical name (replaces legacy unitCost)
  assignation: 'project' | 'per use';
  year?: number | null;
  reinvoiced: boolean;
  created_at?: string;
  updated_at?: string;
  // When assignation is 'per use', the backend may include the associated step IDs
  step_ids?: number[];
  // Legacy optional fields kept for backward compatibility
  subcontractorName?: string; // mapped to concept
  unitCost?: number; // mapped to unit_cost
}

// Helper to normalize any incoming legacy object to canonical fields
export function normalizeNonOperationalCost(raw: any): NonOperationalCost {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid non operational cost object');
  }
  return {
    id: raw.id,
    project_id: raw.project_id,
    context: raw.context,
    type: raw.type,
    concept: raw.concept ?? raw.subcontractorName ?? '',
    quantity: Number(raw.quantity ?? 1),
    unit_cost: Number(raw.unit_cost ?? raw.unitCost ?? 0),
    assignation: raw.assignation === 'per use' ? 'per use' : 'project',
    year: raw.year ?? null,
    reinvoiced: !!raw.reinvoiced,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  step_ids: Array.isArray(raw.step_ids) ? raw.step_ids.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n)) : undefined,
    subcontractorName: raw.subcontractorName,
    unitCost: raw.unitCost
  };
}

// Backward compatibility alias (old name used in code)
export type NonOperationalCostDTO = NonOperationalCost;
