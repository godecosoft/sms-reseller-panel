// src/pages/user/UserDashboard.jsx - KREDİ SİSTEMİNE GÜNCELLENMİŞ
import React from 'react';
import { Typography, Box, Card, CardContent, Grid } from '@mui/material';
import { useQuery } from 'react-query';
import { userAPI } from '../../services/api';

const UserDashboard = () => {
  // Kullanıcı dashboard verilerini getir
  const { data: dashboardData, isLoading } = useQuery(
    'user-dashboard',
    () => userAPI.getDashboard().then(res => res.data),
    { refetchInterval: 30000 }
  );

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography>Dashboard yükleniyor...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Mevcut Kredi</Typography>
              <Typography variant="h4" color="primary">
                {Math.floor(parseFloat(dashboardData?.user?.balance || 0))} Kredi
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Toplam SMS</Typography>
              <Typography variant="h4" color="secondary">
                {dashboardData?.sms?.total || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Başarı Oranı</Typography>
              <Typography variant="h4" color="success.main">
                %{dashboardData?.sms?.successRate || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Bu Ay</Typography>
              <Typography variant="h4" color="warning.main">
                {dashboardData?.sms?.month || 0} SMS
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Son Kampanyalar */}
      {dashboardData?.recentCampaigns && dashboardData.recentCampaigns.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Son Kampanyalar
            </Typography>
            {dashboardData.recentCampaigns.map((campaign) => (
              <Box key={campaign.id} sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}>
                <Box>
                  <Typography variant="body1" fontWeight="bold">
                    {campaign.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {campaign.totalRecipients} alıcı - {campaign.status}
                  </Typography>
                </Box>
                <Typography variant="body2" color="primary">
                  {new Date(campaign.createdAt).toLocaleDateString('tr-TR')}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default UserDashboard;