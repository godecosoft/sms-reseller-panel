// src/pages/admin/AdminReports.jsx - SYNTAX HATALARI DÜZELTİLDİ
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  MenuItem,
  Button,
  Paper,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Divider
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  TrendingUp,
  People,
  Sms as SmsIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Block as BlockIcon,
  PhoneAndroid as PhoneIcon
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { adminAPI } from '../../services/api';

const AdminReports = () => {
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    userId: ''
  });
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: reportsData, isLoading, refetch } = useQuery(
    ['admin-sms-reports', filters],
    () => adminAPI.getSMSReports(filters).then(res => res.data)
  );

  const { data: statsData } = useQuery(
    'admin-dashboard-stats',
    () => adminAPI.getDashboardStats().then(res => res.data)
  );

  // Kampanya detayları için query
  const { data: campaignDetail } = useQuery(
    ['admin-campaign-detail', selectedCampaign],
    () => selectedCampaign ? adminAPI.getCampaignDetail(selectedCampaign).then(res => res.data) : null,
    { enabled: !!selectedCampaign }
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'sending': return 'info';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Tamamlandı';
      case 'pending': return 'Beklemede';
      case 'sending': return 'Gönderiliyor';
      case 'failed': return 'Başarısız';
      default: return status;
    }
  };

  const getDeliveryRate = (campaign) => {
    if (!campaign.deliveredCount && !campaign.failedCount) return 0;
    const total = campaign.deliveredCount + campaign.failedCount;
    return total > 0 ? Math.round((campaign.deliveredCount / total) * 100) : 0;
  };

  const handleViewDetail = (campaignId) => {
    setSelectedCampaign(campaignId);
    setDetailOpen(true);
  };

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography>Raporlar yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          SMS Raporları
        </Typography>
        <IconButton onClick={() => refetch()} color="primary">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Özet İstatistikler */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
            <SmsIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" fontWeight="bold">
              {statsData?.sms?.total || 0}
            </Typography>
            <Typography variant="body2">
              Toplam SMS
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
            <TrendingUp sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" fontWeight="bold">
              %{statsData?.sms?.successRate || 0}
            </Typography>
            <Typography variant="body2">
              Başarı Oranı
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
            <People sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" fontWeight="bold">
              {statsData?.users?.active || 0}
            </Typography>
            <Typography variant="body2">
              Aktif Kullanıcı
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
            <TrendingUp sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h4" fontWeight="bold">
              {Math.floor(parseFloat(statsData?.balance?.total || 0))}
            </Typography>
            <Typography variant="body2">
              Toplam Kredi
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filtreler */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FilterListIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Filtreler
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                select
                label="Durum"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <MenuItem value="">Tümü</MenuItem>
                <MenuItem value="completed">Tamamlandı</MenuItem>
                <MenuItem value="pending">Beklemede</MenuItem>
                <MenuItem value="sending">Gönderiliyor</MenuItem>
                <MenuItem value="failed">Başarısız</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Başlangıç Tarihi"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Bitiş Tarihi"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setFilters({ status: '', startDate: '', endDate: '', userId: '' })}
              >
                Filtreleri Temizle
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Kampanya Listesi */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📋 Kampanya Listesi ve Raporları
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Kampanya</strong></TableCell>
                  <TableCell><strong>Kullanıcı</strong></TableCell>
                  <TableCell><strong>Alıcı Sayısı</strong></TableCell>
                  <TableCell><strong>Teslim Edilen</strong></TableCell>
                  <TableCell><strong>Başarısız</strong></TableCell>
                  <TableCell><strong>Rapor ID</strong></TableCell>
                  <TableCell><strong>Teslim Oranı</strong></TableCell>
                  <TableCell><strong>Durum</strong></TableCell>
                  <TableCell><strong>Tarih</strong></TableCell>
                  <TableCell><strong>İşlemler</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportsData?.campaigns?.map((campaign) => (
                  <TableRow key={campaign.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {campaign.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {campaign.messageText?.substring(0, 30)}...
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: 12 }}>
                          {campaign.user?.firstName?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">
                            {campaign.user?.firstName} {campaign.user?.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            @{campaign.user?.username}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="bold">
                        {campaign.totalRecipients}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CheckCircleIcon sx={{ color: 'success.main', mr: 0.5, fontSize: 16 }} />
                        <Typography color="success.main" fontWeight="bold">
                          {campaign.deliveredCount || 0}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CancelIcon sx={{ color: 'error.main', mr: 0.5, fontSize: 16 }} />
                        <Typography color="error.main" fontWeight="bold">
                          {campaign.failedCount || 0}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {campaign.reportId ? (
                        <Chip
                          label={campaign.reportId}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Henüz yok
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 100 }}>
                        <Box sx={{ width: '100%', mr: 1 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={getDeliveryRate(campaign)}
                            color={getDeliveryRate(campaign) > 80 ? 'success' : getDeliveryRate(campaign) > 50 ? 'warning' : 'error'}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          %{getDeliveryRate(campaign)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(campaign.status)}
                        color={getStatusColor(campaign.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(campaign.createdAt).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetail(campaign.id)}
                        color="primary"
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {(!reportsData?.campaigns || reportsData.campaigns.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                Henüz SMS kampanyası bulunmuyor
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Kampanya Detay Dialog */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Kampanya Detay Raporu
        </DialogTitle>
        <DialogContent>
          {campaignDetail?.campaign && (
            <Box>
              {/* Kampanya Bilgileri */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Kampanya Adı
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {campaignDetail.campaign.title}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Kullanıcı
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {campaignDetail.campaign.user?.firstName} {campaignDetail.campaign.user?.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      @{campaignDetail.campaign.user?.username}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Mesaj Metni
                    </Typography>
                    <Typography variant="body1">
                      {campaignDetail.campaign.messageText}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Raporlama Bilgileri */}
              {campaignDetail.campaign.reportId && (
                <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.light' }}>
                  <Typography variant="h6" gutterBottom>
                    📊 TurkeySMS Rapor Bilgileri
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        <strong>Rapor ID:</strong> {campaignDetail.campaign.reportId}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        <strong>Son Kontrol:</strong> {campaignDetail.campaign.lastReportCheck ? 
                          new Date(campaignDetail.campaign.lastReportCheck).toLocaleString('tr-TR') : 
                          'Henüz kontrol edilmedi'
                        }
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {/* İstatistik Kartları */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light' }}>
                    <PhoneIcon sx={{ fontSize: 30, color: 'primary.contrastText' }} />
                    <Typography variant="h4" color="primary.contrastText" fontWeight="bold">
                      {campaignDetail.campaign.totalRecipients}
                    </Typography>
                    <Typography variant="caption" color="primary.contrastText">
                      Toplam Alıcı
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                    <CheckCircleIcon sx={{ fontSize: 30, color: 'success.contrastText' }} />
                    <Typography variant="h4" color="success.contrastText" fontWeight="bold">
                      {campaignDetail.campaign.deliveredCount || 0}
                    </Typography>
                    <Typography variant="caption" color="success.contrastText">
                      Teslim Edilen
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light' }}>
                    <CancelIcon sx={{ fontSize: 30, color: 'error.contrastText' }} />
                    <Typography variant="h4" color="error.contrastText" fontWeight="bold">
                      {campaignDetail.campaign.failedCount || 0}
                    </Typography>
                    <Typography variant="caption" color="error.contrastText">
                      Başarısız
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                    <BlockIcon sx={{ fontSize: 30, color: 'warning.contrastText' }} />
                    <Typography variant="h4" color="warning.contrastText" fontWeight="bold">
                      {campaignDetail.campaign.blockedCount || 0}
                    </Typography>
                    <Typography variant="caption" color="warning.contrastText">
                      Engellenmiş
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Operatör Dağılımı */}
              {(campaignDetail.campaign.turkcellCount || campaignDetail.campaign.vodafoneCount || campaignDetail.campaign.turktelekomCount) && (
                <Paper sx={{ p: 2, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    📱 Operatör Dağılımı
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" color="primary" fontWeight="bold">
                          {campaignDetail.campaign.turkcellCount || 0}
                        </Typography>
                        <Typography variant="caption">Turkcell</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" color="error" fontWeight="bold">
                          {campaignDetail.campaign.vodafoneCount || 0}
                        </Typography>
                        <Typography variant="caption">Vodafone</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h5" color="success.main" fontWeight="bold">
                          {campaignDetail.campaign.turktelekomCount || 0}
                        </Typography>
                        <Typography variant="caption">Türk Telekom</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                📞 Mesaj Detayları
              </Typography>
              
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Telefon</strong></TableCell>
                      <TableCell><strong>Durum</strong></TableCell>
                      <TableCell><strong>Gönderim</strong></TableCell>
                      <TableCell><strong>Teslim</strong></TableCell>
                      <TableCell><strong>Hata</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {campaignDetail.campaign.messages?.map((message) => (
                      <TableRow key={message.id}>
                        <TableCell>{message.phoneNumber}</TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusText(message.status)}
                            color={getStatusColor(message.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {message.sentAt ? 
                            new Date(message.sentAt).toLocaleDateString('tr-TR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 
                            '-'
                          }
                        </TableCell>
                        <TableCell>
                          {message.deliveredAt ? 
                            new Date(message.deliveredAt).toLocaleDateString('tr-TR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 
                            '-'
                          }
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="error">
                            {message.errorMessage || '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>
            Kapat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminReports;