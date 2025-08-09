export interface NonOperationalCost {
  id: number;
  type: string;
  subcontractorName: string;
  quantity: number;
  unitCost: number;
  assignation: 'project' | 'per use';
  year?: number;
  reinvoiced: boolean;
  context: 'it' | 'subcontract' | 'travel';
}