// src/pages/user/UserProfile.jsx - REVİZE EDİLMİŞ VERSİYON (API Key gizli, harcama bilgisi yok)
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  Paper
} from '@mui/material';
import {
  Person as PersonIcon,
  Save as SaveIcon,
  TrendingUp,
  Sms,
  CheckCircle
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { userAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const UserProfile = () => {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  // Profil bilgileri
  const { data: profileData } = useQuery(
    'user-profile',
    () => userAPI.getProfile().then(res => res.data)
  );

  // Bakiye hareketleri (sadece kredi yüklemeleri)
  const { data: transactionsData } = useQuery(
    'user-balance-transactions',
    () => userAPI.getBalanceTransactions({ 
      limit: 10,
      type: 'credit' // Sadece kredi yüklemelerini göster
    }).then(res => res.data)
  );

  const form = useForm({
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || ''
    }
  });

  // Profil güncelleme
  const updateProfileMutation = useMutation(userAPI.updateProfile, {
    onSuccess: (data) => {
      toast.success('Profil başarıyla güncellendi!');
      updateUser(data.user);
      queryClient.invalidateQueries('user-profile');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Profil güncellenemedi');
    }
  });

  const onSubmit = (data) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Profil
      </Typography>

      <Grid container spacing={3}>
        {/* Profil Bilgileri */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    bgcolor: 'primary.main',
                    mr: 2,
                    fontSize: 24
                  }}
                >
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h5" fontWeight="bold">
                    {user?.firstName} {user?.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    @{user?.username}
                  </Typography>
                  <Chip 
                    label="Aktif Kullanıcı" 
                    color="success" 
                    size="small" 
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />

              <Typography variant="h6" gutterBottom>
                Profil Bilgilerini Düzenle
              </Typography>

              <Box component="form" onSubmit={form.handleSubmit(onSubmit)}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="firstName"
                      control={form.control}
                      rules={{ required: 'Ad gerekli' }}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Ad"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="lastName"
                      control={form.control}
                      rules={{ required: 'Soyad gerekli' }}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Soyad"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Controller
                      name="email"
                      control={form.control}
                      rules={{
                        required: 'Email gerekli',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Geçerli bir email adresi girin'
                        }
                      }}
                      render={({ field, fieldState }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Email"
                          type="email"
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      disabled={updateProfileMutation.isLoading}
                    >
                      {updateProfileMutation.isLoading ? 'Güncelleniyor...' : 'Profili Güncelle'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* İstatistikler */}
        <Grid item xs={12} md={4}>
          {/* İstatistikler */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 İstatistikler
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Sms sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="body2" color="text.secondary">
                    Toplam Gönderilen SMS
                  </Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {profileData?.stats?.totalSMS || 0}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="body2" color="text.secondary">
                    Başarı Oranı
                  </Typography>
                </Box>
                <Typography variant="h4" color="success.main">
                  %{profileData?.stats?.successRate || 0}
                </Typography>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TrendingUp sx={{ mr: 1, color: 'info.main' }} />
                  <Typography variant="body2" color="text.secondary">
                    Teslim Edilen SMS
                  </Typography>
                </Box>
                <Typography variant="h4" color="info.main">
                  {profileData?.stats?.deliveredSMS || 0}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Kredi Yüklemeleri */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                💳 Son Kredi Yüklemeleri
              </Typography>
              
              <List dense>
                {transactionsData?.transactions?.slice(0, 5).map((transaction) => (
                  <ListItem key={transaction.id} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2">
                            {transaction.description}
                          </Typography>
                          <Chip
                            label={`+${Math.floor(parseFloat(transaction.amount))} Kredi`}
                            color="success"
                            size="small"
                          />
                        </Box>
                      }
                      secondary={new Date(transaction.createdAt).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    />
                  </ListItem>
                ))}
              </List>

              {(!transactionsData?.transactions || transactionsData.transactions.length === 0) && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  Henüz kredi yüklemesi bulunmuyor
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UserProfile;