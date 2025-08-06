export interface License {
  id: number;
  name: string;
  cost: number;
  fullProjectCost: boolean;
  description?: string;
  provider?: string;
  type?: 'software' | 'hardware' | 'service' | 'other';
  renewalDate?: string;
  licenseKey?: string;
}

export interface LicenseUsage {
  licenseId: number;
  stepId: number;
  quantity?: number;
  startDate?: string;
  endDate?: string;
}