import { useProject } from '../hooks/useProject';

declare global {
  interface Window {
    projectContext: {
      nonOperationalCosts: NonOperationalCost[];
      importNonOperationalCosts: (costs: NonOperationalCost[]) => void;
    };
  }
}

export {};