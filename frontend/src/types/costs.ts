export type TravelCostCategory = 'vuelos' | 'hoteles' | 'dietas' | 'trenes' | 'otros';

export interface TravelCost {
  id: number;
  category: TravelCostCategory;
  quantity: number;
  unitCost: number;
  refactorable: boolean;
}

export interface SubcontractCost {
  id: number;
  mode: string;
  provider: string;
  unitCost: number;
  quantity: number;
  refactorable: boolean;
}

export interface ITCost {
  id: number;
  type: string;
  name: string;
  unitCost: number;
  quantity: number;
  refactorable: boolean;
}

export interface OtherCost {
  id: number;
  concept: string;
  unitCost: number;
  quantity: number;
  refactorable: boolean;
}