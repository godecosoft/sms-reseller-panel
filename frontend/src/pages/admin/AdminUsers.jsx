// src/pages/admin/AdminUsers.jsx - KREDİ SİSTEMİNE GÜNCELLENMİŞ
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  AccountBalance as BalanceIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  VpnKey as VpnKeyIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-toastify';
import { adminAPI } from '../../services/api';

// UUID oluşturma fonksiyonu (harici paket olmadan)
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const AdminUsers = () => {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [smsSettingsOpen, setSmsSettingsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuUser, setMenuUser] = useState(null);
  
  const queryClient = useQueryClient();

  // Kullanıcıları getir
  const { data: usersData, isLoading } = useQuery(
    'admin-users',
    () => adminAPI.getUsers().then(res => res.data),
    { refetchInterval: 30000 }
  );

  // Formlar
  const createForm = useForm({
    defaultValues: {
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      balance: 0,
      apiKey: ''
    }
  });

  const editForm = useForm();
  const balanceForm = useForm({ defaultValues: { amount: '', description: '' } });
  const apiKeyForm = useForm({ defaultValues: { apiKey: '' } });
  const smsSettingsForm = useForm({ defaultValues: { smsTitle: '', smsApiKey: '' } });

  // Mutations
  const createUserMutation = useMutation(adminAPI.createUser, {
    onSuccess: () => {
      toast.success('Kullanıcı başarıyla oluşturuldu!');
      setCreateOpen(false);
      createForm.reset();
      queryClient.invalidateQueries('admin-users');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Kullanıcı oluşturulamadı');
    }
  });

  const updateUserMutation = useMutation(
    ({ id, data }) => adminAPI.updateUser(id, data),
    {
      onSuccess: () => {
        toast.success('Kullanıcı başarıyla güncellendi!');
        setEditOpen(false);
        setApiKeyOpen(false);
        queryClient.invalidateQueries('admin-users');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Kullanıcı güncellenemedi');
      }
    }
  );

  const addBalanceMutation = useMutation(
    ({ id, data }) => adminAPI.addBalance(id, data),
    {
      onSuccess: () => {
        toast.success('Kredi başarıyla eklendi!');
        setBalanceOpen(false);
        balanceForm.reset();
        queryClient.invalidateQueries('admin-users');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Kredi eklenemedi');
      }
    }
  );

  const updateSMSSettingsMutation = useMutation(
    ({ id, data }) => adminAPI.updateUserSMSSettings(id, data),
    {
      onSuccess: () => {
        toast.success('SMS ayarları başarıyla güncellendi!');
        setSmsSettingsOpen(false);
        queryClient.invalidateQueries('admin-users');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'SMS ayarları güncellenemedi');
      }
    }
  );

  // Handlers
  const handleMenuOpen = (event, user) => {
    setAnchorEl(event.currentTarget);
    setMenuUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuUser(null);
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    editForm.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status
    });
    setEditOpen(true);
    handleMenuClose();
  };

  const handleEditApiKey = (user) => {
    setSelectedUser(user);
    apiKeyForm.reset({
      apiKey: user.apiKey || ''
    });
    setApiKeyOpen(true);
    handleMenuClose();
  };

  const handleAddBalance = (user) => {
    setSelectedUser(user);
    setBalanceOpen(true);
    handleMenuClose();
  };

  const handleSMSSettings = (user) => {
    setSelectedUser(user);
    smsSettingsForm.reset({
      smsTitle: user.smsTitle || '08509449683',
      smsApiKey: user.smsApiKey || '1ab9810ca3fb3f871dc130176019ee14'
    });
    setSmsSettingsOpen(true);
    handleMenuClose();
  };

  const handleStatusChange = (user, newStatus) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { status: newStatus }
    });
    handleMenuClose();
  };

  const generateApiKey = () => {
    const newApiKey = generateUUID();
    createForm.setValue('apiKey', newApiKey);
  };

  const generateApiKeyForEdit = () => {
    const newApiKey = generateUUID();
    apiKeyForm.setValue('apiKey', newApiKey);
  };

  const onCreateSubmit = (data) => {
    if (!data.apiKey) {
      data.apiKey = generateUUID();
    }
    createUserMutation.mutate(data);
  };

  const onEditSubmit = (data) => {
    updateUserMutation.mutate({
      id: selectedUser.id,
      data
    });
  };

  const onApiKeySubmit = (data) => {
    updateUserMutation.mutate({
      id: selectedUser.id,
      data: { apiKey: data.apiKey }
    });
  };

  const onBalanceSubmit = (data) => {
    addBalanceMutation.mutate({
      id: selectedUser.id,
      data
    });
  };

  const onSMSSettingsSubmit = (data) => {
    updateSMSSettingsMutation.mutate({
      id: selectedUser.id,
      data
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Aktif';
      case 'inactive': return 'Pasif';
      case 'suspended': return 'Askıya Alındı';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography>Kullanıcılar yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Kullanıcı Yönetimi
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          Yeni Kullanıcı
        </Button>
      </Box>

      {/* Kullanıcı Listesi */}
      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Kullanıcı Adı</strong></TableCell>
                  <TableCell><strong>Ad Soyad</strong></TableCell>
                  <TableCell><strong>Email</strong></TableCell>
                  <TableCell><strong>Kredi</strong></TableCell>
                  <TableCell><strong>SMS Sayısı</strong></TableCell>
                  <TableCell><strong>API Key</strong></TableCell>
                  <TableCell><strong>Durum</strong></TableCell>
                  <TableCell><strong>İşlemler</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {usersData?.users?.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                        {user.username}
                      </Box>
                    </TableCell>
                    <TableCell>{user.firstName} {user.lastName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold" color="primary">
                        {Math.floor(parseFloat(user.balance))} Kredi
                      </Typography>
                    </TableCell>
                    <TableCell>{user.smsCount || 0}</TableCell>
                    <TableCell>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          fontFamily: 'monospace',
                          bgcolor: 'grey.100',
                          p: 0.5,
                          borderRadius: 1
                        }}
                      >
                        {user.apiKey ? `${user.apiKey.substring(0, 8)}...` : 'Yok'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(user.status)}
                        color={getStatusColor(user.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton 
                        size="small" 
                        onClick={(e) => handleMenuOpen(e, user)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {(!usersData?.users || usersData.users.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                Henüz kullanıcı bulunmuyor
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEdit(menuUser)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Bilgileri Düzenle</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleEditApiKey(menuUser)}>
          <ListItemIcon>
            <VpnKeyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>API Key Düzenle</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAddBalance(menuUser)}>
          <ListItemIcon>
            <BalanceIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Kredi Ekle</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleSMSSettings(menuUser)}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>SMS Ayarları</ListItemText>
        </MenuItem>
        {menuUser?.status === 'active' ? (
          <MenuItem onClick={() => handleStatusChange(menuUser, 'suspended')}>
            <ListItemIcon>
              <BlockIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Askıya Al</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => handleStatusChange(menuUser, 'active')}>
            <ListItemIcon>
              <CheckCircleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Aktifleştir</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Kullanıcı Oluşturma Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={createForm.handleSubmit(onCreateSubmit)} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="firstName"
                  control={createForm.control}
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
                  control={createForm.control}
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
                  name="username"
                  control={createForm.control}
                  rules={{ required: 'Kullanıcı adı gerekli' }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Kullanıcı Adı"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="email"
                  control={createForm.control}
                  rules={{ 
                    required: 'Email gerekli',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Geçerli email adresi girin'
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
                <Controller
                  name="password"
                  control={createForm.control}
                  rules={{ 
                    required: 'Şifre gerekli',
                    minLength: { value: 6, message: 'En az 6 karakter' }
                  }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Şifre"
                      type="password"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="apiKey"
                  control={createForm.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="API Key"
                      placeholder="Otomatik oluşturulacak veya özel key girin"
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={generateApiKey} edge="end">
                              <RefreshIcon />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="balance"
                  control={createForm.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Başlangıç Kredisi"
                      type="number"
                      inputProps={{ min: 0, step: 1 }}
                      helperText="SMS kredisi (1 kredi = 1 SMS)"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>İptal</Button>
          <Button
            onClick={createForm.handleSubmit(onCreateSubmit)}
            variant="contained"
            disabled={createUserMutation.isLoading}
          >
            {createUserMutation.isLoading ? 'Oluşturuluyor...' : 'Oluştur'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kullanıcı Düzenleme Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Kullanıcı Düzenle</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={editForm.handleSubmit(onEditSubmit)} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="firstName"
                  control={editForm.control}
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
                  control={editForm.control}
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
                  control={editForm.control}
                  rules={{ 
                    required: 'Email gerekli',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Geçerli email adresi girin'
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
                <Controller
                  name="status"
                  control={editForm.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      select
                      label="Durum"
                    >
                      <MenuItem value="active">Aktif</MenuItem>
                      <MenuItem value="inactive">Pasif</MenuItem>
                      <MenuItem value="suspended">Askıya Alındı</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>İptal</Button>
          <Button
            onClick={editForm.handleSubmit(onEditSubmit)}
            variant="contained"
            disabled={updateUserMutation.isLoading}
          >
            {updateUserMutation.isLoading ? 'Güncelleniyor...' : 'Güncelle'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* API Key Düzenleme Dialog */}
      <Dialog open={apiKeyOpen} onClose={() => setApiKeyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <VpnKeyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          API Key Düzenle - {selectedUser?.firstName} {selectedUser?.lastName}
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            API Key değiştirildiğinde, kullanıcının mevcut entegrasyonları çalışmayı durdurabilir.
          </Alert>
          <Box component="form" onSubmit={apiKeyForm.handleSubmit(onApiKeySubmit)} sx={{ mt: 1 }}>
            <Controller
              name="apiKey"
              control={apiKeyForm.control}
              rules={{ required: 'API Key gerekli' }}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="API Key"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={generateApiKeyForEdit} edge="end">
                          <RefreshIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApiKeyOpen(false)}>İptal</Button>
          <Button
            onClick={apiKeyForm.handleSubmit(onApiKeySubmit)}
            variant="contained"
            disabled={updateUserMutation.isLoading}
          >
            {updateUserMutation.isLoading ? 'Güncelleniyor...' : 'API Key Güncelle'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kredi Ekleme Dialog */}
      <Dialog open={balanceOpen} onClose={() => setBalanceOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Kredi Ekle - {selectedUser?.firstName} {selectedUser?.lastName}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Mevcut Kredi: {Math.floor(parseFloat(selectedUser?.balance || 0))} SMS
          </Alert>
          <Box component="form" onSubmit={balanceForm.handleSubmit(onBalanceSubmit)} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="amount"
                  control={balanceForm.control}
                  rules={{ 
                    required: 'Miktar gerekli',
                    min: { value: 1, message: 'En az 1 kredi' }
                  }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Eklenecek Kredi Miktarı"
                      type="number"
                      inputProps={{ min: 1, step: 1 }}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || '1 kredi = 1 SMS gönderimi'}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={balanceForm.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Açıklama"
                      placeholder="Admin tarafından kredi eklendi"
                      multiline
                      rows={2}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBalanceOpen(false)}>İptal</Button>
          <Button
            onClick={balanceForm.handleSubmit(onBalanceSubmit)}
            variant="contained"
            disabled={addBalanceMutation.isLoading}
          >
            {addBalanceMutation.isLoading ? 'Ekleniyor...' : 'Kredi Ekle'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SMS Ayarları Dialog */}
      <Dialog open={smsSettingsOpen} onClose={() => setSmsSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          SMS Ayarları - {selectedUser?.firstName} {selectedUser?.lastName}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Bu kullanıcı için özel SMS gönderici adı ve API key tanımlayabilirsiniz.
          </Alert>
          
          <Box component="form" onSubmit={smsSettingsForm.handleSubmit(onSMSSettingsSubmit)} sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="smsTitle"
                  control={smsSettingsForm.control}
                  rules={{ 
                    required: 'SMS gönderici adı gerekli',
                    maxLength: { value: 20, message: 'Maksimum 20 karakter' }
                  }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="SMS Gönderici Adı (Title)"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'Örnekler: 08509449683, FIRMA, MARKA'}
                      placeholder="08509449683"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="smsApiKey"
                  control={smsSettingsForm.control}
                  rules={{ 
                    required: 'SMS API Key gerekli',
                    minLength: { value: 10, message: 'En az 10 karakter' }
                  }}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="TurkeySMS API Key"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'Kullanıcıya özel API key'}
                      type="password"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSmsSettingsOpen(false)}>İptal</Button>
          <Button
            onClick={smsSettingsForm.handleSubmit(onSMSSettingsSubmit)}
            variant="contained"
            disabled={updateSMSSettingsMutation.isLoading}
          >
            {updateSMSSettingsMutation.isLoading ? 'Güncelleniyor...' : 'SMS Ayarlarını Güncelle'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminUsers;