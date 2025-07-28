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
  Divider
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { userAPI } from '../../services/api';

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

  // SMS geçmişi
  const { data: historyData, isLoading, refetch } = useQuery(
    ['user-sms-history', page, rowsPerPage, filters],
    () => userAPI.getSMSHistory({
      page: page + 1,
      limit: rowsPerPage,
      ...filters
    }).then(res => res.data),
    { keepPreviousData: true }
  );

  // Kampanya detayları
  const { data: campaignDetail } = useQuery(
    ['campaign-detail', selectedCampaign],
    () => selectedCampaign ? userAPI.getCampaign(selectedCampaign).then(res => res.data) : null,
    { enabled: !!selectedCampaign }
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

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography>SMS geçmişi yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          SMS Geçmişi
        </Typography>
        <IconButton onClick={() => refetch()} color="primary">
          <RefreshIcon />
        </IconButton>
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

      {/* Tablo */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Kampanya Adı</strong></TableCell>
                <TableCell><strong>Alıcı Sayısı</strong></TableCell>
                <TableCell><strong>Başarılı</strong></TableCell>
                <TableCell><strong>Başarısız</strong></TableCell>
                <TableCell><strong>Maliyet</strong></TableCell>
                <TableCell><strong>Durum</strong></TableCell>
                <TableCell><strong>Tarih</strong></TableCell>
                <TableCell><strong>İşlemler</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
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
                  <TableCell>{campaign.totalRecipients}</TableCell>
                  <TableCell>
                    <Typography color="success.main" fontWeight="bold">
                      {campaign.successfulSends}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography color="error.main" fontWeight="bold">
                      {campaign.failedSends}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight="bold">
                      ₺{campaign.cost}
                    </Typography>
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
        
        {(!historyData?.campaigns || historyData.campaigns.length === 0) && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              Henüz SMS gönderimi bulunmuyor
            </Typography>
          </Box>
        )}
        
        <TablePagination
          component="div"
          count={historyData?.pagination?.total || 0}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Sayfa başına satır:"
          labelDisplayedRows={({ from, to, count }) => 
            `${from}-${to} / ${count !== -1 ? count : `${to}'den fazla`}`
          }
        />
      </Card>

      {/* Detay Dialog */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Kampanya Detayları
        </DialogTitle>
        <DialogContent>
          {campaignDetail?.campaign && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Kampanya Adı
                    </Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {campaignDetail.campaign.title}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6}>
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

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                Gönderim Detayları
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

export default UserHistory;

// ===================================
