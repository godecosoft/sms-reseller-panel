// src/pages/user/UserSendSMS.jsx - TXT DOSYA UPLOAD + TEK ENDPOİNT
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Paper,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  IconButton
} from '@mui/material';
import {
  Send as SendIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  PhoneAndroid as PhoneIcon,
  TextFields as TextFieldsIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery } from 'react-query';
import { toast } from 'react-toastify';
import { userAPI } from '../../services/api';

const UserSendSMS = () => {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');

  // Balance bilgisi
  const { data: balanceData } = useQuery(
    'user-balance',
    () => userAPI.getBalance().then(res => res.data),
    { refetchInterval: 30000 }
  );

  // SMS formu
  const smsForm = useForm({
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

  // SMS gönderme mutation - TEK ENDPOINT
  const sendSMSMutation = useMutation(userAPI.sendSMS, {
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`${data.validSent} SMS başarıyla gönderildi!`);
        if (data.invalidNumbers?.length > 0) {
          toast.warning(`${data.invalidNumbers.length} geçersiz numara atlandı`);
        }
        smsForm.reset();
        setRecipients([]);
        setUploadedFile(null);
        setFileContent('');
      } else {
        toast.error(data.message || 'SMS gönderilemedi');
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'SMS gönderilemedi');
    }
  });

  // TXT dosya yükleme
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    
    if (!file) return;

    // Dosya türü kontrolü
    if (!file.name.toLowerCase().endsWith('.txt')) {
      toast.error('Sadece .txt dosyaları desteklenir');
      return;
    }

    // Dosya boyutu kontrolü (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya boyutu 10MB\'dan küçük olmalı');
      return;
    }

    setUploadedFile(file);

    // Dosya içeriğini oku
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const numbers = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Maksimum 100.000 numara kontrolü
      if (numbers.length > 100000) {
        toast.error('Maksimum 100.000 numara yüklenebilir');
        setUploadedFile(null);
        return;
      }

      setFileContent(content);
      setRecipients(numbers);
      
      // Formdaki recipients alanını güncelle
      smsForm.setValue('recipients', numbers.join('\n'));
      
      toast.success(`${numbers.length} numara yüklendi`);
    };

    reader.onerror = () => {
      toast.error('Dosya okunurken hata oluştu');
      setUploadedFile(null);
    };

    reader.readAsText(file, 'UTF-8');
  };

  // Dosyayı temizle
  const clearFile = () => {
    setUploadedFile(null);
    setFileContent('');
    setRecipients([]);
    smsForm.setValue('recipients', '');
  };

  // Manuel numara girişi
  const handleManualInput = (value) => {
    const numbers = value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    setRecipients(numbers);
  };

  // SMS gönderimi
  const onSubmit = (data) => {
    // Recipients'ı hazırla
    let recipientList = [];
    
    if (recipients.length > 0) {
      recipientList = recipients;
    } else if (data.recipients) {
      recipientList = data.recipients
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }

    if (recipientList.length === 0) {
      toast.error('En az bir telefon numarası gerekli');
      return;
    }

    if (recipientList.length > 100000) {
      toast.error('Maksimum 100.000 numara gönderilebilir');
      return;
    }

    if (data.isScheduled) {
      setScheduleOpen(true);
    } else {
      sendSMSMutation.mutate({
        text: data.text,
        recipients: recipientList
      });
    }
  };

  const onScheduleSubmit = (scheduleData) => {
    const scheduledDateTime = `${scheduleData.scheduledDate}T${scheduleData.scheduledTime}`;
    
    sendSMSMutation.mutate({
      text: smsForm.getValues('text'),
      recipients: recipients,
      scheduledAt: scheduledDateTime
    });

    setScheduleOpen(false);
    scheduleForm.reset();
  };

  const currentBalance = Math.floor(parseFloat(balanceData?.balance || 0));
  const estimatedCost = recipients.length || 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        SMS Gönder
      </Typography>

      {/* Kredi Bilgisi */}
      <Alert 
        severity={currentBalance > estimatedCost && currentBalance > 10 ? 'success' : 'warning'} 
        sx={{ mb: 3 }}
        icon={<InfoIcon />}
      >
        <Box>
          <Typography variant="body1">
            <strong>Mevcut Krediniz: {currentBalance} SMS</strong>
          </Typography>
          {estimatedCost > 0 && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Tahmini Maliyet: {estimatedCost} kredi ({estimatedCost} numara)
            </Typography>
          )}
          {currentBalance < estimatedCost && (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              Yetersiz kredi! Eksik: {estimatedCost - currentBalance} kredi
            </Typography>
          )}
        </Box>
      </Alert>

      <Card>
        <CardContent>
          <Box component="form" onSubmit={smsForm.handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              {/* Mesaj Metni */}
              <Grid item xs={12}>
                <Controller
                  name="text"
                  control={smsForm.control}
                  rules={{
                    required: 'Mesaj metni gerekli',
                    maxLength: { value: 149, message: 'Maksimum 149 karakter' }
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
                        `${field.value?.length || 0}/149 karakter`
                      }
                      placeholder="Mesajınızı buraya yazın..."
                      InputProps={{
                        startAdornment: <TextFieldsIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                    />
                  )}
                />
              </Grid>

              {/* Telefon Numaraları Bölümü */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  <PhoneIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Telefon Numaraları
                </Typography>
                
                {/* Dosya Yükleme */}
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <UploadIcon sx={{ mr: 1 }} />
                    <Typography variant="body1" fontWeight="bold">
                      TXT Dosyası Yükle
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<UploadIcon />}
                      disabled={sendSMSMutation.isLoading}
                    >
                      Dosya Seç
                      <input
                        type="file"
                        accept=".txt"
                        hidden
                        onChange={handleFileUpload}
                      />
                    </Button>
                    
                    {uploadedFile && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={`${uploadedFile.name} (${recipients.length} numara)`}
                          color="success"
                          variant="outlined"
                        />
                        <IconButton size="small" onClick={clearFile}>
                          <ClearIcon />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Her satırda bir telefon numarası olacak şekilde .txt dosyası yükleyin (Maksimum 100.000 numara)
                  </Typography>
                </Paper>

                {/* Manuel Giriş */}
                <Controller
                  name="recipients"
                  control={smsForm.control}
                  rules={{
                    required: recipients.length === 0 ? 'En az bir telefon numarası gerekli' : false
                  }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={6}
                      label="Telefon Numaraları (Manuel Giriş)"
                      error={!!fieldState.error}
                      helperText={
                        fieldState.error?.message || 
                        `Her satıra bir numara yazın. Format: 90XXXXXXXXXX (${recipients.length} numara)`
                      }
                      placeholder="905551234567\n905557654321\n905559876543"
                      disabled={uploadedFile !== null}
                      onChange={(e) => {
                        field.onChange(e);
                        handleManualInput(e.target.value);
                      }}
                    />
                  )}
                />

                {recipients.length > 0 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <strong>{recipients.length} numara hazır</strong>
                    {recipients.length > 100000 && (
                      <Typography variant="body2" color="error">
                        Maksimum 100.000 numara gönderilebilir!
                      </Typography>
                    )}
                  </Alert>
                )}
              </Grid>

              {/* Zamanlama */}
              <Grid item xs={12}>
                <Controller
                  name="isScheduled"
                  control={smsForm.control}
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

              {/* Gönder Butonu */}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={smsForm.watch('isScheduled') ? <ScheduleIcon /> : <SendIcon />}
                  disabled={
                    sendSMSMutation.isLoading || 
                    currentBalance < estimatedCost ||
                    recipients.length === 0 ||
                    recipients.length > 100000
                  }
                  size="large"
                  sx={{ minWidth: 200 }}
                >
                  {sendSMSMutation.isLoading ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Gönderiliyor...
                    </>
                  ) : smsForm.watch('isScheduled') ? (
                    `Zamanla ve Gönder (${estimatedCost} Kredi)`
                  ) : (
                    `Hemen Gönder (${estimatedCost} Kredi)`
                  )}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Zamanlama Dialog'u */}
      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ScheduleIcon sx={{ mr: 1 }} />
            SMS Zamanlama
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={scheduleForm.handleSubmit(onScheduleSubmit)}>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="scheduledDate"
                  control={scheduleForm.control}
                  rules={{ required: 'Tarih seçiniz' }}
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
                  rules={{ required: 'Saat seçiniz' }}
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
            disabled={sendSMSMutation.isLoading}
          >
            {sendSMSMutation.isLoading ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Planlanıyor...
              </>
            ) : (
              'Zamanla ve Gönder'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserSendSMS;