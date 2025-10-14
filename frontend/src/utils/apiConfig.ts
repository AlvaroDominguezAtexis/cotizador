// API configuration
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const API_BASE_URL = process.env.REACT_APP_API_URL || (IS_DEVELOPMENT ? '' : 'http://localhost:4000');

export const apiConfig = {
  baseURL: API_BASE_URL,
  
  // Helper function to build full API URLs
  url: (path: string) => IS_DEVELOPMENT ? path : `${API_BASE_URL}${path}`,
  
  // Common fetch options
  defaultOptions: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    credentials: 'include' as RequestCredentials
  }
};