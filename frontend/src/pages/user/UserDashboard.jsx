import React from 'react';
import { Typography, Box, Card, CardContent, Grid } from '@mui/material';

const UserDashboard = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Bakiye</Typography>
              <Typography variant="h4" color="primary">₺100.00</Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Toplam SMS</Typography>
              <Typography variant="h4" color="secondary">0</Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Başarı Oranı</Typography>
              <Typography variant="h4" color="success.main">%0</Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">Toplam Harcama</Typography>
              <Typography variant="h4" color="warning.main">₺0.00</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default UserDashboard;
