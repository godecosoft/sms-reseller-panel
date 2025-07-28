// src/services/api.js - RAPORLAMA ENDPOİNT'LERİ EKLENDİ
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Axios instance oluştur
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - token ekleme
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sms_panel_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - hata yönetimi
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sms_panel_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth servisleri
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  verify: () => api.get('/auth/verify'),
};

// Admin servisleri - Raporlama endpoint'leri eklendi
export const adminAPI = {
  getDashboardStats: () => api.get('/admin/dashboard-stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (userData) => api.post('/admin/users', userData),
  updateUser: (id, userData) => api.put(`/admin/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  addBalance: (id, data) => api.post(`/admin/users/${id}/add-balance`, data),
  getSMSReports: (params) => api.get('/admin/sms-reports', { params }),
  
  // SMS ayarları endpoint'leri
  updateUserSMSSettings: (id, data) => api.put(`/admin/users/${id}/sms-settings`, data),
  sendTestSMS: (data) => api.post('/admin/test-sms', data),
  
  // YENİ RAPORLAMA ENDPOİNT'LERİ
  getCampaignDetail: (id) => api.get(`/admin/campaigns/${id}`),
  updateCampaignReport: (id) => api.post(`/admin/campaigns/${id}/update-report`),
  getDeliveryReport: (reportId) => api.get(`/admin/delivery-report/${reportId}`),
};

// User servisleri - Raporlama endpoint'leri eklendi
export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data),
  getBalance: () => api.get('/user/balance'),
  getDashboard: () => api.get('/user/dashboard'),
  sendSMS: (data) => api.post('/user/send-sms', data),
  sendBulkSMS: (data) => api.post('/user/send-bulk-sms', data),
  getSMSHistory: (params) => api.get('/user/sms-history', { params }),
  getCampaign: (id) => api.get(`/user/campaigns/${id}`),
  getBalanceTransactions: (params) => api.get('/user/balance-transactions', { params }),
  
  // YENİ RAPORLAMA ENDPOİNT'LERİ
  updateCampaignReport: (id) => api.post(`/user/campaigns/${id}/update-report`),
  getDeliveryReport: (reportId) => api.get(`/user/delivery-report/${reportId}`),
};

export default api;