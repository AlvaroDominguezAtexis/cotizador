export interface Profile {
  id: number;
  name: string;
  salaries: Record<string, number>; // country -> salary
}