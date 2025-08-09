export const getProjectYears = (startDate?: string, endDate?: string): number[] => {
  if (!startDate || !endDate) return [];
  const startYear = new Date(startDate).getFullYear();
  const endYear = new Date(endDate).getFullYear();
  if (isNaN(startYear) || isNaN(endYear)) return [];
  if (endYear < startYear) return [];
  return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
};
