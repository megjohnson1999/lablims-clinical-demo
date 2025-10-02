import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Chip,
  LinearProgress,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Preview as PreviewIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandLess,
  ExpandMore
} from '@mui/icons-material';
import {
  DatePicker,
} from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { exportAPI, collaboratorAPI, projectAPI } from '../../services/api';
import { toast } from 'react-toastify';

// Column configuration for export - updated with auto-generated ID columns
const COLUMN_GROUPS = {
  identification: {
    label: 'ID & Identification',
    description: 'Auto-generated IDs and unique identifiers',
    priority: 'high',
    columns: [
      { key: 'specimen_number', label: 'Specimen ID (Auto)', required: true },
      { key: 'tube_id', label: 'Tube ID', required: true },
      { key: 'project_id_number', label: 'Project ID (Auto)', required: false },
      { key: 'collaborator_number', label: 'Collaborator ID (Auto)', required: false },
      { key: 'patient_external_id', label: 'Patient ID', required: false }
    ]
  },
  sample: {
    label: 'Sample Information',
    description: 'Basic specimen data and status',
    priority: 'high',
    columns: [
      { key: 'date_collected', label: 'Date Collected', required: false },
      { key: 'activity_status', label: 'Activity Status', required: false },
      { key: 'specimen_site', label: 'Specimen Site', required: false },
      { key: 'extracted', label: 'Extracted', required: false },
      { key: 'used_up', label: 'Used Up', required: false },
      { key: 'initial_quantity', label: 'Initial Quantity', required: false },
      { key: 'specimen_comments', label: 'Specimen Comments', required: false }
    ]
  },
  storage: {
    label: 'Storage & Location',
    description: 'Physical storage location details',
    priority: 'medium',
    columns: [
      { key: 'position_freezer', label: 'Freezer', required: false },
      { key: 'position_rack', label: 'Rack', required: false },
      { key: 'position_box', label: 'Box', required: false },
      { key: 'position_dimension_one', label: 'Position 1', required: false },
      { key: 'position_dimension_two', label: 'Position 2', required: false },
      { key: 'location', label: 'Location (Combined)', required: false }
    ]
  },
  sequencing: {
    label: 'Sequencing & Analysis',
    description: 'Sequencing run and analysis information',
    priority: 'medium',
    columns: [
      { key: 'sequencing_run_id', label: 'Sequencing Run ID', required: false },
      { key: 'fastq_location', label: 'FASTQ Location', required: false },
      { key: 'analysis_status', label: 'Analysis Status', required: false },
      { key: 'results_location', label: 'Results Location', required: false },
      { key: 'sequencing_notes', label: 'Sequencing Notes', required: false }
    ]
  },
  patient: {
    label: 'Patient Information',
    description: 'Patient demographics and clinical data',
    priority: 'low',
    columns: [
      { key: 'patient_first_name', label: 'Patient First Name', required: false },
      { key: 'patient_last_name', label: 'Patient Last Name', required: false },
      { key: 'patient_name', label: 'Patient Name (Combined)', required: false },
      { key: 'date_of_birth', label: 'Date of Birth', required: false },
      { key: 'diagnosis', label: 'Diagnosis', required: false }
    ]
  },
  project: {
    label: 'Project Information',
    description: 'Research project and study details',
    priority: 'medium',
    columns: [
      { key: 'project_number', label: 'Project Number', required: false },
      { key: 'disease', label: 'Disease', required: false },
      { key: 'specimen_type', label: 'Specimen Type', required: false },
      { key: 'project_source', label: 'Project Source', required: false },
      { key: 'date_received', label: 'Date Received', required: false },
      { key: 'feedback_date', label: 'Feedback Date', required: false },
      { key: 'project_comments', label: 'Project Comments', required: false }
    ]
  },
  collaborator: {
    label: 'Collaborator Information',
    description: 'PI and institution details',
    priority: 'medium',
    columns: [
      { key: 'pi_name', label: 'PI Name', required: false },
      { key: 'pi_institute', label: 'PI Institute', required: false },
      { key: 'pi_email', label: 'PI Email', required: false },
      { key: 'pi_phone', label: 'PI Phone', required: false },
      { key: 'irb_id', label: 'IRB ID', required: false },
      { key: 'internal_contact', label: 'Internal Contact', required: false }
    ]
  }
};

// Export steps
const EXPORT_STEPS = [
  'Validating parameters',
  'Querying database',
  'Processing data', 
  'Generating file',
  'Preparing download'
];

// Get default selected columns (focus on auto-generated IDs and key fields)
const getDefaultSelectedColumns = () => {
  return [
    'specimen_number', 'tube_id', 'project_id_number', 'collaborator_number',
    'pi_name', 'pi_institute', 'disease', 'specimen_type',
    'patient_external_id', 'patient_name', 'date_collected', 'location',
    'activity_status', 'extracted', 'used_up', 'sequencing_run_id', 'analysis_status'
  ];
};

// Get all available columns
const getAllColumns = () => {
  return Object.values(COLUMN_GROUPS).flatMap(group => group.columns.map(col => col.key));
};

const EnhancedExportDialog = ({ open, onClose, initialFilters = {} }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('idle'); // idle, running, success, error
  const [exportError, setExportError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  
  const [filters, setFilters] = useState({
    searchTerm: '',
    searchField: '',
    dateStart: null,
    dateEnd: null,
    collaboratorId: '',
    projectId: '',
    disease: '',
    specimenType: '',
    limit: 10000,
    format: 'csv',
    ...initialFilters
  });
  
  const [collaborators, setCollaborators] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedColumns, setSelectedColumns] = useState(() => {
    const saved = localStorage.getItem('export_column_preferences');
    return saved ? JSON.parse(saved) : getDefaultSelectedColumns();
  });
  
  const [warnings, setWarnings] = useState([]);
  const [validationResults, setValidationResults] = useState(null);

  useEffect(() => {
    if (open) {
      fetchCollaborators();
      fetchProjects();
      resetExportState();
    }
  }, [open]);

  useEffect(() => {
    localStorage.setItem('export_column_preferences', JSON.stringify(selectedColumns));
  }, [selectedColumns]);

  // Auto-estimate record count when filters change
  useEffect(() => {
    if (open) {
      const timeoutId = setTimeout(() => {
        estimateRecordCount();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [filters, open]);

  const resetExportState = () => {
    setActiveStep(0);
    setExportProgress(0);
    setExportStatus('idle');
    setExportError('');
    setPreviewData(null);
    setShowPreview(false);
    setWarnings([]);
    setValidationResults(null);
  };

  const fetchCollaborators = async () => {
    try {
      const response = await collaboratorAPI.getAll();
      setCollaborators(response.data);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
      setWarnings(prev => [...prev, 'Failed to load collaborators list']);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getAll();
      setProjects(response.data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setWarnings(prev => [...prev, 'Failed to load projects list']);
    }
  };

  const estimateRecordCount = async () => {
    setLoadingEstimate(true);
    try {
      const response = await exportAPI.getExportCount(filters);
      setEstimatedCount(response.data.count);
      
      // Add warnings based on count
      const newWarnings = [];
      if (response.data.count === 0) {
        newWarnings.push('No records match the current filters');
      } else if (response.data.count > 5000) {
        newWarnings.push(`Large export (${response.data.count} records) - may take several minutes`);
      }
      setWarnings(newWarnings);
      
    } catch (err) {
      console.error('Error estimating count:', err);
      setEstimatedCount(null);
    } finally {
      setLoadingEstimate(false);
    }
  };

  const validateExportParameters = () => {
    const issues = [];
    const warnings = [];
    
    // Check required parameters
    if (selectedColumns.length === 0) {
      issues.push('At least one column must be selected');
    }
    
    if (filters.limit < 1 || filters.limit > 10000) {
      issues.push('Record limit must be between 1 and 10,000');
    }
    
    // Check for potential issues
    if (selectedColumns.includes('patient_first_name') || selectedColumns.includes('patient_last_name')) {
      warnings.push('Export includes patient names - ensure compliance with privacy policies');
    }
    
    if (estimatedCount && estimatedCount > filters.limit) {
      warnings.push(`Results will be limited to ${filters.limit} records (${estimatedCount} available)`);
    }
    
    const requiredColumns = Object.values(COLUMN_GROUPS)
      .flatMap(group => group.columns)
      .filter(col => col.required)
      .map(col => col.key);
    
    const missingRequired = requiredColumns.filter(col => !selectedColumns.includes(col));
    if (missingRequired.length > 0) {
      warnings.push(`Consider including required columns: ${missingRequired.join(', ')}`);
    }
    
    return { issues, warnings };
  };

  const handlePreview = async () => {
    setLoading(true);
    setError('');
    
    try {
      const validation = validateExportParameters();
      if (validation.issues.length > 0) {
        setError(validation.issues.join('; '));
        setLoading(false);
        return;
      }
      
      setValidationResults(validation);
      
      // Get preview data (first 10 records)
      const previewFilters = {
        ...filters,
        dateStart: filters.dateStart ? filters.dateStart.toISOString().split('T')[0] : null,
        dateEnd: filters.dateEnd ? filters.dateEnd.toISOString().split('T')[0] : null,
        selectedColumns: selectedColumns.join(','),
        limit: 10
      };
      
      const response = await exportAPI.getExportPreview(previewFilters);
      setPreviewData(response.data);
      setShowPreview(true);
      
    } catch (err) {
      console.error('Preview error:', err);
      setError('Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const simulateExportProgress = useCallback((onComplete) => {
    let progress = 0;
    let step = 0;
    
    const updateProgress = () => {
      progress += Math.random() * 20 + 5;
      
      if (progress >= 100) {
        setExportProgress(100);
        setActiveStep(EXPORT_STEPS.length - 1);
        onComplete();
        return;
      }
      
      // Update step based on progress
      const newStep = Math.min(
        Math.floor((progress / 100) * EXPORT_STEPS.length),
        EXPORT_STEPS.length - 1
      );
      
      if (newStep > step) {
        step = newStep;
        setActiveStep(step);
      }
      
      setExportProgress(progress);
      setTimeout(updateProgress, Math.random() * 500 + 200);
    };
    
    updateProgress();
  }, []);

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setExportStatus('running');
    setExportProgress(0);
    setActiveStep(0);

    const validation = validateExportParameters();
    if (validation.issues.length > 0) {
      setError(validation.issues.join('; '));
      setExportStatus('error');
      setLoading(false);
      return;
    }

    try {
      // Start progress simulation
      simulateExportProgress(() => {
        setExportStatus('success');
      });
      
      const exportFilters = {
        ...filters,
        dateStart: filters.dateStart ? filters.dateStart.toISOString().split('T')[0] : null,
        dateEnd: filters.dateEnd ? filters.dateEnd.toISOString().split('T')[0] : null,
        selectedColumns: selectedColumns.join(','),
      };

      const response = filters.format === 'excel' 
        ? await exportAPI.exportSpecimensExcel(exportFilters)
        : await exportAPI.exportSpecimensCSV(exportFilters);
      
      // Create download
      const mimeType = filters.format === 'excel' 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv';
      const fileExtension = filters.format === 'excel' ? 'xlsx' : 'csv';
      
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `specimens_export_${timestamp}.${fileExtension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${filters.format.toUpperCase()} export completed successfully! ${estimatedCount ? `${estimatedCount} records` : ''}`);
      
      // Auto-close after successful export
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error('Export error:', err);
      setExportStatus('error');
      setExportError(err.response?.data?.message || err.message || 'Export failed');
      toast.error('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleColumnChange = (columnKey, checked) => {
    setSelectedColumns(prev => {
      if (checked) {
        return [...prev, columnKey];
      } else {
        return prev.filter(col => col !== columnKey);
      }
    });
  };

  const handleGroupToggle = (groupKey, checked) => {
    const groupColumns = COLUMN_GROUPS[groupKey].columns.map(col => col.key);
    setSelectedColumns(prev => {
      if (checked) {
        const newColumns = groupColumns.filter(col => !prev.includes(col));
        return [...prev, ...newColumns];
      } else {
        return prev.filter(col => !groupColumns.includes(col));
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedColumns(getAllColumns());
  };

  const handleDeselectAll = () => {
    setSelectedColumns([]);
  };

  const handleSelectByPriority = (priority) => {
    const priorityColumns = Object.values(COLUMN_GROUPS)
      .filter(group => group.priority === priority)
      .flatMap(group => group.columns.map(col => col.key));
    
    setSelectedColumns(prev => {
      const newColumns = priorityColumns.filter(col => !prev.includes(col));
      return [...prev, ...newColumns];
    });
  };

  const isGroupSelected = (groupKey) => {
    const groupColumns = COLUMN_GROUPS[groupKey].columns.map(col => col.key);
    return groupColumns.every(col => selectedColumns.includes(col));
  };

  const isGroupPartiallySelected = (groupKey) => {
    const groupColumns = COLUMN_GROUPS[groupKey].columns.map(col => col.key);
    const selectedInGroup = groupColumns.filter(col => selectedColumns.includes(col));
    return selectedInGroup.length > 0 && selectedInGroup.length < groupColumns.length;
  };

  const handleReset = () => {
    setFilters({
      searchTerm: '',
      searchField: '',
      dateStart: null,
      dateEnd: null,
      collaboratorId: '',
      projectId: '',
      disease: '',
      specimenType: '',
      limit: 10000,
      format: 'csv'
    });
    setSelectedColumns(getDefaultSelectedColumns());
    resetExportState();
  };

  const renderProgressSection = () => {
    if (exportStatus === 'idle') return null;
    
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {exportStatus === 'running' && <CircularProgress size={20} sx={{ mr: 1 }} />}
          {exportStatus === 'success' && <CheckCircleIcon color="success" sx={{ mr: 1 }} />}
          {exportStatus === 'error' && <ErrorIcon color="error" sx={{ mr: 1 }} />}
          
          <Typography variant="subtitle2">
            {exportStatus === 'running' && 'Export in progress...'}
            {exportStatus === 'success' && 'Export completed successfully!'}
            {exportStatus === 'error' && 'Export failed'}
          </Typography>
        </Box>
        
        {exportStatus === 'running' && (
          <>
            <LinearProgress 
              variant="determinate" 
              value={exportProgress} 
              sx={{ mb: 1 }}
            />
            <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 1 }}>
              {EXPORT_STEPS.map((step, index) => (
                <Step key={step}>
                  <StepLabel>{step}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </>
        )}
        
        {exportStatus === 'error' && exportError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {exportError}
          </Alert>
        )}
      </Paper>
    );
  };

  const renderPreviewSection = () => {
    if (!showPreview || !previewData) return null;
    
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Export Preview</Typography>
          <Button size="small" onClick={() => setShowPreview(false)}>
            Hide Preview
          </Button>
        </Box>
        
        {validationResults?.warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Warnings:</Typography>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {validationResults.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </Alert>
        )}
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Showing first {Math.min(10, previewData.length)} of {estimatedCount || 'unknown'} records
        </Typography>
        
        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {selectedColumns.slice(0, 8).map(col => (
                  <th key={col} style={{ border: '1px solid #ddd', padding: '4px', background: '#f5f5f5' }}>
                    {COLUMN_GROUPS[Object.keys(COLUMN_GROUPS).find(g => 
                      COLUMN_GROUPS[g].columns.some(c => c.key === col)
                    )]?.columns.find(c => c.key === col)?.label || col}
                  </th>
                ))}
                {selectedColumns.length > 8 && (
                  <th style={{ border: '1px solid #ddd', padding: '4px', background: '#f5f5f5' }}>
                    +{selectedColumns.length - 8} more...
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {previewData.slice(0, 5).map((row, index) => (
                <tr key={index}>
                  {selectedColumns.slice(0, 8).map(col => (
                    <td key={col} style={{ border: '1px solid #ddd', padding: '4px' }}>
                      {row[col] || '—'}
                    </td>
                  ))}
                  {selectedColumns.length > 8 && (
                    <td style={{ border: '1px solid #ddd', padding: '4px', color: '#666' }}>
                      ...
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Paper>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Enhanced Export - Specimens Data
        <Typography variant="body2" color="text.secondary">
          Export with auto-generated IDs and enhanced progress tracking
        </Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <List dense>
              {warnings.map((warning, index) => (
                <ListItem key={index} sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <WarningIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={warning} />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}
        
        {renderProgressSection()}
        {renderPreviewSection()}
        
        <Grid container spacing={2}>
          {/* Search Filters */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Search Filters
              {loadingEstimate && <CircularProgress size={16} sx={{ ml: 1 }} />}
              {estimatedCount !== null && (
                <Chip 
                  label={`~${estimatedCount.toLocaleString()} records`}
                  size="small" 
                  color={estimatedCount === 0 ? 'error' : estimatedCount > 5000 ? 'warning' : 'success'}
                  sx={{ ml: 1 }}
                />
              )}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Search Term"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              placeholder="Search across all fields..."
              size="small"
              InputProps={{
                endAdornment: loadingEstimate && <CircularProgress size={20} />
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Search Field</InputLabel>
              <Select
                value={filters.searchField}
                label="Search Field"
                onChange={(e) => handleFilterChange('searchField', e.target.value)}
              >
                <MenuItem value="">All Fields</MenuItem>
                <MenuItem value="tube_id">Tube ID</MenuItem>
                <MenuItem value="specimen_number">Specimen ID</MenuItem>
                <MenuItem value="position_freezer">Freezer</MenuItem>
                <MenuItem value="position_rack">Rack</MenuItem>
                <MenuItem value="position_box">Box</MenuItem>
                <MenuItem value="project">Project ID</MenuItem>
                <MenuItem value="patient">Patient</MenuItem>
                <MenuItem value="collaborator">Collaborator</MenuItem>
                <MenuItem value="disease">Disease</MenuItem>
                <MenuItem value="specimen_type">Specimen Type</MenuItem>
                <MenuItem value="sequencing_run_id">Sequencing Run ID</MenuItem>
                <MenuItem value="analysis_status">Analysis Status</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Date Range */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Date Range
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date Start"
                value={filters.dateStart}
                onChange={(date) => handleFilterChange('dateStart', date)}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              />
            </LocalizationProvider>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date End"
                value={filters.dateEnd}
                onChange={(date) => handleFilterChange('dateEnd', date)}
                renderInput={(params) => <TextField {...params} fullWidth size="small" />}
              />
            </LocalizationProvider>
          </Grid>

          {/* Entity Filters */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Entity Filters
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Collaborator</InputLabel>
              <Select
                value={filters.collaboratorId}
                label="Collaborator"
                onChange={(e) => handleFilterChange('collaboratorId', e.target.value)}
              >
                <MenuItem value="">All Collaborators</MenuItem>
                {collaborators.map((collaborator) => (
                  <MenuItem key={collaborator.id} value={collaborator.id}>
                    {collaborator.collaborator_number ? `[${collaborator.collaborator_number}] ` : ''}
                    {collaborator.pi_name} - {collaborator.pi_institute}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Project</InputLabel>
              <Select
                value={filters.projectId}
                label="Project"
                onChange={(e) => handleFilterChange('projectId', e.target.value)}
              >
                <MenuItem value="">All Projects</MenuItem>
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.project_id ? `[${project.project_id}] ` : ''}
                    {project.disease || 'Unnamed Project'} - {project.pi_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Disease"
              value={filters.disease}
              onChange={(e) => handleFilterChange('disease', e.target.value)}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Specimen Type"
              value={filters.specimenType}
              onChange={(e) => handleFilterChange('specimenType', e.target.value)}
              size="small"
            />
          </Grid>

          {/* Export Settings */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Export Settings
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Export Format</InputLabel>
              <Select
                value={filters.format}
                label="Export Format"
                onChange={(e) => handleFilterChange('format', e.target.value)}
              >
                <MenuItem value="csv">CSV (Comma Separated Values)</MenuItem>
                <MenuItem value="excel">Excel (XLSX with formatting)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Record Limit"
              type="number"
              value={filters.limit}
              onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              inputProps={{ min: 1, max: 10000 }}
              helperText="Maximum 10,000 records"
              size="small"
            />
          </Grid>

          {/* Enhanced Column Selection */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Column Selection
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip 
                label={`${selectedColumns.length} of ${getAllColumns().length} columns selected`}
                color="primary"
                size="small"
              />
              <Button 
                size="small" 
                onClick={handleSelectAll}
                disabled={selectedColumns.length === getAllColumns().length}
              >
                Select All
              </Button>
              <Button 
                size="small" 
                onClick={handleDeselectAll}
                disabled={selectedColumns.length === 0}
              >
                Deselect All
              </Button>
              <Divider orientation="vertical" flexItem />
              <Button 
                size="small" 
                onClick={() => handleSelectByPriority('high')}
                variant="outlined"
                color="error"
              >
                + High Priority
              </Button>
              <Button 
                size="small" 
                onClick={() => handleSelectByPriority('medium')}
                variant="outlined"
                color="warning"
              >
                + Medium Priority
              </Button>
              <Button 
                size="small" 
                onClick={() => handleSelectByPriority('low')}
                variant="outlined"
              >
                + Low Priority
              </Button>
            </Box>
            
            {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => {
              const priorityColor = group.priority === 'high' ? 'error' : 
                                   group.priority === 'medium' ? 'warning' : 'default';
              
              return (
                <Accordion key={groupKey} defaultExpanded={group.priority === 'high'}>
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ 
                      '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                        gap: 1
                      }
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isGroupSelected(groupKey)}
                          indeterminate={isGroupPartiallySelected(groupKey)}
                          onChange={(e) => handleGroupToggle(groupKey, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {group.label}
                          <Chip 
                            label={group.priority} 
                            size="small" 
                            color={priorityColor}
                            variant="outlined"
                          />
                        </Box>
                      }
                      onClick={(e) => e.stopPropagation()}
                      sx={{ margin: 0 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {group.description}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FormGroup>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1 }}>
                        {group.columns.map((column) => (
                          <FormControlLabel
                            key={column.key}
                            control={
                              <Checkbox
                                checked={selectedColumns.includes(column.key)}
                                onChange={(e) => handleColumnChange(column.key, e.target.checked)}
                                size="small"
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {column.label}
                                {column.required && (
                                  <Chip label="Required" size="small" color="error" variant="outlined" />
                                )}
                                {column.key.includes('number') && (
                                  <Chip label="Auto-ID" size="small" color="primary" variant="outlined" />
                                )}
                              </Box>
                            }
                            sx={{ margin: 0 }}
                          />
                        ))}
                      </Box>
                    </FormGroup>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleReset} disabled={loading}>
          Reset All
        </Button>
        
        <Button 
          onClick={handlePreview}
          disabled={loading || selectedColumns.length === 0}
          startIcon={<PreviewIcon />}
        >
          Preview
        </Button>
        
        <Button onClick={onClose} disabled={loading && exportStatus === 'running'}>
          {exportStatus === 'success' ? 'Close' : 'Cancel'}
        </Button>
        
        <Button 
          onClick={handleExport} 
          variant="contained" 
          disabled={loading || selectedColumns.length === 0}
          startIcon={
            loading ? <CircularProgress size={20} /> : 
            exportStatus === 'success' ? <CheckCircleIcon /> : 
            <DownloadIcon />
          }
          color={exportStatus === 'success' ? 'success' : 'primary'}
        >
          {loading && exportStatus === 'running' ? 'Exporting...' : 
           exportStatus === 'success' ? 'Export Complete' :
           `Export ${filters.format.toUpperCase()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EnhancedExportDialog;