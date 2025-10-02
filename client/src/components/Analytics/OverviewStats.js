import React from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import {
  Science as ScienceIcon,
  Folder as FolderIcon,
  People as PeopleIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <Paper sx={{ p: 3, height: '100%' }}>
    <Box display="flex" alignItems="center" justifyContent="space-between">
      <Box>
        <Typography color="textSecondary" variant="subtitle2" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" component="div">
          {value?.toLocaleString() || 0}
        </Typography>
      </Box>
      <Box
        sx={{
          backgroundColor: color,
          borderRadius: '50%',
          width: 56,
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Icon sx={{ color: 'white', fontSize: 28 }} />
      </Box>
    </Box>
  </Paper>
);

const OverviewStats = ({ data }) => {
  if (!data) return null;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Total Specimens"
          value={data.total_specimens}
          icon={ScienceIcon}
          color="#1976d2"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Total Projects"
          value={data.total_projects}
          icon={FolderIcon}
          color="#2e7d32"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Collaborators"
          value={data.total_collaborators}
          icon={PeopleIcon}
          color="#ed6c02"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Added (30 Days)"
          value={data.specimens_last_30_days}
          icon={TrendingUpIcon}
          color="#9c27b0"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Extracted"
          value={data.specimens_extracted}
          icon={CheckCircleIcon}
          color="#0288d1"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatCard
          title="Used Up"
          value={data.specimens_used_up}
          icon={CancelIcon}
          color="#d32f2f"
        />
      </Grid>
    </Grid>
  );
};

export default OverviewStats;
