import axios from 'axios';

// Determine backend base URL
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

// Request interceptor to add the auth token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK') {
      console.error('Network error - Backend may not be running or CORS not configured');
    }
    return Promise.reject(error);
  }
);

// --- MISSING AUTH API ADDED HERE ---
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },
  signup: async (email, password, fullName) => {
    const response = await api.post('/auth/signup', { 
      email, 
      password, 
      full_name: fullName 
    });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Chat API
export const chatAPI = {
  streamChat: async (prompt, imageFile = null, dataset = null) => {
    try {
      const requestBody = { message: prompt };
      if (dataset && Array.isArray(dataset) && dataset.length > 0) {
        requestBody.dataset = dataset;
      }
      
      const response = await fetch(`${API_BASE_URL}/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorText = '';
        try { errorText = await response.text(); } catch (e) {}
        
        if (response.status === 401) {
          throw new Error('Server authentication error. Please try again.');
        }
        throw new Error(`Error: ${response.status} ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      return response.body;
    } catch (fetchError) {
      throw new Error(fetchError.message || 'Failed to connect to backend');
    }
  },
};

export default api;