// src/store/authStore.js - DEBUG VERSİYONU
import { create } from 'zustand';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Basit fetch fonksiyonu
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('sms_panel_token');
  
  console.log('🔧 API Call:', { endpoint, url, hasToken: !!token });
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...options,
  };

  console.log('🔧 Request config:', config);

  const response = await fetch(url, config);
  const data = await response.json();
  
  console.log('🔧 API Response:', { status: response.status, data });
  
  if (!response.ok) {
    throw new Error(data.error || 'Bir hata oluştu');
  }
  
  return data;
};

export const useAuthStore = create((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  // Login function
  login: async (credentials) => {
    try {
      console.log('🚀 Login başlıyor:', credentials);
      set({ isLoading: true, error: null });
      
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      
      console.log('✅ Login başarılı:', data);
      
      // Store token
      localStorage.setItem('sms_panel_token', data.token);
      console.log('💾 Token kaydedildi:', data.token);
      
      set({ user: data.user, isLoading: false });
      console.log('👤 User state güncellendi:', data.user);
      
      toast.success(`Hoş geldiniz, ${data.user.firstName}!`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Login hatası:', error);
      set({ error: error.message, isLoading: false });
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  },

  // Register function
  register: async (userData) => {
    try {
      console.log('🚀 Register başlıyor:', userData);
      set({ isLoading: true, error: null });
      
      const data = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      
      console.log('✅ Register başarılı:', data);
      
      // Store token
      localStorage.setItem('sms_panel_token', data.token);
      console.log('💾 Token kaydedildi:', data.token);
      
      set({ user: data.user, isLoading: false });
      console.log('👤 User state güncellendi:', data.user);
      
      toast.success('Hesabınız başarıyla oluşturuldu!');
      
      return { success: true };
    } catch (error) {
      console.error('❌ Register hatası:', error);
      set({ error: error.message, isLoading: false });
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  },

  // Logout function
  logout: () => {
    console.log('🚪 Logout yapılıyor...');
    localStorage.removeItem('sms_panel_token');
    set({ user: null, isLoading: false, error: null });
    console.log('👤 User state temizlendi');
    toast.info('Başarıyla çıkış yaptınız');
  },

  // Check authentication
  checkAuth: async () => {
    try {
      console.log('🔍 Auth kontrol ediliyor...');
      const token = localStorage.getItem('sms_panel_token');
      console.log('💾 LocalStorage token:', token);
      
      if (!token) {
        console.log('❌ Token yok, loading false yapılıyor');
        set({ isLoading: false });
        return;
      }

      console.log('🔍 Token var, verify API çağırılıyor...');
      const data = await apiCall('/auth/verify');
      console.log('✅ Verify başarılı:', data);
      
      set({ user: data.user, isLoading: false });
      console.log('👤 User state güncellendi:', data.user);
      
    } catch (error) {
      console.error('❌ Auth check hatası:', error);
      localStorage.removeItem('sms_panel_token');
      set({ user: null, isLoading: false });
      console.log('👤 User state temizlendi (hata nedeniyle)');
    }
  },

  // Update user data
  updateUser: (userData) => {
    set((state) => ({
      user: { ...state.user, ...userData }
    }));
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  }
}));