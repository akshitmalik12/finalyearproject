import axios from 'axios';

// Determine backend base URL:
// - Prefer VITE_API_BASE_URL if set (for deployed/staging environments)
// - Otherwise, use the current hostname with port 8000 so that
//   LAN users hitting the frontend via http://192.168.x.x:5173
//   will correctly talk to http://192.168.x.x:8000 instead of localhost.
export const getApiBaseUrl = () => {
  const envUrl = import.meta.env?.VITE_API_BASE_URL;
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    const backendPort = 8000;
    return `${protocol}//${hostname}:${backendPort}`;
  }

  return 'http://127.0.0.1:8000';
};

export const API_BASE_URL = getApiBaseUrl();

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (no auth needed)
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log error for debugging
    if (error.code === 'ERR_NETWORK') {
      console.error('Network error - Backend may not be running or CORS not configured');
    }
    return Promise.reject(error);
  }
);

// Chat API
export const chatAPI = {
  streamChat: async (prompt, imageFile = null, dataset = null) => {
    // Use /chat endpoint (no auth required)
    try {
      const requestBody = { message: prompt };
      if (dataset && Array.isArray(dataset) && dataset.length > 0) {
        requestBody.dataset = dataset;
      }
      
      const response = await fetch(`${API_BASE_URL}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }).catch((networkError) => {
        // Handle network-level errors (CORS, connection refused, etc.)
        console.error('Network fetch error:', networkError);
        throw new Error(
          `Failed to fetch: ${
            networkError.message ||
            `Cannot connect to backend. Make sure it's running on ${API_BASE_URL}`
          }`,
        );
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          // Ignore error reading response
        }
        
        if (response.status === 401) {
          throw new Error('Server authentication error. Please try again.');
        } else if (response.status === 500) {
          throw new Error(`Server error: ${errorText || 'Internal server error'}`);
        } else if (response.status === 404) {
          throw new Error('Chat endpoint not found. Please check if the backend is running correctly.');
        } else {
          throw new Error(`Failed to stream chat response: ${response.status} ${response.statusText}. ${errorText}`);
        }
      }

      if (!response.body) {
        throw new Error('Response body is null - the server did not return a streamable response.');
      }

      return response.body;
    } catch (fetchError) {
      // Re-throw if it's already a proper Error with message
      if (fetchError instanceof Error && fetchError.message) {
        throw fetchError;
      }
      // Handle other types of errors
      throw new Error(
        `Network error: ${
          fetchError.message ||
          `Failed to connect to backend. Please ensure the backend is running on ${API_BASE_URL}`
        }`,
      );
    }
  },
};

export default api;

