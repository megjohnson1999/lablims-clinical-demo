import React from 'react';
import { Card, CardContent, Typography, Grid, Button, Box, Chip, Stack } from '@mui/material';
import {
  Biotech as SpecimenIcon,
  People as CollaboratorIcon,
  Folder as ProjectIcon,
  Person as PatientIcon,
  Inventory as InventoryIcon,
  ArrowForward
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const DemoWelcomeCard = ({ stats }) => {
  const navigate = useNavigate();

  const features = [
    {
      title: 'Specimen Tracking',
      description: 'Complete sample lifecycle management',
      icon: <SpecimenIcon fontSize="large" color="primary" />,
      path: '/specimens',
      stat: `${stats.specimens || 0} specimens`
    },
    {
      title: 'Project Management',
      description: 'Research projects with hierarchical organization',
      icon: <ProjectIcon fontSize="large" color="secondary" />,
      path: '/projects',
      stat: `${stats.projects || 0} projects`
    },
    {
      title: 'Patient Records',
      description: 'Clinical patient data with secure tracking',
      icon: <PatientIcon fontSize="large" color="success" />,
      path: '/patients',
      stat: `${stats.patients || 0} patients`
    },
    {
      title: 'Collaborator Network',
      description: 'External labs and research partners',
      icon: <CollaboratorIcon fontSize="large" color="info" />,
      path: '/collaborators',
      stat: `${stats.collaborators || 0} collaborators`
    },
    {
      title: 'Inventory Control',
      description: 'Reagents and supplies with alerts',
      icon: <InventoryIcon fontSize="large" color="warning" />,
      path: '/inventory',
      stat: 'Real-time tracking'
    }
  ];

  return (
    <Card sx={{ mb: 3, background: '#0f172a', color: 'white' }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
            Welcome to LabLIMS Clinical Demo
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            Managing {stats.specimens || 0} specimens across {stats.projects || 0} research projects
          </Typography>
        </Box>

        <Typography variant="body1" sx={{ mb: 3, opacity: 0.95 }}>
          This interactive demo showcases a complete clinical laboratory management system.
          Explore the features below to see how LabLIMS streamlines your diagnostic workflows.
        </Typography>

        <Grid container spacing={2}>
          {features.map((feature) => (
            <Grid item xs={12} sm={6} md={4} key={feature.title}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                  }
                }}
                onClick={() => navigate(feature.path)}
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {feature.icon}
                      <ArrowForward color="action" />
                    </Box>
                    <Typography variant="h6" component="h3" sx={{ fontWeight: 'bold' }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                    <Chip
                      label={feature.stat}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/specimens')}
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              '&:hover': { bgcolor: 'grey.100' }
            }}
          >
            Start with Specimens
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/projects')}
            sx={{
              borderColor: 'white',
              color: 'white',
              '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
            }}
          >
            View Projects
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default DemoWelcomeCard;
