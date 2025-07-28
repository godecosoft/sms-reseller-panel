// src/pages/admin/AdminSMSSettings.jsx - YENİ COMPONENT
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Divider
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Send as SendIcon,
  Api as ApiIcon,
  PhoneAndroid as PhoneIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from 'react-query';
import { toast } from 'react-toastify';
import { adminAPI } from '../../services/api';

const AdminSMSSettings = () => {
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  // Test SMS formu
  const testForm = useForm({
    defaultValues: {
      phoneNumber: '',
      message: 'Test mesajı - TurkeySMS API çalışıyor!'
    }
  });

  // Test SMS mutation
  const testSMSMutation = useMutation(adminAPI.sendTestSMS, {
    onSuccess: (data) => {
      toast.success('Test SMS başarıyla gönderildi!');
      console.log('Test SMS Response:', data.data);
      setTestDialogOpen(false);
      testForm.reset();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Test SMS gönderilemedi');
      console.error('Test SMS Error:', error.response?.data);
    }
  });

  const onTestSubmit = (data) => {
    testSMSMutation.mutate(data);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        SMS API Ayarları
      </Typography>

      <Grid container spacing={3}>
        {/* API Bilgileri */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <ApiIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                TurkeySMS API Bilgileri
              </Typography>
              
              <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Base URL:</strong>
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', bgcolor: 'white', p: 1, borderRadius: 1 }}>
                  https://turkeysms.com.tr
                </Typography>
              </Paper>

              <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Endpoint:</strong>
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', bgcolor: 'white', p: 1, borderRadius: 1 }}>
                  /api/v3/gruba-gonder/post/tek-metin-gonderimi/
                </Typography>
              </Paper>

              <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Default API Key:</strong>
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', bgcolor: 'white', p: 1, borderRadius: 1 }}>
                  1ab9810ca3fb3f871dc130176019ee14
                </Typography>
              </Paper>

              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Default Gönderici:</strong>
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', bgcolor: 'white', p: 1, borderRadius: 1 }}>
                  08509449683
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* API Durumu ve Test */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <PhoneIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                API Test ve Durum
              </Typography>

              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>API Durumu:</strong> Aktif<br/>
                  <strong>Son Test:</strong> Henüz test edilmedi<br/>
                  <strong>SMS Formatı:</strong> Türkçe karakter desteği
                </Typography>
              </Alert>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body1" gutterBottom>
                <strong>API Özellikleri:</strong>
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                <Typography component="li" variant="body2">
                  ✅ Tekli SMS gönderimi
                </Typography>
                <Typography component="li" variant="body2">
                  ✅ Toplu SMS gönderimi
                </Typography>
                <Typography component="li" variant="body2">
                  ✅ Delivery report takibi
                </Typography>
                <Typography component="li" variant="body2">
                  ✅ Türkçe karakter desteği
                </Typography>
                <Typography component="li" variant="body2">
                  ✅ 90XXXXXXXXXX formatı
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={() => setTestDialogOpen(true)}
                fullWidth
                sx={{ mt: 2 }}
              >
                Test SMS Gönder
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Kullanıcı SMS Ayarları Bilgisi */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📋 Kullanıcı SMS Ayarları
              </Typography>
              
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  Her kullanıcı için ayrı SMS başlığı (gönderici adı) ve API key tanımlanabilir. 
                  Kullanıcı Yönetimi sayfasından bu ayarları düzenleyebilirsiniz.
                </Typography>
              </Alert>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                    <Typography variant="body2" gutterBottom>
                      <strong>Default Gönderici Adı:</strong>
                    </Typography>
                    <Typography variant="h6">
                      08509449683
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Paper sx={{ p: 2, bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
                    <Typography variant="body2" gutterBottom>
                      <strong>SMS Maliyeti:</strong>
                    </Typography>
                    <Typography variant="h6">
                      0.01 TL / SMS
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Test SMS Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <SendIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Test SMS Gönder
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            TurkeySMS API'sine test mesajı gönderilecek. Gerçek SMS kredisi kullanılacaktır.
          </Alert>
          
          <Box component="form" onSubmit={testForm.handleSubmit(onTestSubmit)} sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="phoneNumber"
                  control={testForm.control}
                  rules={{
                    required: 'Telefon numarası gerekli',
                    pattern: {
                      value: /^90[0-9]{10}$/,
                      message: 'Format: 90XXXXXXXXXX (örn: 905551234567)'
                    }
                  }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Test Telefon Numarası"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'Format: 90XXXXXXXXXX'}
                      placeholder="905551234567"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="message"
                  control={testForm.control}
                  rules={{
                    required: 'Mesaj gerekli',
                    maxLength: { value: 160, message: 'Maksimum 160 karakter' }
                  }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label="Test Mesajı"
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.message || 
                        `${field.value?.length || 0}/160 karakter`
                      }
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>
            İptal
          </Button>
          <Button
            onClick={testForm.handleSubmit(onTestSubmit)}
            variant="contained"
            startIcon={<SendIcon />}
            disabled={testSMSMutation.isLoading}
          >
            {testSMSMutation.isLoading ? 'Gönderiliyor...' : 'Test SMS Gönder'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminSMSSettings;