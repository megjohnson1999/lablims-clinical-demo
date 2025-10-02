import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CloudUpload as UploadIcon,
  Save as SaveIcon,
  ImportExport as ImportIcon,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { specimenAPI, projectAPI, collaboratorAPI } from '../../services/api';
import { parseDelimitedData } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { formatProjectDisplay, sortProjects } from '../../utils/projectUtils';

const BulkImport = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [delimiter, setDelimiter] = useState('\t');
  const [specimens, setSpecimens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [newProject, setNewProject] = useState({
    collaborator_id: '',
    project_number: '',
    disease: '',
    specimen_type: '',
    source: '',
    comments: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch projects
        const projectResponse = await projectAPI.getAll();
        // Sort projects using the utility function
        const sortedProjects = sortProjects(projectResponse.data, {
          sortBy: 'number_then_disease',
          direction: 'asc'
        });
        setProjects(sortedProjects);

        // Fetch collaborators for project creation
        const collaboratorResponse = await collaboratorAPI.getAll();
        setCollaborators(collaboratorResponse.data);
      } catch (err) {
        console.error('Error fetching data', err);
        setError('Failed to load data');
      }
    };

    fetchData();
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContent(event.target.result);
    };
    reader.readAsText(selectedFile);
  };

  const handleProjectChange = (e) => {
    setSelectedProject(e.target.value);
  };

  const handleDelimiterChange = (e) => {
    setDelimiter(e.target.value);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!selectedProject) {
        setError('Please select a project');
        return;
      }
      if (!file) {
        setError('Please upload a file');
        return;
      }
      setError('');
    }
    
    if (activeStep === 1) {
      try {
        const parsedData = parseDelimitedData(fileContent, delimiter);
        if (parsedData.length === 0) {
          setError('No data found in the file. Please check that your file contains data rows below the header.');
          return;
        }
        setSpecimens(parsedData);
        setError('');
      } catch (err) {
        console.error('Error parsing file', err);
        setError(`Failed to parse file: ${err.message}. Please check the file format and delimiter selection.`);
        return;
      }
    }
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await specimenAPI.bulkImport({
        project_id: selectedProject,
        specimens
      });
      
      toast.success(`Successfully imported ${response.data.imported} specimens`);
      navigate('/specimens');
    } catch (err) {
      console.error('Error importing specimens', err);
      const errorMessage = err.response?.data?.msg || err.message;
      
      // Provide more specific error messages
      if (errorMessage.includes('duplicate')) {
        setError('Import failed: Duplicate specimen IDs found. Please check your data and remove duplicates.');
      } else if (errorMessage.includes('validation')) {
        setError('Import failed: Data validation errors. Please check your file format and required fields.');
      } else if (errorMessage.includes('project')) {
        setError('Import failed: Selected project not found. Please select a valid project.');
      } else {
        setError(`Import failed: ${errorMessage}. Please check your data and try again.`);
      }
      setLoading(false);
    }
  };

  const steps = ['Select Project & File', 'Preview & Configure', 'Review & Import'];


  const handleCreateProject = async () => {
    if (!newProject.collaborator_id || !newProject.project_number) {
      setError('Please fill in collaborator and project number');
      return;
    }

    setLoading(true);
    try {
      const response = await projectAPI.create(newProject);
      const createdProject = response.data;
      
      // Add the new project to the list and sort again
      const updatedProjects = sortProjects([...projects, createdProject], {
        sortBy: 'number_then_disease',
        direction: 'asc'
      });
      
      setProjects(updatedProjects);
      setSelectedProject(createdProject.id);
      setShowCreateProject(false);
      
      // Reset form
      setNewProject({
        collaborator_id: '',
        project_number: '',
        disease: '',
        specimen_type: '',
        source: '',
        comments: ''
      });
      
      toast.success('Project created successfully!');
    } catch (err) {
      console.error('Error creating project', err);
      setError('Failed to create project: ' + (err.response?.data?.msg || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleNewProjectChange = (e) => {
    const { name, value } = e.target;
    setNewProject(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <Box className="bulk-import page-container">
      <Box display="flex" alignItems="center" justify="space-between" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton
            component={Link}
            to="/specimens"
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Standard Import - Add Specimens to Project
          </Typography>
        </Box>
        <Button
          component={Link}
          to="/specimens/comprehensive-import"
          variant="outlined"
          startIcon={<ImportIcon />}
          sx={{ ml: 2 }}
        >
          Advanced Import
        </Button>
      </Box>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Standard Import:</strong> Import specimens into an existing project using CSV or tab-delimited files.
          <br />
          <strong>Use this when:</strong> You have specimen data to add to a specific project you've already created.
          <br />
          <strong>For advanced users:</strong> Use{' '}
          <Button 
            component={Link} 
            to="/specimens/comprehensive-import" 
            variant="text" 
            size="small"
          >
            Comprehensive Import
          </Button>
          {' '}to create collaborators, projects, and specimens all in one step.
        </Typography>
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Project and Upload File
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Choose a project for the specimens and upload your data file.
              <br />
              <strong>Any format works:</strong> CSV, TSV, Excel, or text files - the system will adapt to your data structure.
            </Typography>
            
            <Box sx={{ maxWidth: 500, mb: 3 }}>
              <TextField
                select
                fullWidth
                label="Project *"
                value={selectedProject}
                onChange={handleProjectChange}
                required
                margin="normal"
                helperText="All imported specimens will be associated with this project"
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {formatProjectDisplay(project, {
                      includeNumber: true,
                      includeDisease: true,
                      includePI: true,
                      includeInstitute: false,
                      includeSpecimenType: false,
                      separator: ' - ',
                      compact: false
                    })}
                  </MenuItem>
                ))}
              </TextField>
              
              <Box sx={{ display: 'flex', gap: 2, mt: 2, mb: 2 }}>
                <Button
                  variant="text"
                  onClick={() => setShowCreateProject(true)}
                  size="small"
                >
                  Create New Project
                </Button>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadIcon />}
                >
                  Upload File
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt,.xlsx,.xls"
                    hidden
                    onChange={handleFileChange}
                  />
                </Button>
              </Box>
              
              {file && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  File: {file.name}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Preview Data
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Review your data structure and select the correct delimiter if needed.
            </Typography>
            
            <Box sx={{ maxWidth: 400, mb: 3 }}>
              <TextField
                select
                fullWidth
                label="Delimiter"
                value={delimiter}
                onChange={handleDelimiterChange}
                margin="normal"
              >
                <MenuItem value="\t">Tab</MenuItem>
                <MenuItem value=",">Comma</MenuItem>
                <MenuItem value=";">Semicolon</MenuItem>
              </TextField>
            </Box>
            
            <Box sx={{ mb: 3, overflow: 'auto' }}>
              <pre style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                {fileContent.split('\n').slice(0, 10).join('\n')}
                {fileContent.split('\n').length > 10 && '\n...'}
              </pre>
            </Box>
          </Box>
        )}

        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review and Import
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Review your data as it will be imported into the selected project.
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {specimens.length > 0 && 
                        Object.keys(specimens[0]).map((header) => (
                          <TableCell key={header}>{header}</TableCell>
                        ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {specimens.slice(0, 100).map((specimen, index) => (
                      <TableRow key={index}>
                        {Object.values(specimen).map((value, i) => (
                          <TableCell key={i}>{value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {specimens.length > 100 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Showing first 100 of {specimens.length} specimens
                </Typography>
              )}
            </Box>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Import your data as-is:</strong> Upload your CSV file in whatever format you have.
                <br />
                The system will work with your existing column names and data structure.
                <br />
                You'll see a preview of your data before importing to verify everything looks correct.
              </Typography>
            </Alert>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            Back
          </Button>
          <Box>
            <Button
              component={Link}
              to="/specimens"
              variant="outlined"
              sx={{ mr: 1 }}
            >
              Cancel
            </Button>
            
            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleImport}
                disabled={loading || specimens.length === 0}
              >
                {loading ? <CircularProgress size={24} /> : 'Import Specimens'}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Create Project Modal */}
      <Dialog open={showCreateProject} onClose={() => setShowCreateProject(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Collaborator *"
                name="collaborator_id"
                value={newProject.collaborator_id}
                onChange={handleNewProjectChange}
                required
              >
                {collaborators.map((collaborator) => (
                  <MenuItem key={collaborator.id} value={collaborator.id}>
                    {collaborator.pi_name}, {collaborator.pi_institute}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Project Number *"
                name="project_number"
                value={newProject.project_number}
                onChange={handleNewProjectChange}
                required
                helperText="Enter the lab-specific project identifier (e.g., 849, 850)"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Disease/Condition"
                name="disease"
                value={newProject.disease}
                onChange={handleNewProjectChange}
                helperText="Enter the disease or condition being studied"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Specimen Type"
                name="specimen_type"
                value={newProject.specimen_type}
                onChange={handleNewProjectChange}
                helperText="Enter the type of specimens in this project"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Source"
                name="source"
                value={newProject.source}
                onChange={handleNewProjectChange}
                helperText="Enter the source of the specimens"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Comments"
                name="comments"
                value={newProject.comments}
                onChange={handleNewProjectChange}
                multiline
                rows={3}
                helperText="Enter any additional information about this project"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateProject(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateProject} 
            variant="contained" 
            disabled={loading || !newProject.collaborator_id || !newProject.project_number}
          >
            {loading ? <CircularProgress size={20} /> : 'Create Project'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BulkImport;