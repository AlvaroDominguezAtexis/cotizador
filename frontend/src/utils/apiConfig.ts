// API configuration
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const apiConfig = {
  baseURL: API_BASE_URL,
  
  // Helper function to build full API URLs - always use full URL for now
  url: (path: string) => `${API_BASE_URL}${path}`,
  
  // Common fetch options
  defaultOptions: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    credentials: 'include' as RequestCredentials
  },

  // Helper function that automatically applies defaultOptions
  fetch: async (path: string, options: RequestInit = {}) => {
    const url = `${API_BASE_URL}${path}`;
    const mergedOptions = {
      ...apiConfig.defaultOptions,
      ...options,
      headers: {
        ...apiConfig.defaultOptions.headers,
        ...(options.headers || {})
      }
    };
    return fetch(url, mergedOptions);
  }
};