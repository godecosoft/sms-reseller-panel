// src/pages/user/UserHistory.jsx - İYİLEŞTİRİLMİŞ LOADING STATES VE ERROR HANDLING
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  MenuItem,
  Paper,
  Divider,
  Alert,
  LinearProgress,
  Skeleton,
  CircularProgress
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  Assessment as AssessmentIcon,
  PhoneAndroid as PhoneIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Block as BlockIcon,
  ErrorOutline as ErrorIcon
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { userAPI } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

const UserHistory = () => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: ''
  });

  // SMS geçmişi - GELIŞTIRILMIŞ LOADING VE ERROR HANDLING
  const { 
    data: historyData, 
    isLoading, 
    isError, 
    error, 
    refetch,
    isFetching 
  } = useQuery(
    ['user-sms-history', page, rowsPerPage, filters],
    () => userAPI.getSMSHistory({
      page: page + 1,
      limit: rowsPerPage,
      ...filters
    }).then(res => res.data),
    { 
      keepPreviousData: true,
      refetchInterval: 30000, // 30 saniyede bir güncelle
      refetchIntervalInBackground: true,
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: (error) => {
        console.error('SMS geçmişi yükleme hatası:', error);
      }
    }
  );

  // Kampanya detayları - GELIŞTIRILMIŞ ERROR HANDLING
  const { 
    data: campaignDetail, 
    isLoading: isDetailLoading,
    isError: isDetailError 
  } = useQuery(
    ['campaign-detail', selectedCampaign],
    () => selectedCampaign ? userAPI.getCampaign(selectedCampaign).then(res => res.data) : null,
    { 
      enabled: !!selectedCampaign,
      retry: 1,
      onError: (error) => {
        console.error('Kampanya detayı yükleme hatası:', error);
      }
    }
  );

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewDetail = (campaignId) => {
    setSelectedCampaign(campaignId);
    setDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedCampaign(null);
  };

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
    // TurkeySMS rapor verilerini kullan
    const delivered = campaign.deliveredCount || 0;
    const failed = campaign.failedCount || 0;
    const total = delivered + failed;
    return total > 0 ? Math.round((delivered / total) * 100) : 0;
  };

  // Ana loading durumu
  if (isLoading && !historyData) {
    return <LoadingSpinner message="SMS geçmişi yükleniyor..." />;
  }

  // Hata durumu
  if (isError) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
        <Typography variant="h6" color="error" gutterBottom>
          SMS Geçmişi Yüklenirken Hata Oluştu
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {error?.response?.data?.error || error?.message || 'Bilinmeyen hata'}
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => refetch()}
          startIcon={<RefreshIcon />}
        >
          Tekrar Dene
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          SMS Geçmişi
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isFetching && <CircularProgress size={20} />}
          <Typography variant="caption" color="text.secondary">
            Otomatik güncelleme: 30s
          </Typography>
          <IconButton 
            onClick={() => refetch()} 
            color="primary"
            disabled={isFetching}
          >
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Filtreler */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FilterListIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Filtreler
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                select
                label="Durum"
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
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
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="date"
                label="Bitiş Tarihi"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setFilters({ status: '', startDate: '', endDate: '' })}
              >
                Filtreleri Temizle
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Yükleme durumunda progress bar */}
      {isFetching && historyData && (
        <LinearProgress sx={{ mb: 2 }} />
      )}

      {/* Tablo */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Kampanya Adı</strong></TableCell>
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
              {/* Loading skeleton */}
              {isFetching && !historyData && [...Array(5)].map((_, index) => (
                <TableRow key={index}>
                  {[...Array(9)].map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

              {/* Veri varsa göster */}
              {historyData?.campaigns?.map((campaign) => (
                <TableRow key={campaign.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {campaign.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {campaign.messageText.substring(0, 50)}...
                    </Typography>
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
                    <Box>
                      <Typography variant="body2">
                        {new Date(campaign.createdAt).toLocaleDateString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Typography>
                      {campaign.lastReportCheck && (
                        <Typography variant="caption" color="text.secondary">
                          Son kontrol: {new Date(campaign.lastReportCheck).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Typography>
                      )}
                    </Box>
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
        
        {/* Veri yoksa mesaj göster */}
        {(!historyData?.campaigns || historyData.campaigns.length === 0) && !isFetching && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              Henüz SMS gönderimi bulunmuyor
            </Typography>
          </Box>
        )}
        
        {/* Pagination */}
        {historyData?.pagination && (
          <TablePagination
            component="div"
            count={historyData.pagination.total || 0}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            labelRowsPerPage="Sayfa başına satır:"
            labelDisplayedRows={({ from, to, count }) => 
              `${from}-${to} / ${count !== -1 ? count : `${to}'den fazla`}`
            }
          />
        )}
      </Card>

      {/* Detay Dialog */}
      <Dialog
        open={detailOpen}
        onClose={handleCloseDetail}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Kampanya Detayları ve Raporlama
        </DialogTitle>
        <DialogContent>
          {/* Dialog loading durumu */}
          {isDetailLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Dialog hata durumu */}
          {isDetailError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Kampanya detayları yüklenirken hata oluştu. Lütfen tekrar deneyin.
            </Alert>
          )}

          {/* Kampanya detayları */}
          {campaignDetail?.campaign && !isDetailLoading && (
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
                      Durum
                    </Typography>
                    <Chip
                      label={getStatusText(campaignDetail.campaign.status)}
                      color={getStatusColor(campaignDetail.campaign.status)}
                      size="small"
                    />
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
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    <strong>Rapor ID:</strong> {campaignDetail.campaign.reportId}
                    <br />
                    <strong>Son Rapor Kontrolü:</strong> {campaignDetail.campaign.lastReportCheck ? 
                      new Date(campaignDetail.campaign.lastReportCheck).toLocaleString('tr-TR') : 
                      'Henüz kontrol edilmedi'
                    }
                  </Typography>
                </Alert>
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
          <Button onClick={handleCloseDetail}>
            Kapat
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserHistory;