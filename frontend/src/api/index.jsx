import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't redirect to login for public endpoints
    const publicEndpoints = ['/auth/register', '/auth/verify-email', '/auth/resend-verification', '/auth/login', '/items/search', '/items/categories', '/items/'];
    const isPublicEndpoint = publicEndpoints.some(endpoint => originalRequest.url?.includes(endpoint));

    if (error.response?.status === 401 && !originalRequest._retry && !isPublicEndpoint) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);
          originalRequest.headers.Authorization = `Bearer ${access}`;

          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  verifyEmail: (data) => api.post('/auth/verify-email', data),
  resendVerification: (data) => api.post('/auth/resend-verification', data),
  verifyId: (data) => api.post('/auth/verify-id', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  verifyAddress: (data) => api.post('/auth/verify-address', data),
  login: (data) => api.post('/auth/login', data),
  refresh: (refresh) => api.post('/auth/refresh', { refresh }),
};

export const itemsApi = {
  search: (params) => api.get('/items/search', { params }),
  list: (params) => api.get('/items/', { params }),
  get: (id) => api.get(`/items/${id}/`),
  create: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (key === 'images' && Array.isArray(data[key])) {
        data[key].forEach((file) => formData.append('images', file));
      } else if (key === 'availability_calendar') {
        formData.append(key, JSON.stringify(data[key]));
      } else {
        formData.append(key, data[key]);
      }
    });
    return api.post('/items/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  update: (id, data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (key === 'images' && Array.isArray(data[key])) {
        data[key].forEach((file) => formData.append('images', file));
      } else if (key === 'availability_calendar') {
        formData.append(key, JSON.stringify(data[key]));
      } else {
        formData.append(key, data[key]);
      }
    });
    return api.patch(`/items/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id) => api.delete(`/items/${id}/`),
  uploadImages: (id, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return api.post(`/items/${id}/images/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  categories: () => api.get('/items/categories/'),
};

export const transactionsApi = {
  borrowRequest: (data) => api.post('/transactions/borrow-request', data),
  accept: (id) => api.post(`/transactions/${id}/accept/`),
  decline: (id) => api.post(`/transactions/${id}/decline/`),
  activate: (id) => api.post(`/transactions/${id}/activate/`),
  /**
   * Close a transaction after the item has been returned.
   */
  close: (id) => api.post(`/transactions/${id}/close/`),
  generateQr: (id) => api.post(`/transactions/${id}/generate-qr/`),
  scanQr: (id, token) => api.post(`/transactions/${id}/scan-qr/`, { token }),
  dispute: (id, reason) => api.post(`/transactions/${id}/dispute/`, { reason }),
  rating: (id, data) => api.post(`/transactions/${id}/rating/`, data),
  auditLog: (id) => api.get(`/transactions/${id}/audit-log/`),
  list: (params) => api.get('/transactions/', { params }),
  get: (id) => api.get(`/transactions/${id}/`),
};

export const usersApi = {
  me: () => api.get('/users/me/'),
  profile: (id) => api.get(`/users/${id}/profile/`),
  updateProfile: (id, data) => api.patch(`/users/me/`, data),
  uploadPhoto: (id, formData) =>
    api.patch(`/users/me/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const adminApi = {
  disputes: () => api.get('/admin/disputes/'),
  resolveDispute: (id, resolution) =>
    api.post(`/admin/disputes/${id}/resolve/`, { resolution }),
  stats: () => api.get('/admin/stats/'),
  users: (params) => api.get('/admin/users/', { params }),
  activateUser: (id) => api.post(`/admin/users/${id}/activate/`),
  suspendUser: (id) => api.post(`/admin/users/${id}/suspend/`),
};

export default api;
