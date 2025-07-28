// src/pages/user/UserSendSMS.jsx - REVİZE EDİLMİŞ VERSİYON
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Tab,
  Tabs,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Send as SendIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery } from 'react-query';
import { toast } from 'react-toastify';
import { userAPI } from '../../services/api';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const UserSendSMS = () => {
  const [tabValue, setTabValue] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [currentForm, setCurrentForm] = useState(null);

  // Balance bilgisi
  const { data: balanceData } = useQuery(
    'user-balance',
    () => userAPI.getBalance().then(res => res.data),
    { refetchInterval: 30000 }
  );

  // Tekli SMS formu
  const singleForm = useForm({
    defaultValues: {
      text: '',
      recipient: '',
      isScheduled: false
    }
  });

  // Toplu SMS formu
  const bulkForm = useForm({
    defaultValues: {
      text: '',
      recipients: '',
      isScheduled: false
    }
  });

  // Planlama formu
  const scheduleForm = useForm({
    defaultValues: {
      scheduledDate: '',
      scheduledTime: ''
    }
  });

  // SMS gönderme mutations
  const sendSingleMutation = useMutation(userAPI.sendSMS, {
    onSuccess: (data) => {
      toast.success('SMS başarıyla gönderildi!');
      singleForm.reset();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'SMS gönderilemedi');
    }
  });

  const sendBulkMutation = useMutation(userAPI.sendBulkSMS, {
    onSuccess: (data) => {
      toast.success(`${data.totalSent} SMS başarıyla gönderildi!`);
      if (data.invalidNumbers?.length > 0) {
        toast.warning(`${data.invalidNumbers.length} geçersiz numara atlandı`);
      }
      bulkForm.reset();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Toplu SMS gönderilemedi');
    }
  });

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const onSingleSubmit = (data) => {
    if (data.isScheduled) {
      setCurrentForm({ type: 'single', data });
      setScheduleOpen(true);
    } else {
      sendSingleMutation.mutate({
        text: data.text,
        recipient: data.recipient
      });
    }
  };

  const onBulkSubmit = (data) => {
    const recipients = data.recipients
      .split('\n')
      .map(num => num.trim())
      .filter(num => num.length > 0);

    if (data.isScheduled) {
      setCurrentForm({ 
        type: 'bulk', 
        data: {
          text: data.text,
          recipients
        }
      });
      setScheduleOpen(true);
    } else {
      sendBulkMutation.mutate({
        text: data.text,
        recipients
      });
    }
  };

  const onScheduleSubmit = (scheduleData) => {
    const scheduledDateTime = `${scheduleData.scheduledDate}T${scheduleData.scheduledTime}`;
    
    const smsData = {
      ...currentForm.data,
      scheduledAt: scheduledDateTime
    };

    if (currentForm.type === 'single') {
      sendSingleMutation.mutate(smsData);
    } else {
      sendBulkMutation.mutate(smsData);
    }

    setScheduleOpen(false);
    scheduleForm.reset();
    setCurrentForm(null);
  };

  // Minimum tarih (şu andan 5 dakika sonra)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        SMS Gönder
      </Typography>

      {/* Bakiye Bilgisi */}
      <Alert 
        severity={parseFloat(balanceData?.balance || 0) > 10 ? 'success' : 'warning'} 
        sx={{ mb: 3 }}
        icon={<InfoIcon />}
      >
        <Typography variant="body1">
          <strong>Mevcut Krediniz: {Math.floor(parseFloat(balanceData?.balance || 0))} SMS</strong>
          {parseFloat(balanceData?.balance || 0) <= 10 && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Krediniz düşük. Admin ile iletişime geçerek kredi ekleyebilirsiniz.
            </Typography>
          )}
        </Typography>
      </Alert>

      <Card>
        <CardContent>
          {/* Tabs */}
          <Tabs value={tabValue} onChange={handleTabChange} centered>
            <Tab
              icon={<PersonIcon />}
              label="Tekli SMS"
              iconPosition="start"
            />
            <Tab
              icon={<PeopleIcon />}
              label="Toplu SMS"
              iconPosition="start"
            />
          </Tabs>

          {/* Tekli SMS Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box component="form" onSubmit={singleForm.handleSubmit(onSingleSubmit)}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Controller
                    name="recipient"
                    control={singleForm.control}
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
                        label="Telefon Numarası"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message || 'Format: 90XXXXXXXXXX'}
                        placeholder="905551234567"
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="text"
                    control={singleForm.control}
                    rules={{
                      required: 'Mesaj metni gerekli',
                      maxLength: { value: 160, message: 'Maksimum 160 karakter' }
                    }}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={4}
                        label="Mesaj Metni"
                        error={!!fieldState.error}
                        helperText={
                          fieldState.error?.message || 
                          `${field.value?.length || 0}/160 karakter`
                        }
                        placeholder="Mesajınızı buraya yazın..."
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="isScheduled"
                    control={singleForm.control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            {...field}
                            checked={field.value}
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ScheduleIcon sx={{ mr: 1 }} />
                            Planlayarak Gönder
                          </Box>
                        }
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={singleForm.watch('isScheduled') ? <ScheduleIcon /> : <SendIcon />}
                    disabled={sendSingleMutation.isLoading || parseFloat(balanceData?.balance || 0) <= 0}
                    size="large"
                  >
                    {sendSingleMutation.isLoading ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Gönderiliyor...
                      </>
                    ) : singleForm.watch('isScheduled') ? (
                      'Zamanla ve Gönder'
                    ) : (
                      'Hemen Gönder'
                    )}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Toplu SMS Tab */}
          <TabPanel value={tabValue} index={1}>
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Toplu SMS Kullanımı:</strong><br/>
                • Her satıra bir telefon numarası yazın<br/>
                • Format: 90XXXXXXXXXX (örn: 905551234567)<br/>
                • Maksimum 1000 numara gönderebilirsiniz<br/>
                • Geçersiz numaralar otomatik atlanır
              </Typography>
            </Alert>

            <Box component="form" onSubmit={bulkForm.handleSubmit(onBulkSubmit)}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Controller
                    name="text"
                    control={bulkForm.control}
                    rules={{
                      required: 'Mesaj metni gerekli',
                      maxLength: { value: 160, message: 'Maksimum 160 karakter' }
                    }}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={6}
                        label="Mesaj Metni"
                        error={!!fieldState.error}
                        helperText={
                          fieldState.error?.message || 
                          `${field.value?.length || 0}/160 karakter`
                        }
                        placeholder="Toplu mesajınızı buraya yazın..."
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Controller
                    name="recipients"
                    control={bulkForm.control}
                    rules={{
                      required: 'En az bir telefon numarası gerekli'
                    }}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={6}
                        label="Telefon Numaraları"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message || 'Her satıra bir numara yazın'}
                        placeholder={`905551234567\n905557654321\n905559876543`}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Controller
                    name="isScheduled"
                    control={bulkForm.control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            {...field}
                            checked={field.value}
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ScheduleIcon sx={{ mr: 1 }} />
                            Planlayarak Gönder
                          </Box>
                        }
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={bulkForm.watch('isScheduled') ? <ScheduleIcon /> : <SendIcon />}
                    disabled={sendBulkMutation.isLoading || parseFloat(balanceData?.balance || 0) <= 0}
                    size="large"
                  >
                    {sendBulkMutation.isLoading ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Gönderiliyor...
                      </>
                    ) : bulkForm.watch('isScheduled') ? (
                      'Zamanla ve Toplu Gönder'
                    ) : (
                      'Hemen Toplu Gönder'
                    )}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Zamanlama Dialog */}
      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          SMS Gönderim Zamanı Belirle
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            SMS'leriniz belirttiğiniz tarih ve saatte otomatik olarak gönderilecektir.
          </Alert>
          
          <Box component="form" onSubmit={scheduleForm.handleSubmit(onScheduleSubmit)} sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="scheduledDate"
                  control={scheduleForm.control}
                  rules={{ required: 'Tarih seçimi gerekli' }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="date"
                      label="Gönderim Tarihi"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{
                        min: new Date().toISOString().split('T')[0]
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="scheduledTime"
                  control={scheduleForm.control}
                  rules={{ required: 'Saat seçimi gerekli' }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="time"
                      label="Gönderim Saati"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleOpen(false)}>
            İptal
          </Button>
          <Button
            onClick={scheduleForm.handleSubmit(onScheduleSubmit)}
            variant="contained"
            startIcon={<ScheduleIcon />}
          >
            Zamanla ve Gönder
          </Button>
        </DialogActions>
      </Dialog>

      {/* Yardım Bilgileri */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 SMS Gönderim Kuralları
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
                <Typography variant="body2">
                  <strong>Telefon Numarası:</strong> 90XXXXXXXXXX formatında<br/>
                  <strong>Mesaj Uzunluğu:</strong> Maksimum 160 karakter<br/>
                  <strong>Maliyet:</strong> Her başarılı SMS için 1 kredi
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, bgcolor: 'warning.light' }}>
                <Typography variant="body2">
                  <strong>Planlama:</strong> En az 5 dakika sonra için ayarlayabilirsiniz<br/>
                  <strong>Toplu SMS:</strong> Maksimum 1000 numara<br/>
                  <strong>Geçersiz Numaralar:</strong> Otomatik olarak atlanır
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserSendSMS;