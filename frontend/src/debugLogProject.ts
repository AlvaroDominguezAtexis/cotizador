// Debug utility to log project objects returned from the backend
export function debugLogProject(project: any) {
  console.log('DEBUG Project from backend:', JSON.stringify(project, null, 2));
}
