import axios from 'axios';
import { createApiRequestError } from '../utils/requestState.js';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const normalizedError = createApiRequestError(error);
    if (
      normalizedError?.status === 401
      && typeof window !== 'undefined'
      && !String(error?.config?.url || '').includes('/auth/')
    ) {
      window.dispatchEvent(new CustomEvent('heal-view-auth-required'));
    }
    if (normalizedError?.code !== 'ERR_CANCELED') {
      console.error('API Error:', normalizedError.message, {
        code: normalizedError.code,
        status: normalizedError.status
      });
    }
    return Promise.reject(normalizedError);
  }
);

export default apiClient;
