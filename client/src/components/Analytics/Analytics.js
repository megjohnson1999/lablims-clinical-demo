import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import analyticsService from '../../services/analyticsService';
import SpecimenSiteChart from './SpecimenSiteChart';
import DiseaseChart from './DiseaseChart';
import InstitutionChart from './InstitutionChart';
import StatusChart from './StatusChart';
import TimelineChart from './TimelineChart';
import StorageChart from './StorageChart';
import ProjectVolumesChart from './ProjectVolumesChart';

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    overview: null,
    specimenSite: [],
    disease: [],
    institution: [],
    status: [],
    timeline: [],
    storage: [],
    projectVolumes: [],
    extractionStatus: [],
    availabilityStatus: []
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        overview,
        specimenSite,
        disease,
        institution,
        status,
        timeline,
        storage,
        projectVolumes,
        extractionStatus,
        availabilityStatus
      ] = await Promise.all([
        analyticsService.getOverview(),
        analyticsService.getSpecimensBySite(),
        analyticsService.getSpecimensByDisease(),
        analyticsService.getSpecimensByInstitution(),
        analyticsService.getSpecimensByStatus(),
        analyticsService.getSpecimensTimeline(),
        analyticsService.getStorageDistribution(),
        analyticsService.getProjectVolumes(),
        analyticsService.getExtractionStatus(),
        analyticsService.getAvailabilityStatus()
      ]);

      setData({
        overview,
        specimenSite,
        disease,
        institution,
        status,
        timeline,
        storage,
        projectVolumes,
        extractionStatus,
        availabilityStatus
      });
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Analytics Dashboard
      </Typography>

      {/* Charts Grid */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Specimen Type Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" gutterBottom>
              Specimens by Type
            </Typography>
            <SpecimenSiteChart data={data.specimenSite} />
          </Paper>
        </Grid>

        {/* Disease Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" gutterBottom>
              Top Diseases (Top 20)
            </Typography>
            <DiseaseChart data={data.disease} />
          </Paper>
        </Grid>

        {/* Institution Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" gutterBottom>
              Top Institutions (Top 20)
            </Typography>
            <InstitutionChart data={data.institution} />
          </Paper>
        </Grid>

        {/* Storage Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" gutterBottom>
              Storage Distribution by Freezer
            </Typography>
            <StorageChart data={data.storage} />
          </Paper>
        </Grid>

        {/* Collection Timeline */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, height: '400px' }}>
            <Typography variant="h6" gutterBottom>
              Collection Timeline
            </Typography>
            <TimelineChart data={data.timeline} />
          </Paper>
        </Grid>

        {/* Project Volumes */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, height: '500px' }}>
            <Typography variant="h6" gutterBottom>
              Top Projects by Specimen Count
            </Typography>
            <ProjectVolumesChart data={data.projectVolumes} />
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Analytics;
