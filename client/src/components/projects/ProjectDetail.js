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
  Chip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Print as PrintIcon,
  Storage as MetadataIcon,
} from '@mui/icons-material';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { projectAPI, labelAPI, specimenAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const ProjectDetail = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [specimens, setSpecimens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [specimensLoading, setSpecimensLoading] = useState(true);
  const [error, setError] = useState('');
  const [metadataFields, setMetadataFields] = useState([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isEditor = currentUser?.role === 'editor' || isAdmin;

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await projectAPI.getById(id);
        setProject(response.data);
      } catch (err) {
        console.error('Error fetching project', err);
        setError('Failed to load project details');
      } finally {
        setLoading(false);
      }
    };

    const fetchSpecimens = async () => {
      try {
        const response = await projectAPI.getSpecimens(id);
        setSpecimens(response.data);
      } catch (err) {
        console.error('Error fetching specimens', err);
        // Don't set error for specimens, just log it
      } finally {
        setSpecimensLoading(false);
      }
    };

    fetchProject();
    fetchSpecimens();
    fetchProjectMetadata();
  }, [id]);

  const fetchProjectMetadata = async () => {
    try {
      setMetadataLoading(true);
      const response = await specimenAPI.getAll(`?project_id=${id}`);
      const projectSpecimens = response.data.specimens || response.data;
      
      // Extract all unique metadata fields from specimens in this project
      const allMetadataFields = new Set();
      const specimenMetadata = [];
      
      projectSpecimens.forEach(specimen => {
        if (specimen.metadata && typeof specimen.metadata === 'object') {
          Object.keys(specimen.metadata).forEach(field => {
            allMetadataFields.add(field);
          });
          specimenMetadata.push({
            specimenId: specimen.tube_id || specimen.id,
            metadata: specimen.metadata
          });
        }
      });
      
      setMetadataFields([...allMetadataFields]);
    } catch (err) {
      console.error('Error fetching project metadata', err);
    } finally {
      setMetadataLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this project? This will also delete all associated specimens.')) {
      return;
    }

    try {
      await projectAPI.delete(id);
      toast.success('Project deleted successfully');
      navigate('/projects');
    } catch (err) {
      console.error('Error deleting project', err);
      toast.error('Failed to delete project');
    }
  };

  const handleGenerateLabels = async () => {
    try {
      const response = await labelAPI.generateProjectLabels(id);
      toast.success(`Labels generated for project specimens`);
      console.log('Label content:', response.data.content);
      
      // You could trigger a download here or other actions
    } catch (err) {
      console.error('Error generating labels', err);
      toast.error('Failed to generate labels');
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
          to="/projects"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Projects
        </Button>
      </Box>
    );
  }

  if (!project) {
    return (
      <Box my={4}>
        <Alert severity="info">Project not found</Alert>
        <Button
          component={Link}
          to="/projects"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Projects
        </Button>
      </Box>
    );
  }

  return (
    <Box className="project-detail page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton
            component={Link}
            to="/projects"
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {project.disease || 'Unnamed Project'}
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handleGenerateLabels}
            sx={{ mr: 1 }}
          >
            Print Labels
          </Button>
          {isEditor && (
            <>
              <Button
                component={Link}
                to={`/projects/edit/${id}`}
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
              Project Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Collaborator</Typography>
                <Typography variant="body1" gutterBottom>
                  <Link to={`/collaborators/${project.collaborator_id}`}>
                    {project.pi_name && project.pi_institute ? 
                      `${project.pi_name}, ${project.pi_institute}` : 
                      'Unknown Collaborator'}
                  </Link>
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Disease</Typography>
                <Typography variant="body1" gutterBottom>{project.disease || '—'}</Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Specimen Type</Typography>
                <Typography variant="body1" gutterBottom>{project.specimen_type || '—'}</Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Source</Typography>
                <Typography variant="body1" gutterBottom>{project.source || '—'}</Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">Date Received</Typography>
                <Typography variant="body1" gutterBottom>{formatDate(project.date_received) || '—'}</Typography>
              </Grid>
              
              {project.feedback_date && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Feedback Date</Typography>
                  <Typography variant="body1" gutterBottom>{formatDate(project.feedback_date)}</Typography>
                </Grid>
              )}
            </Grid>

            {project.comments && (
              <Box mt={2}>
                <Typography variant="subtitle2" color="text.secondary">Comments</Typography>
                <Typography variant="body2">{project.comments}</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Specimens
              </Typography>
              {isEditor && (
                <Button
                  component={Link}
                  to="/specimens/new"
                  state={{ project_id: id }}
                  size="small"
                  startIcon={<AddIcon />}
                >
                  New Specimen
                </Button>
              )}
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {specimensLoading ? (
              <Box display="flex" justifyContent="center" my={2}>
                <CircularProgress size={24} />
              </Box>
            ) : specimens.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No specimens for this project
              </Typography>
            ) : (
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tube ID</TableCell>
                      <TableCell>Patient</TableCell>
                      <TableCell>Date Collected</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {specimens.map((specimen) => (
                      <TableRow key={specimen.id} hover>
                        <TableCell>{specimen.tube_id || '—'}</TableCell>
                        <TableCell>
                          {specimen.patient_external_id ? 
                            (specimen.patient_name ? 
                              `${specimen.patient_external_id} (${specimen.patient_name})` : 
                              specimen.patient_external_id) : 
                            '—'}
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

        {/* Project Metadata Section */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MetadataIcon />
                Project Metadata
              </Typography>
              {isEditor && (
                <Button
                  variant="outlined"
                  startIcon={<MetadataIcon />}
                  onClick={() => navigate('/metadata')}
                  size="small"
                >
                  Manage Metadata
                </Button>
              )}
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {metadataLoading ? (
              <Box display="flex" justifyContent="center" my={2}>
                <CircularProgress size={24} />
              </Box>
            ) : metadataFields.length === 0 ? (
              <Alert severity="info">
                <Typography variant="body2">
                  No metadata fields found for specimens in this project. 
                  {isEditor && ' Use the "Manage Metadata" button to access the metadata management system.'}
                </Typography>
              </Alert>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  This project contains <strong>{metadataFields.length}</strong> metadata fields across its specimens:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                  {metadataFields.map((field) => (
                    <Chip
                      key={field}
                      label={field}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  ))}
                </Box>
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Contextual metadata viewing:</strong> All specimens in this project share the same metadata schema, 
                    so there are no empty columns. For detailed metadata viewing, visit individual specimen pages 
                    or use the specimens table above.
                  </Typography>
                </Alert>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

    </Box>
  );
};

export default ProjectDetail;