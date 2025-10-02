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
  Email as EmailIcon,
  Phone as PhoneIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collaboratorAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';

const CollaboratorDetail = () => {
  const { id } = useParams();
  const [collaborator, setCollaborator] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const canEdit = canEditLabData(currentUser);

  useEffect(() => {
    const fetchCollaborator = async () => {
      try {
        const response = await collaboratorAPI.getById(id);
        setCollaborator(response.data);
      } catch (err) {
        console.error('Error fetching collaborator', err);
        setError('Failed to load collaborator details');
      } finally {
        setLoading(false);
      }
    };

    const fetchProjects = async () => {
      try {
        const response = await collaboratorAPI.getProjects(id);
        setProjects(response.data);
      } catch (err) {
        console.error('Error fetching projects', err);
        // Don't set error for projects, just log it
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchCollaborator();
    fetchProjects();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this collaborator? This will also delete all associated projects and specimens.')) {
      return;
    }

    try {
      await collaboratorAPI.delete(id);
      toast.success('Collaborator deleted successfully');
      navigate('/collaborators');
    } catch (err) {
      console.error('Error deleting collaborator', err);
      toast.error('Failed to delete collaborator');
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
          to="/collaborators"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Collaborators
        </Button>
      </Box>
    );
  }

  if (!collaborator) {
    return (
      <Box my={4}>
        <Alert severity="info">Collaborator not found</Alert>
        <Button
          component={Link}
          to="/collaborators"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Collaborators
        </Button>
      </Box>
    );
  }

  return (
    <Box className="collaborator-detail page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton
            component={Link}
            to="/collaborators"
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1">
              {collaborator.pi_name}
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mt: 0.5 }}>
              {collaborator.collaborator_number === 0 || collaborator.collaborator_number === null
                ? 'Unknown Collaborator Number'
                : collaborator.collaborator_number
                  ? `Collaborator #${collaborator.collaborator_number}`
                  : 'No Collaborator Number Assigned'}
            </Typography>
          </Box>
        </Box>
        <Box>
          {canEdit && (
            <>
              <Button
                component={Link}
                to={`/collaborators/edit/${id}`}
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
              Collaborator Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Institution</Typography>
                <Typography variant="body1" gutterBottom>{collaborator.pi_institute}</Typography>
              </Grid>
              
              {collaborator.irb_id && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">IRB ID</Typography>
                  <Typography variant="body1" gutterBottom>{collaborator.irb_id}</Typography>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Contact Information</Typography>
                {collaborator.pi_email && (
                  <Box display="flex" alignItems="center" mb={1}>
                    <EmailIcon fontSize="small" sx={{ mr: 1 }} />
                    <Typography variant="body1">
                      <a href={`mailto:${collaborator.pi_email}`}>{collaborator.pi_email}</a>
                    </Typography>
                  </Box>
                )}
                
                {collaborator.pi_phone && (
                  <Box display="flex" alignItems="center" mb={1}>
                    <PhoneIcon fontSize="small" sx={{ mr: 1 }} />
                    <Typography variant="body1">
                      <a href={`tel:${collaborator.pi_phone}`}>{collaborator.pi_phone}</a>
                    </Typography>
                  </Box>
                )}
                
                {collaborator.pi_fax && (
                  <Box display="flex" alignItems="center" mb={1}>
                    <Typography variant="body2" sx={{ mr: 1 }} color="text.secondary">Fax:</Typography>
                    <Typography variant="body1">{collaborator.pi_fax}</Typography>
                  </Box>
                )}
              </Grid>
              
              {collaborator.internal_contact && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Internal Contact</Typography>
                  <Typography variant="body1" gutterBottom>{collaborator.internal_contact}</Typography>
                </Grid>
              )}
            </Grid>

            {collaborator.comments && (
              <Box mt={2}>
                <Typography variant="subtitle2" color="text.secondary">Comments</Typography>
                <Typography variant="body2">{collaborator.comments}</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Projects
              </Typography>
              {canEdit && (
                <Button
                  component={Link}
                  to="/projects/new"
                  state={{ collaborator_id: id }}
                  size="small"
                  startIcon={<AddIcon />}
                >
                  New Project
                </Button>
              )}
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {projectsLoading ? (
              <Box display="flex" justifyContent="center" my={2}>
                <CircularProgress size={24} />
              </Box>
            ) : projects.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No projects for this collaborator
              </Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Project Number</TableCell>
                      <TableCell>Disease</TableCell>
                      <TableCell>Specimen Type</TableCell>
                      <TableCell>Specimens</TableCell>
                      <TableCell>Date Received</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id} hover>
                        <TableCell>
                          {project.project_number === 0 || project.project_number === null
                            ? 'Unknown'
                            : project.project_number || '—'}
                        </TableCell>
                        <TableCell>{project.disease || '—'}</TableCell>
                        <TableCell>{project.specimen_type || '—'}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {project.specimen_count !== undefined ? project.specimen_count : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatDate(project.date_received) || '—'}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            component={Link}
                            to={`/projects/${project.id}`}
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

export default CollaboratorDetail;