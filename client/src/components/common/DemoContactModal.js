import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert
} from '@mui/material';
import {
  ContactMail as ContactIcon,
  LockOpen as UnlockIcon
} from '@mui/icons-material';
import { useDemo } from '../../context/DemoContext';

const DemoContactModal = () => {
  const { contactModalOpen, contactModalAction, closeContactModal } = useDemo();

  const actionMessages = {
    'create': 'create new records',
    'edit': 'edit existing data',
    'delete': 'delete records',
    'add_specimen': 'add specimens to your lab',
    'edit_specimen': 'edit specimen information',
    'delete_specimen': 'remove specimens',
    'add_project': 'create research projects',
    'add_collaborator': 'add collaborators',
    'add_patient': 'add patient data',
    'manage_inventory': 'manage inventory',
    'add_protocol': 'create protocols',
    'run_experiment': 'run experiments',
    'default': 'perform this action'
  };

  const message = actionMessages[contactModalAction] || actionMessages['default'];

  return (
    <Dialog
      open={contactModalOpen}
      onClose={closeContactModal}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <UnlockIcon color="primary" />
          <Typography variant="h6" component="span">
            Interested in {message}?
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          This is a read-only demo to showcase our features. To test full functionality with your own data, let's connect!
        </Alert>

        <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
          <strong>Get a personalized demo where you can:</strong>
        </Typography>
        <Box component="ul" sx={{ pl: 3, mb: 3 }}>
          <li>Create, edit, and delete records</li>
          <li>Test workflows with your lab's specific needs</li>
          <li>Explore customization options</li>
          <li>Import your existing data</li>
          <li>Ask questions and get live support</li>
        </Box>

        <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ContactIcon fontSize="small" />
            Contact Information
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Email:</strong> demo@lablims.com
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Website:</strong>{' '}
            <a href={process.env.REACT_APP_MAIN_SITE_URL || 'https://lablims.com'} target="_blank" rel="noopener noreferrer">
              {process.env.REACT_APP_MAIN_SITE_URL || 'lablims.com'}
            </a>
          </Typography>
          <Typography variant="body2">
            Or continue exploring this demo to learn more about our features!
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={closeContactModal} variant="outlined" size="large">
          Continue Exploring Demo
        </Button>
        <Button
          href={`mailto:demo@lablims.com?subject=LabLIMS Demo Request&body=Hi, I'm interested in testing ${message} in LabLIMS. I'd like to schedule a personalized demo.`}
          variant="contained"
          size="large"
          startIcon={<ContactIcon />}
        >
          Request Full Demo
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DemoContactModal;
