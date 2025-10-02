import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  Autocomplete,
} from '@mui/material';
import {
  Storage as StorageIcon,
  Assessment as AssessmentIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Timeline as TimelineIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { projectAPI, specimenAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import MetadataUpload from './MetadataUpload';
import EnhancedExportDialog from '../common/EnhancedExportDialog';
import MetadataAnalytics from './MetadataAnalytics';

const MetadataList = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [loading, setLoading] = useState(true);
  const [recentProjects, setRecentProjects] = useState([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [projectsWithEnhancedData, setProjectsWithEnhancedData] = useState([]);
  
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isEditor = currentUser?.role === 'editor' || currentUser?.role === 'admin';

  useEffect(() => {
    fetchProjects();
    loadRecentProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      saveRecentProject(selectedProject);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      // Load only projects that have metadata for focused metadata management
      const response = await projectAPI.getWithMetadata();
      const projectsData = response.data.projects || response.data;
      setProjects(projectsData);
      
      // Enhance projects with display information
      await enhanceProjectsWithDisplayData(projectsData);
    } catch (err) {
      console.error('Failed to fetch projects with metadata:', err);
      toast.error('Failed to load projects with metadata');
    } finally {
      setLoading(false);
    }
  };

  const enhanceProjectsWithDisplayData = async (projectsData) => {
    try {
      // Enhance projects with display information using actual fields
      const enhancedProjects = projectsData.map(project => ({
        ...project,
        displayName: project.project_number 
          ? `Project #${project.project_number} - ${project.disease || 'Unknown'}`
          : project.disease || `Project ${project.id.substring(0, 8)}...`,
        searchableText: [
          project.disease,
          project.pi_name,
          project.project_number,
          project.id
        ].filter(Boolean).join(' ').toLowerCase()
      }));
      
      setProjectsWithEnhancedData(enhancedProjects);
    } catch (err) {
      console.error('Failed to enhance projects with display data:', err);
      // Fallback to original projects with basic display data
      const fallbackProjects = projectsData.map(project => ({
        ...project,
        displayName: project.disease || `Project ${project.id.substring(0, 8)}...`,
        searchableText: [
          project.disease,
          project.pi_name,
          project.project_number,
          project.id
        ].filter(Boolean).join(' ').toLowerCase()
      }));
      setProjectsWithEnhancedData(fallbackProjects);
    }
  };


  const loadRecentProjects = () => {
    const recent = JSON.parse(localStorage.getItem('recentMetadataProjects') || '[]');
    setRecentProjects(recent.slice(0, 5)); // Show last 5 projects
  };

  const saveRecentProject = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    let recent = JSON.parse(localStorage.getItem('recentMetadataProjects') || '[]');
    
    // Remove if already exists
    recent = recent.filter(p => p.id !== projectId);
    
    // Add to front
    recent.unshift({
      id: project.id,
      name: project.disease || `Project ${project.id}`,
      lastAccessed: new Date().toISOString()
    });
    
    // Keep only last 10
    recent = recent.slice(0, 10);
    
    localStorage.setItem('recentMetadataProjects', JSON.stringify(recent));
    setRecentProjects(recent.slice(0, 5));
  };

  const handleProjectSelect = (projectId) => {
    setSelectedProject(projectId);
  };

  const handleViewProject = () => {
    if (selectedProject) {
      navigate(`/metadata/${selectedProject}`);
    }
  };


  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    toast.success('Metadata upload completed successfully');
    // The MetadataAnalytics component will automatically refresh when it detects changes
  };

  const getSelectedProjectData = () => {
    return projects.find(p => p.id === selectedProject);
  };


  const handleProjectSearch = (searchTerm) => {
    setProjectSearchTerm(searchTerm);
  };

  const clearProjectSearch = () => {
    setProjectSearchTerm('');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="metadata-list page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" display="flex" alignItems="center">
          <StorageIcon sx={{ mr: 2 }} />
          Metadata Management
        </Typography>
        
        <Box>
          <Button
            variant="outlined"
            startIcon={<SearchIcon />}
            onClick={() => navigate('/metadata/search')}
            sx={{ mr: 1 }}
          >
            Advanced Search
          </Button>
          
          {isEditor && (
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
              sx={{ mr: 1 }}
              color="primary"
            >
              Upload Metadata
            </Button>
          )}
          
          {selectedProject && (
            <>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => setExportDialogOpen(true)}
                sx={{ mr: 1 }}
              >
                Export Data
              </Button>
              {isEditor && (
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  onClick={() => setUploadDialogOpen(true)}
                  sx={{ mr: 1 }}
                >
                  Upload Metadata
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<ViewIcon />}
                onClick={handleViewProject}
              >
                View Metadata
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Metadata Upload Information */}
      {isEditor && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Smart Metadata Upload:</strong> Use the "Upload Metadata" button to upload metadata for specimens. 
            The system automatically detects whether your data spans single or multiple projects and shows you the impact before applying changes.
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Project Selection */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center">
              <FolderOpenIcon sx={{ mr: 1 }} />
              Projects with Metadata
            </Typography>
            
            <Alert severity="info" sx={{ mb: 2, fontSize: '0.875rem' }}>
              <Typography variant="body2">
                Showing only projects that have specimens with metadata. 
                Use "Upload Metadata" to add metadata to any project.
              </Typography>
            </Alert>
            
            <Autocomplete
              fullWidth
              options={projectsWithEnhancedData}
              value={projectsWithEnhancedData.find(p => p.id === selectedProject) || null}
              onChange={(event, newValue) => {
                handleProjectSelect(newValue ? newValue.id : '');
                setProjectSearchTerm(''); // Clear search when selection is made
              }}
              inputValue={projectSearchTerm}
              onInputChange={(event, newInputValue) => {
                setProjectSearchTerm(newInputValue);
              }}
              getOptionLabel={(option) => option.displayName || ''}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <Typography variant="body1">
                      {option.displayName}
                    </Typography>
                    {option.pi_name && (
                      <Typography variant="body2" color="text.secondary">
                        PI: {option.pi_name}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Projects with Metadata"
                  placeholder="Type project name, ID, or investigator..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
              filterOptions={(options, { inputValue }) => {
                if (!inputValue.trim()) {
                  return options;
                }
                
                const searchLower = inputValue.toLowerCase();
                const searchTerm = inputValue.trim();
                
                return options.filter(project => {
                  // Check if search term is a number (likely searching for project number)
                  const isNumericSearch = /^\d+$/.test(searchTerm);
                  
                  if (isNumericSearch) {
                    // For numeric searches, match project number
                    return project.project_number?.toString() === searchTerm;
                  } else {
                    // For text searches, use broader matching
                    const textFields = [
                      project.disease,
                      project.pi_name,
                      project.displayName
                    ];
                    
                    return textFields.some(field => 
                      field && field.toLowerCase().includes(searchLower)
                    );
                  }
                });
              }}
              sx={{ mb: 3 }}
              clearOnEscape
              selectOnFocus
              handleHomeEndKeys
            />

            {recentProjects.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Recent Projects
                </Typography>
                <List dense>
                  {recentProjects.map((project) => (
                    <ListItem
                      key={project.id}
                      button
                      onClick={() => handleProjectSelect(project.id)}
                      selected={selectedProject === project.id}
                    >
                      <ListItemIcon>
                        <TimelineIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={project.name}
                        secondary={new Date(project.lastAccessed).toLocaleDateString()}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Metadata Analytics */}
        <Grid item xs={12} md={8}>
          {!selectedProject ? (
            <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
              <AssessmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Select a project to view metadata analytics
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose a project to see comprehensive metadata analysis including field types,
                value distributions, data quality assessments, and statistical summaries.
              </Typography>
            </Paper>
          ) : (
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom display="flex" alignItems="center">
                <AssessmentIcon sx={{ mr: 1 }} />
                Metadata Analytics
              </Typography>
              
              <MetadataAnalytics 
                projectId={selectedProject} 
                project={getSelectedProjectData()}
              />
            </Paper>
          )}
        </Grid>
      </Grid>


      {/* Export Dialog */}
      {selectedProject && (
        <EnhancedExportDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          defaultFilters={{ projectId: selectedProject }}
          title={`Export Data - ${getSelectedProjectData()?.disease || 'Project'}`}
        />
      )}

      {/* Metadata Upload Dialog */}
      <MetadataUpload
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </Box>
  );
};

export default MetadataList;