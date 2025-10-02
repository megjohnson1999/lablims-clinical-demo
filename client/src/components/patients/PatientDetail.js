import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Divider,
  IconButton,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { patientAPI } from '../../services/api';
import { formatDate, getLocationString } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const PatientDetail = () => {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [specimens, setSpecimens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [specimensLoading, setSpecimensLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isEditor = currentUser?.role === 'editor' || isAdmin;

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const response = await patientAPI.getById(id);
        setPatient(response.data);
      } catch (err) {
        console.error('Error fetching patient', err);
        setError('Failed to load patient details');
      } finally {
        setLoading(false);
      }
    };

    const fetchSpecimens = async () => {
      try {
        const response = await patientAPI.getSpecimens(id);
        setSpecimens(response.data);
      } catch (err) {
        console.error('Error fetching specimens', err);
        // Don't set error for specimens, just log it
      } finally {
        setSpecimensLoading(false);
      }
    };

    fetchPatient();
    fetchSpecimens();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this patient?')) {
      return;
    }

    try {
      await patientAPI.delete(id);
      toast.success('Patient deleted successfully');
      navigate('/patients');
    } catch (err) {
      console.error('Error deleting patient', err);
      if (err.response?.data?.msg) {
        toast.error(err.response.data.msg);
      } else {
        toast.error('Failed to delete patient');
      }
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box my={4}>
        <Alert severity="error">{error}</Alert>
        <Button
          component={Link}
          to="/patients"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Patients
        </Button>
      </Box>
    );
  }

  if (!patient) {
    return (
      <Box my={4}>
        <Alert severity="info">Patient not found</Alert>
        <Button
          component={Link}
          to="/patients"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Patients
        </Button>
      </Box>
    );
  }

  return (
    <Box className="patient-detail page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton
            component={Link}
            to="/patients"
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {patient.external_id ? 
              `${patient.external_id} (${patient.first_name || ''} ${patient.last_name || ''})`.trim() : 
              `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unnamed Patient'}
          </Typography>
        </Box>
        <Box>
          {isEditor && (
            <>
              <Button
                component={Link}
                to={`/patients/edit/${id}`}
                variant="outlined"
                startIcon={<EditIcon />}
                sx={{ mr: 1 }}
              >
                Edit
              </Button>
              {isAdmin && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Patient Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">External ID</Typography>
                <Typography variant="body1" gutterBottom>{patient.external_id || '—'}</Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Name</Typography>
                <Typography variant="body1" gutterBottom>
                  {patient.first_name || patient.last_name ? 
                    `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : 
                    '—'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Date of Birth</Typography>
                <Typography variant="body1" gutterBottom>{formatDate(patient.date_of_birth) || '—'}</Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Diagnosis</Typography>
                <Typography variant="body1" gutterBottom>{patient.diagnosis || '—'}</Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Physician</Typography>
                <Typography variant="body1" gutterBottom>
                  {patient.physician_first_name || patient.physician_last_name ? 
                    `${patient.physician_first_name || ''} ${patient.physician_last_name || ''}`.trim() : 
                    '—'}
                </Typography>
              </Grid>
            </Grid>

            {patient.comments && (
              <Box mt={2}>
                <Typography variant="subtitle2" color="text.secondary">Comments</Typography>
                <Typography variant="body2">{patient.comments}</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Specimens
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {specimensLoading ? (
              <Box display="flex" justifyContent="center" my={2}>
                <CircularProgress size={24} />
              </Box>
            ) : specimens.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No specimens for this patient
              </Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tube ID</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Project</TableCell>
                      <TableCell>Date Collected</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {specimens.map((specimen) => (
                      <TableRow key={specimen.id} hover>
                        <TableCell>{specimen.tube_id || '—'}</TableCell>
                        <TableCell>{getLocationString(specimen) || '—'}</TableCell>
                        <TableCell>
                          <Link to={`/projects/${specimen.project_id}`}>
                            {specimen.disease || 'Unnamed Project'}
                          </Link>
                        </TableCell>
                        <TableCell>{formatDate(specimen.date_collected) || '—'}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            component={Link}
                            to={`/specimens/${specimen.id}`}
                            title="View"
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PatientDetail;