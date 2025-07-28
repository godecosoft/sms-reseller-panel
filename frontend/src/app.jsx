// src/App.jsx - FİNAL DÜZELTİLMİŞ VERSİYON
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Store
import { useAuthStore } from './store/authStore';

// Pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminReports from './pages/admin/AdminReports';
import UserDashboard from './pages/user/UserDashboard';
import UserSendSMS from './pages/user/UserSendSMS';
import UserHistory from './pages/user/UserHistory';
import UserProfile from './pages/user/UserProfile';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

// Theme configuration
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    success: {
      main: '#2e7d32',
    },
    warning: {
      main: '#ed6c02',
    },
    error: {
      main: '#d32f2f',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { user, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    console.log('App mounting, checking auth...');
    checkAuth();
  }, []);

  useEffect(() => {
    console.log('User state changed:', user);
  }, [user]);

  if (isLoading) {
    console.log('App is loading...');
    return <LoadingSpinner />;
  }

  console.log('App rendering with user:', user);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Routes>
            {/* Login Route */}
            <Route 
              path="/login" 
              element={
                user ? (
                  <Navigate to={user.role === 'admin' ? '/admin' : '/user'} replace />
                ) : (
                  <LoginPage />
                )
              } 
            />

            {/* Admin Layout Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Layout userRole="admin" />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="reports" element={<AdminReports />} />
            </Route>

            {/* User Layout Routes */}
            <Route 
              path="/user" 
              element={
                <ProtectedRoute requiredRole="user">
                  <Layout userRole="user" />
                </ProtectedRoute>
              }
            >
              <Route index element={<UserDashboard />} />
              <Route path="send" element={<UserSendSMS />} />
              <Route path="history" element={<UserHistory />} />
              <Route path="profile" element={<UserProfile />} />
            </Route>

            {/* Root Redirect */}
            <Route 
              path="/" 
              element={
                user ? (
                  <Navigate to={user.role === 'admin' ? '/admin' : '/user'} replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />

            {/* Catch All - 404 */}
            <Route 
              path="*" 
              element={<Navigate to="/login" replace />} 
            />
          </Routes>
        </Router>

        {/* Toast Notifications */}
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;