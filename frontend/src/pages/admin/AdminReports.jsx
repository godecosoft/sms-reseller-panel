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
  IconButton
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  TrendingUp,
  People,
  Sms as SmsIcon
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

  const { data: reportsData, isLoading, refetch } = useQuery(
    ['admin-sms-reports', filters],
    () => adminAPI.getSMSReports(filters).then(res => res.data)
  );

  const { data: statsData } = useQuery(
    'admin-dashboard-stats',
    () => adminAPI.getDashboardStats().then(res => res.data)
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Tamamlandı';
      case 'pending': return 'Beklemede';
      case 'failed': return 'Başarısız';
      default: return status;
    }
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
              ₺{statsData?.revenue?.total || 0}
            </Typography>
            <Typography variant="body2">
              Toplam Gelir
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
            📋 Kampanya Listesi
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Kampanya</strong></TableCell>
                  <TableCell><strong>Kullanıcı</strong></TableCell>
                  <TableCell><strong>Alıcı Sayısı</strong></TableCell>
                  <TableCell><strong>Başarılı</strong></TableCell>
                  <TableCell><strong>Başarısız</strong></TableCell>
                  <TableCell><strong>Maliyet</strong></TableCell>
                  <TableCell><strong>Durum</strong></TableCell>
                  <TableCell><strong>Tarih</strong></TableCell>
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
    </Box>
  );
};

export default AdminReports;
