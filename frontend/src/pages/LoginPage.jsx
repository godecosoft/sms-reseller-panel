import React, { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  Alert
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../store/authStore';

const LoginPage = () => {
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      username: '',
      password: ''
    }
  });

  const onSubmit = async (data) => {
    setError('');
    const result = await login(data);
    if (!result.success) {
      setError(result.error);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={10}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            bgcolor: 'background.paper'
          }}
        >
          <Box
            sx={{
              background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
              color: 'white',
              p: 4,
              textAlign: 'center'
            }}
          >
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              SMS Reseller Panel
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              Profesyonel SMS yönetim sistemi
            </Typography>
          </Box>

          <Box sx={{ p: 4 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)}>
              <TextField
                fullWidth
                label="Kullanıcı Adı"
                margin="normal"
                autoComplete="username"
                autoFocus
                {...register('username', {
                  required: 'Kullanıcı adı gerekli'
                })}
                error={!!errors.username}
                helperText={errors.username?.message}
              />

              <TextField
                fullWidth
                label="Şifre"
                type="password"
                margin="normal"
                autoComplete="current-password"
                {...register('password', {
                  required: 'Şifre gerekli'
                })}
                error={!!errors.password}
                helperText={errors.password?.message}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{ mt: 3, mb: 2, py: 1.5 }}
              >
                {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Button>
            </Box>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Demo hesapları:
              </Typography>
              <Typography variant="caption" display="block">
                Admin: admin / admin123
              </Typography>
              <Typography variant="caption" display="block">
                Kullanıcı: demo / demo123
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;
