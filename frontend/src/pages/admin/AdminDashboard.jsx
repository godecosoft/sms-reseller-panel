// src/pages/admin/AdminDashboard.jsx - TAM HALİ
import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip
} from '@mui/material';
import {
  People,
  Sms,
  TrendingUp,
  AccountBalance,
  CheckCircle,
  Error
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { adminAPI } from '../../services/api';

const AdminDashboard = () => {
  const { data: stats, isLoading } = useQuery(
    'admin-dashboard-stats',
    () => adminAPI.getDashboardStats().then(res => res.data),
    { refetchInterval: 30000 }
  );

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Dashboard</Typography>
        <LinearProgress />
      </Box>
    );
  }

  const statCards = [
    {
      title: 'Toplam Kullanıcı',
      value: stats?.users?.total || 0,
      icon: <People />,
      color: 'primary.main',
      subtitle: `${stats?.users?.active || 0} aktif`
    },
    {
      title: 'Toplam SMS',
      value: stats?.sms?.total || 0,
      icon: <Sms />,
      color: 'secondary.main',
      subtitle: `%${stats?.sms?.successRate || 0} başarı`
    },
    {
      title: 'Toplam Gelir',
      value: `₺${stats?.revenue?.total || 0}`,
      icon: <TrendingUp />,
      color: 'success.main',
      subtitle: `Bu ay ₺${stats?.revenue?.month || 0}`
    },
    {
      title: 'Toplam Bakiye',
      value: `₺${stats?.balance?.total || 0}`,
      icon: <AccountBalance />,
      color: 'warning.main',
      subtitle: 'Kullanıcı bakiyeleri'
    }
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Dashboard
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: card.color, mr: 2 }}>
                    {card.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="h4" fontWeight="bold">
                      {card.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.title}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {card.subtitle}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Bugünkü İstatistikler
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2">SMS Gönderimi</Typography>
                <Typography variant="body2">{stats?.sms?.today || 0}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2">Gelir</Typography>
                <Typography variant="body2">₺{stats?.revenue?.today || 0}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2">Başarı Oranı</Typography>
                <Typography variant="body2">%{stats?.sms?.successRate || 0}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Son Kampanyalar
              </Typography>
              <List>
                {stats?.recentCampaigns?.slice(0, 5).map((campaign) => (
                  <ListItem key={campaign.id} divider>
                    <ListItemAvatar>
                      <Avatar sx={{ 
                        bgcolor: campaign.status === 'completed' ? 'success.main' : 'error.main' 
                      }}>
                        {campaign.status === 'completed' ? <CheckCircle /> : <Error />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={campaign.title}
                      secondary={`${campaign.user} - ${campaign.totalRecipients} alıcı`}
                    />
                    <Chip
                      label={`₺${campaign.cost}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;