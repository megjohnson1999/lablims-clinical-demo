import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip
} from '@mui/material';
import {
  Biotech as SpecimenIcon,
  People as CollaboratorIcon,
  Folder as ProjectIcon,
  Inventory as InventoryIcon,
  Science as ProtocolIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';

const WelcomeModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user has visited before
    const hasVisited = localStorage.getItem('lablims_clinical_demo_visited');
    if (!hasVisited) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('lablims_clinical_demo_visited', 'true');
    setOpen(false);
  };

  const features = [
    {
      icon: <SpecimenIcon color="primary" />,
      title: 'Specimen Tracking',
      description: 'Explore complete sample lifecycle from collection to analysis'
    },
    {
      icon: <ProjectIcon color="secondary" />,
      title: 'Project Management',
      description: 'View research projects with hierarchical organization'
    },
    {
      icon: <CollaboratorIcon color="success" />,
      title: 'Collaborator Database',
      description: 'Manage external labs and research partners'
    },
    {
      icon: <InventoryIcon color="info" />,
      title: 'Inventory System',
      description: 'Track reagents, consumables with automated alerts'
    },
    {
      icon: <ProtocolIcon color="warning" />,
      title: 'Protocol Library',
      description: 'Store lab protocols with AI-powered reagent extraction'
    }
  ];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: '#0f172a',
          color: 'white',
          borderRadius: '8px'
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
          Welcome to LabLIMS Clinical Demo
        </Typography>
        <Chip
          label="Logged in as Lab Manager"
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }}
        />
      </DialogTitle>

      <DialogContent>
        <Box sx={{ bgcolor: 'white', color: 'text.primary', borderRadius: 2, p: 3, mb: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
            What You Can Explore:
          </Typography>
          <List>
            {features.map((feature, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>{feature.icon}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {feature.title}
                      </Typography>
                    }
                    secondary={feature.description}
                  />
                </ListItem>
                {index < features.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Box>

        <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2, p: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            Quick Tips:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 1 }}>
            <li>All data is pre-populated with realistic clinical scenarios</li>
            <li>This is a read-only demo - explore all features freely!</li>
            <li>Want to test creating your own data? Click any "Add" button to request a personalized demo</li>
            <li>Use the banner at the top to visit our animal research demo</li>
            <li>Navigate between sections using the sidebar</li>
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button
          onClick={handleClose}
          variant="contained"
          size="large"
          fullWidth
          sx={{
            bgcolor: 'white',
            color: 'primary.main',
            fontWeight: 'bold',
            '&:hover': { bgcolor: 'grey.100' }
          }}
        >
          Start Exploring
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WelcomeModal;
