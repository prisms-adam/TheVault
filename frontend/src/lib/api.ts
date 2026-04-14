import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000/api`,
  withCredentials: true,
});

// Request interceptor to add token to headers
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  // Skip adding token for auth endpoints
  if (token && !config.url?.includes('/auth/')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['Content-Type'] = 'application/json';
  return config;
});

export default api;
