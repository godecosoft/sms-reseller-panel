// src/store/authStore.js - İYİLEŞTİRİLMİŞ ERROR HANDLING VE ROBUST API CALLS
import { create } from 'zustand';
import { toast } from 'react-toastify';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000;
const DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === 'true';

// İyileştirilmiş fetch fonksiyonu
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('sms_panel_token');
  
  if (DEBUG_MODE) {
    console.log('🔧 API Call:', { endpoint, url, hasToken: !!token, options });
  }
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    timeout: API_TIMEOUT,
    ...options,
  };

  // Timeout kontrolü
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
  config.signal = controller.signal;

  try {
    const response = await fetch(url, config);
    clearTimeout(timeoutId);
    
    // Response logging
    if (DEBUG_MODE) {
      console.log('🔧 API Response:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText,
        url: response.url 
      });
    }

    // JSON parse
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError);
      throw new Error('Sunucudan geçersiz yanıt alındı');
    }
    
    if (DEBUG_MODE) {
      console.log('🔧 Response Data:', data);
    }
    
    if (!response.ok) {
      // Specific error handling
      if (response.status === 401) {
        // Token invalid or expired
        localStorage.removeItem('sms_panel_token');
        throw new Error(data.error || 'Oturum süresi dolmuş');
      }
      
      if (response.status === 403) {
        throw new Error(data.error || 'Bu işlem için yetkiniz yok');
      }
      
      if (response.status === 404) {
        throw new Error(data.error || 'İstenen kaynak bulunamadı');
      }
      
      if (response.status >= 500) {
        throw new Error(data.error || 'Sunucu hatası');
      }
      
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return data;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Network ve timeout hataları
    if (error.name === 'AbortError') {
      throw new Error('İstek zaman aşımına uğradı');
    }
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Sunucuya bağlanılamıyor');
    }
    
    // Diğer hatalar
    throw error;
  }
};

export const useAuthStore = create((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  // Login function - İYİLEŞTİRİLMİŞ
  login: async (credentials) => {
    try {
      if (DEBUG_MODE) console.log('🚀 Login başlıyor:', { username: credentials.username });
      
      set({ isLoading: true, error: null });
      
      // Input validation
      if (!credentials.username || !credentials.password) {
        throw new Error('Kullanıcı adı ve şifre gerekli');
      }
      
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      
      if (DEBUG_MODE) console.log('✅ Login başarılı:', data);
      
      // Validate response
      if (!data.token || !data.user) {
        throw new Error('Sunucudan geçersiz login yanıtı');
      }
      
      // Store token
      localStorage.setItem('sms_panel_token', data.token);
      if (DEBUG_MODE) console.log('💾 Token kaydedildi');
      
      set({ user: data.user, isLoading: false, error: null });
      if (DEBUG_MODE) console.log('👤 User state güncellendi:', data.user);
      
      toast.success(`Hoş geldiniz, ${data.user.firstName}!`);
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Login hatası:', error);
      set({ error: error.message, isLoading: false, user: null });
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  },

  // Register function - İYİLEŞTİRİLMİŞ
  register: async (userData) => {
    try {
      if (DEBUG_MODE) console.log('🚀 Register başlıyor:', { username: userData.username, email: userData.email });
      
      set({ isLoading: true, error: null });
      
      // Input validation
      const requiredFields = ['username', 'email', 'password', 'firstName', 'lastName'];
      const missingFields = requiredFields.filter(field => !userData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Eksik alanlar: ${missingFields.join(', ')}`);
      }
      
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        throw new Error('Geçerli bir email adresi girin');
      }
      
      // Password validation
      if (userData.password.length < 6) {
        throw new Error('Şifre en az 6 karakter olmalı');
      }
      
      const data = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      
      if (DEBUG_MODE) console.log('✅ Register başarılı:', data);
      
      // Validate response
      if (!data.token || !data.user) {
        throw new Error('Sunucudan geçersiz register yanıtı');
      }
      
      // Store token
      localStorage.setItem('sms_panel_token', data.token);
      if (DEBUG_MODE) console.log('💾 Token kaydedildi');
      
      set({ user: data.user, isLoading: false, error: null });
      if (DEBUG_MODE) console.log('👤 User state güncellendi:', data.user);
      
      toast.success('Hesabınız başarıyla oluşturuldu!');
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Register hatası:', error);
      set({ error: error.message, isLoading: false, user: null });
      toast.error(error.message);
      return { success: false, error: error.message };
    }
  },

  // Logout function - İYİLEŞTİRİLMİŞ
  logout: () => {
    try {
      if (DEBUG_MODE) console.log('🚪 Logout yapılıyor...');
      
      localStorage.removeItem('sms_panel_token');
      set({ user: null, isLoading: false, error: null });
      
      if (DEBUG_MODE) console.log('👤 User state temizlendi');
      toast.info('Başarıyla çıkış yaptınız');
      
    } catch (error) {
      console.error('❌ Logout hatası:', error);
      // Force logout even if error occurs
      localStorage.removeItem('sms_panel_token');
      set({ user: null, isLoading: false, error: null });
    }
  },

  // Check authentication - İYİLEŞTİRİLMİŞ
  checkAuth: async () => {
    try {
      if (DEBUG_MODE) console.log('🔍 Auth kontrol ediliyor...');
      
      const token = localStorage.getItem('sms_panel_token');
      if (DEBUG_MODE) console.log('💾 LocalStorage token:', !!token);
      
      if (!token) {
        if (DEBUG_MODE) console.log('❌ Token yok, loading false yapılıyor');
        set({ isLoading: false, user: null, error: null });
        return;
      }

      // Token format validation
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        if (DEBUG_MODE) console.log('❌ Token formatı geçersiz');
        localStorage.removeItem('sms_panel_token');
        set({ isLoading: false, user: null, error: null });
        return;
      }

      if (DEBUG_MODE) console.log('🔍 Token var, verify API çağırılıyor...');
      
      const data = await apiCall('/auth/verify');
      
      if (DEBUG_MODE) console.log('✅ Verify başarılı:', data);
      
      // Validate response
      if (!data.valid || !data.user) {
        throw new Error('Token doğrulama başarısız');
      }
      
      set({ user: data.user, isLoading: false, error: null });
      if (DEBUG_MODE) console.log('👤 User state güncellendi:', data.user);
      
    } catch (error) {
      console.error('❌ Auth check hatası:', error);
      
      // Clear invalid token
      localStorage.removeItem('sms_panel_token');
      set({ user: null, isLoading: false, error: null });
      
      if (DEBUG_MODE) console.log('👤 User state temizlendi (hata nedeniyle)');
      
      // Don't show toast for auth check failures (silent failure)
      if (error.message !== 'Oturum süresi dolmuş' && !error.message.includes('Token')) {
        console.warn('⚠️ Auth check silent failure:', error.message);
      }
    }
  },

  // Update user data - YENİ
  updateUser: (userData) => {
    const currentUser = get().user;
    if (!currentUser) {
      console.warn('⚠️ Update user called but no current user');
      return;
    }
    
    const updatedUser = { ...currentUser, ...userData };
    set({ user: updatedUser });
    
    if (DEBUG_MODE) console.log('👤 User data güncellendi:', updatedUser);
  },

  // Clear error - YENİ
  clearError: () => {
    set({ error: null });
  },

  // Refresh user data - YENİ
  refreshUser: async () => {
    try {
      if (DEBUG_MODE) console.log('🔄 User data refresh ediliyor...');
      
      const token = localStorage.getItem('sms_panel_token');
      if (!token) {
        console.warn('⚠️ Refresh user called but no token');
        return;
      }
      
      const data = await apiCall('/auth/verify');
      
      if (data.valid && data.user) {
        set({ user: data.user });
        if (DEBUG_MODE) console.log('✅ User data refresh başarılı');
      }
      
    } catch (error) {
      console.error('❌ User refresh hatası:', error);
      // Don't logout on refresh failure, just log the error
    }
  },

  // Get user role - YENİ
  getUserRole: () => {
    return get().user?.role || null;
  },

  // Check if user is admin - YENİ
  isAdmin: () => {
    return get().user?.role === 'admin';
  },

  // Check if user is authenticated - YENİ
  isAuthenticated: () => {
    return !!get().user && !!localStorage.getItem('sms_panel_token');
  },

  // Get user balance - YENİ
  getUserBalance: () => {
    return Math.floor(parseFloat(get().user?.balance || 0));
  },

  // Update user balance - YENİ
  updateUserBalance: (newBalance) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, balance: newBalance } });
    }
  }
}));