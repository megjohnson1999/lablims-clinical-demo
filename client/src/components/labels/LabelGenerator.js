import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Tabs,
  Tab,
  Divider,
  Grid,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Autocomplete,
} from '@mui/material';
import {
  Print as PrintIcon,
  Search as SearchIcon,
  GetApp as DownloadIcon,
} from '@mui/icons-material';
import { specimenAPI, projectAPI, labelAPI } from '../../services/api';
import { getLocationString, formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import PrintableLabel from './PrintableLabel';
import Barcode from '../common/Barcode';

const LabelGenerator = () => {
  const [tabValue, setTabValue] = useState(0);
  const [specimens, setSpecimens] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedSpecimens, setSelectedSpecimens] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [labelFile, setLabelFile] = useState(null);
  const [showLabelContent, setShowLabelContent] = useState(false);
  const [labelSize, setLabelSize] = useState('standard');
  const [showBarcodePreview, setShowBarcodePreview] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectAPI.getAll('?limit=1000'); // Get all projects
        console.log('Projects API response:', response.data);
        // API returns {projects: [...], pagination: {...}}
        const projects = Array.isArray(response.data?.projects) ? response.data.projects : [];
        console.log('Project 849 found:', projects.find(p => p.project_number == 849));
        console.log('Projects with "maureen" in pi_name:', projects.filter(p => p.pi_name?.toLowerCase().includes('maureen')));
        setProjects(projects);
      } catch (err) {
        console.error('Error fetching projects', err);
        setError('Failed to load projects');
        setProjects([]); // Ensure projects is always an array
      }
    };

    fetchProjects();
  }, []);

  const handleChangeTab = (event, newValue) => {
    console.log('Tab changed from', tabValue, 'to', newValue);
    console.log('Clearing labelFile due to tab change');
    setTabValue(newValue);
    // Reset selections when changing tabs
    setSelectedSpecimens([]);
    setSelectedProject('');
    setSearchTerm('');
    setSpecimens([]);
    setLabelFile(null);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm) return;
    
    setLoading(true);
    try {
      const response = await specimenAPI.search(searchTerm, searchField);
      setSpecimens(response.data);
      setError('');
    } catch (err) {
      console.error('Error searching specimens', err);
      setError('Failed to search specimens');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSpecimen = (id) => {
    setSelectedSpecimens((prev) => {
      if (prev.includes(id)) {
        return prev.filter((specId) => specId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedSpecimens.length === specimens.length) {
      setSelectedSpecimens([]);
    } else {
      setSelectedSpecimens(specimens.map((s) => s.id));
    }
  };


  const generateLabelsForSpecimens = async () => {
    if (selectedSpecimens.length === 0) {
      toast.error('Please select at least one specimen');
      return;
    }

    setLoading(true);
    try {
      const response = await labelAPI.generateLabels(selectedSpecimens);
      console.log('Label generation response:', response.data);

      // Immediately download the file
      if (response.data && response.data.filename) {
        const downloadResponse = await labelAPI.downloadLabel(response.data.filename);

        // Create a blob from the response data
        const blob = new Blob([downloadResponse.data], { type: 'text/plain' });

        // Create a temporary URL for the blob
        const url = window.URL.createObjectURL(blob);

        // Create a temporary anchor element
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.filename;

        // Append the anchor to the body, click it, then remove it
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Revoke the blob URL
        window.URL.revokeObjectURL(url);

        toast.success(`Labels downloaded: ${response.data.filename}`);
      } else {
        toast.error('No file generated');
      }
    } catch (err) {
      console.error('Error generating labels', err);
      setError('Failed to generate labels');
      toast.error('Failed to generate labels');
    } finally {
      setLoading(false);
    }
  };

  const generateLabelsForProject = async () => {
    if (!selectedProject) {
      toast.error('Please select a project');
      return;
    }

    setLoading(true);
    try {
      const response = await labelAPI.generateProjectLabels(selectedProject);
      setLabelFile(response.data);
      toast.success(`Labels generated for project`);
      setShowLabelContent(true);
    } catch (err) {
      console.error('Error generating project labels', err);
      setError('Failed to generate labels for project');
    } finally {
      setLoading(false);
    }
  };

  const downloadLabelFile = async () => {
    if (!labelFile) return;
    
    try {
      const response = await labelAPI.downloadLabel(labelFile.filename);
      
      // Create a blob from the response data
      const blob = new Blob([response.data], { type: 'text/plain' });
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = labelFile.filename;
      
      // Append the anchor to the body
      document.body.appendChild(a);
      
      // Trigger a click on the anchor
      a.click();
      
      // Remove the anchor from the body
      document.body.removeChild(a);
      
      // Revoke the blob URL
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading label file', err);
      toast.error('Failed to download label file');
    }
  };

  const generatePDFLabels = async () => {
    if (selectedSpecimens.length === 0) {
      toast.error('Please select at least one specimen');
      return;
    }

    setLoading(true);
    try {
      const response = await labelAPI.generatePDF(selectedSpecimens);
      
      // Download the PDF immediately
      const downloadResponse = await labelAPI.downloadPDF(response.data.filename);
      
      // Create a blob from the response data
      const blob = new Blob([downloadResponse.data], { type: 'application/pdf' });
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element
      const a = document.createElement('a');
      a.href = url;
      a.download = response.data.filename;
      
      // Append the anchor to the body
      document.body.appendChild(a);
      
      // Trigger a click on the anchor
      a.click();
      
      // Remove the anchor from the body
      document.body.removeChild(a);
      
      // Revoke the blob URL
      window.URL.revokeObjectURL(url);
      
      toast.success(`PDF labels downloaded for ${selectedSpecimens.length} specimens`);
    } catch (err) {
      console.error('Error generating PDF labels', err);
      setError('Failed to generate PDF labels');
      toast.error('Failed to generate PDF labels');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseLabelContent = () => {
    setShowLabelContent(false);
  };

  console.log('Render - labelFile:', labelFile);
  console.log('Render - showLabelContent:', showLabelContent);

  return (
    <Box className="label-generator page-container">
      <Typography variant="h4" component="h1" gutterBottom>
        Label Generator
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleChangeTab}
          indicatorColor="primary"
          textColor="primary"
          centered
        >
          <Tab label="Search Specimens" />
          <Tab label="By Project" />
          <Tab label="Barcode Preview" />
        </Tabs>
        <Divider />

        <Box p={3}>
          {tabValue === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <form onSubmit={handleSearch} className="search-container">
                  <TextField
                    label="Search Specimens"
                    variant="outlined"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{ flexGrow: 1, mr: 2 }}
                    size="small"
                  />
                  <TextField
                    select
                    label="Field"
                    value={searchField}
                    onChange={(e) => setSearchField(e.target.value)}
                    sx={{ width: 200, mr: 2 }}
                    size="small"
                  >
                    <MenuItem value="">All Fields</MenuItem>
                    <MenuItem value="tube_id">Tube ID</MenuItem>
                    <MenuItem value="position_freezer">Freezer</MenuItem>
                    <MenuItem value="position_rack">Rack</MenuItem>
                    <MenuItem value="position_box">Box</MenuItem>
                    <MenuItem value="project">Project ID</MenuItem>
                    <MenuItem value="patient">Patient</MenuItem>
                    <MenuItem value="collaborator">Collaborator</MenuItem>
                    <MenuItem value="disease">Disease</MenuItem>
                    <MenuItem value="specimen_type">Specimen Type</MenuItem>
                  </TextField>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    startIcon={<SearchIcon />}
                  >
                    Search
                  </Button>
                </form>
              </Grid>
            </Grid>
          )}

          {tabValue === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  fullWidth
                  options={Array.isArray(projects) ? projects : []}
                  getOptionLabel={(project) => `#${project.project_number} - ${project.disease || 'Unnamed Project'} (${project.pi_name})`}
                  value={Array.isArray(projects) ? projects.find(p => p.id === selectedProject) || null : null}
                  onChange={async (event, newValue) => {
                    const projectId = newValue ? newValue.id : '';
                    setSelectedProject(projectId);
                    
                    if (projectId) {
                      setLoading(true);
                      try {
                        const response = await projectAPI.getSpecimens(projectId);
                        setSpecimens(response.data);
                        setError('');
                      } catch (err) {
                        console.error('Error fetching project specimens', err);
                        setError('Failed to load specimens for this project');
                        setSpecimens([]);
                      } finally {
                        setLoading(false);
                      }
                    } else {
                      setSpecimens([]);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Project"
                      helperText="Type project number, disease, or PI name to search"
                      placeholder="Search projects..."
                    />
                  )}
                  filterOptions={(options, { inputValue }) => {
                    if (!inputValue || inputValue.trim() === '') {
                      return options.slice(0, 100); // Show first 100 if no search
                    }
                    
                    const filterValue = inputValue.toLowerCase().trim();
                    return options.filter(project => {
                      const projectNumber = project.project_number?.toString() || '';
                      const disease = project.disease?.toLowerCase() || '';
                      const piName = project.pi_name?.toLowerCase() || '';
                      
                      return projectNumber.includes(filterValue) ||
                             disease.includes(filterValue) ||
                             piName.includes(filterValue);
                    });
                  }}
                  noOptionsText="No projects found"
                />
              </Grid>
              <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PrintIcon />}
                  onClick={generateLabelsForProject}
                  disabled={!selectedProject || loading}
                  sx={{ mt: 1 }}
                >
                  Generate Project Labels
                </Button>
              </Grid>
            </Grid>
          )}
          {tabValue === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Barcode Preview & Label Options
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Select specimens from the other tabs to preview barcodes and printable labels.
                </Typography>
              </Grid>
              
              {selectedSpecimens.length > 0 && (
                <>
                  <Grid item xs={12} md={4}>
                    <TextField
                      select
                      fullWidth
                      label="Label Size"
                      value={labelSize}
                      onChange={(e) => setLabelSize(e.target.value)}
                    >
                      <MenuItem value="small">Small (2.5" x 1")</MenuItem>
                      <MenuItem value="standard">Standard (4" x 2")</MenuItem>
                      <MenuItem value="large">Large (4" x 3")</MenuItem>
                    </TextField>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<PrintIcon />}
                      onClick={() => {
                        const selectedSpecimenData = specimens.filter(s => selectedSpecimens.includes(s.id));
                        if (selectedSpecimenData.length > 0) {
                          // Open print preview
                          toast.info('Print preview will open in new window');
                        }
                      }}
                      disabled={selectedSpecimens.length === 0}
                      fullWidth
                    >
                      Print Labels
                    </Button>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={generatePDFLabels}
                      disabled={selectedSpecimens.length === 0 || loading}
                      fullWidth
                    >
                      Download PDF
                    </Button>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                      Label Previews ({selectedSpecimens.length} selected)
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
                      {specimens
                        .filter(specimen => selectedSpecimens.includes(specimen.id))
                        .slice(0, 6) // Show max 6 previews to avoid performance issues
                        .map(specimen => (
                          <PrintableLabel
                            key={specimen.id}
                            specimen={specimen}
                            labelSize={labelSize}
                            showDetails={labelSize !== 'small'}
                          />
                        ))}
                      {selectedSpecimens.length > 6 && (
                        <Box 
                          sx={{ 
                            width: '4in', 
                            height: '2in', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: '1px dashed #ccc',
                            backgroundColor: '#f9f9f9'
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            +{selectedSpecimens.length - 6} more labels
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Grid>
                </>
              )}
              
              {selectedSpecimens.length === 0 && (
                <Grid item xs={12}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      justifyContent: 'center',
                      minHeight: 200,
                      border: '1px dashed #ccc',
                      borderRadius: 1,
                      backgroundColor: '#f9f9f9'
                    }}
                  >
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No Specimens Selected
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Use the "Search Specimens" or "By Project" tabs to select specimens for barcode generation.
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          )}
        </Box>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : specimens.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" component="h2">
              Selected Specimens: {selectedSpecimens.length} of {specimens.length}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PrintIcon />}
              onClick={generateLabelsForSpecimens}
              disabled={selectedSpecimens.length === 0 || loading}
            >
              Generate Labels
            </Button>
          </Box>

          <TableContainer sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={
                        specimens.length > 0 &&
                        selectedSpecimens.length === specimens.length
                      }
                      onChange={handleSelectAll}
                    />
                  </TableCell>
                  <TableCell>Tube ID</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Date Collected</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {specimens.map((specimen) => (
                  <TableRow
                    key={specimen.id}
                    hover
                    selected={selectedSpecimens.includes(specimen.id)}
                    onClick={() => handleSelectSpecimen(specimen.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedSpecimens.includes(specimen.id)}
                        onChange={() => handleSelectSpecimen(specimen.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>{specimen.tube_id || specimen.id.substring(0, 8)}</TableCell>
                    <TableCell>
                      {specimen.patient_external_id
                        ? `${specimen.patient_external_id} ${
                            specimen.patient_name ? `(${specimen.patient_name})` : ''
                          }`
                        : '—'}
                    </TableCell>
                    <TableCell>{getLocationString(specimen) || '—'}</TableCell>
                    <TableCell>{specimen.specimen_type || '—'}</TableCell>
                    <TableCell>{formatDate(specimen.date_collected) || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {labelFile && (
        <Snackbar
          open={showLabelContent}
          autoHideDuration={10000}
          onClose={handleCloseLabelContent}
          message={`Labels generated: ${labelFile.filename}`}
          action={
            <Button
              color="primary"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={downloadLabelFile}
            >
              Download
            </Button>
          }
        />
      )}

      {labelFile && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" component="h2">
              Generated Label File
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<DownloadIcon />}
              onClick={downloadLabelFile}
            >
              Download Labels
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Filename: {labelFile.filename}
          </Typography>
          <Box
            component="pre"
            sx={{
              mt: 2,
              p: 2,
              bgcolor: '#f5f5f5',
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 300,
              fontSize: '0.875rem',
              fontFamily: 'monospace',
            }}
          >
            {labelFile.content}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default LabelGenerator;