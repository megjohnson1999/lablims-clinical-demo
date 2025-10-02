import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  CircularProgress,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Save as SaveIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  Science as ScienceIcon,
  Inventory as InventoryIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { protocolAPI, specimenAPI, experimentsAPI, projectAPI } from '../../services/api';
import { toast } from 'react-toastify';

const ExperimentForm = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isEdit = Boolean(id);
  const preselectedProtocol = searchParams.get('protocol');

  // Wizard state
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const [formData, setFormData] = useState({
    protocol_id: preselectedProtocol || '',
    date_performed: new Date(),
    sample_ids: [],
    actual_reagents_used: [],
    notes: '',
    status: 'completed',
  });

  // Data states
  const [protocols, setProtocols] = useState([]);
  const [projects, setProjects] = useState([]);
  const [specimens, setSpecimens] = useState([]);
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSamples, setSelectedSamples] = useState([]);
  
  // Range selection states
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeSelectionStatus, setRangeSelectionStatus] = useState('');
  
  // Display preference state
  const [showSpecimenNumbers, setShowSpecimenNumbers] = useState(true);
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileProcessingStatus, setFileProcessingStatus] = useState('');
  
  // Calculation states
  const [reagentCalculation, setReagentCalculation] = useState(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [calculatingReagents, setCalculatingReagents] = useState(false);
  const [error, setError] = useState('');

  const steps = [
    { label: 'Select Protocol', icon: <AssignmentIcon /> },
    { label: 'Choose Samples', icon: <ScienceIcon /> },
    { label: 'Review Reagents', icon: <InventoryIcon /> },
    { label: 'Execute Experiment', icon: <CheckIcon /> }
  ];

  useEffect(() => {
    fetchProtocols();
    fetchProjects();
    // Always load all specimens for unified mode
    fetchSpecimens(); 
    if (isEdit) {
      fetchExperiment();
    }
  }, [id, isEdit]);

  // Auto-calculate reagents when protocol and samples are selected
  useEffect(() => {
    if (formData.protocol_id && selectedSamples.length > 0) {
      calculateReagentRequirements();
    }
  }, [formData.protocol_id, selectedSamples]);

  // Mark step 3 as completed when reagent calculation is complete
  useEffect(() => {
    if (reagentCalculation && reagentCalculation.calculated_reagents.length > 0) {
      setCompletedSteps(prev => new Set([...prev, 2]));
    }
  }, [reagentCalculation]);

  const fetchProtocols = async () => {
    try {
      const response = await protocolAPI.getAll('?is_active=true');
      setProtocols(response.data.protocols || []);
    } catch (err) {
      console.error('Error fetching protocols:', err);
      setError('Failed to load protocols');
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getAll('?limit=1000');
      setProjects(response.data.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    }
  };

  const fetchSpecimens = async (projectId = null) => {
    try {
      if (projectId) {
        // Fetch specimens for specific project
        const response = await projectAPI.getSpecimens(projectId);
        setSpecimens(response.data || []);
      } else {
        // Fetch all specimens (for edit mode or if no project selected)
        const response = await specimenAPI.getAll({ limit: 1000 });
        setSpecimens(response.data.specimens || []);
      }
    } catch (err) {
      console.error('Error fetching specimens:', err);
      setError('Failed to load specimens');
      setSpecimens([]);
    }
  };

  const calculateReagentRequirements = async () => {
    if (!formData.protocol_id || selectedSamples.length === 0) return;

    setCalculatingReagents(true);
    try {
      const response = await protocolAPI.calculateReagents(formData.protocol_id, selectedSamples.length);
      setReagentCalculation(response.data);
      
      // Mark step 2 as completed
      setCompletedSteps(prev => new Set([...prev, 1]));
    } catch (err) {
      console.error('Error calculating reagents:', err);
      toast.error('Failed to calculate reagent requirements');
    } finally {
      setCalculatingReagents(false);
    }
  };

  // Removed old availability check - now integrated into reagent calculation

  // Wizard navigation functions
  const handleNext = () => {
    if (canProceedToNextStep()) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const canProceedToNextStep = () => {
    switch (activeStep) {
      case 0: // Protocol selection
        return formData.protocol_id && selectedProtocol;
      case 1: // Sample selection
        // In unified mode, just need selected samples
        return selectedSamples.length > 0;
      case 2: // Reagent review
        return reagentCalculation !== null; // Allow proceed even with warnings
      case 3: // Execute
        return true;
      default:
        return false;
    }
  };

  const handleProtocolSelection = (protocolId) => {
    const protocol = protocols.find(p => p.id === protocolId);
    setSelectedProtocol(protocol);
    setFormData(prev => ({ ...prev, protocol_id: protocolId }));
    
    // Mark step 1 as completed
    setCompletedSteps(prev => new Set([...prev, 0]));
    
    // Reset subsequent steps
    setSelectedSamples([]);
    setReagentCalculation(null);
    setCompletedSteps(prev => {
      const newSet = new Set([...prev]);
      newSet.delete(1);
      newSet.delete(2);
      return newSet;
    });
  };

  const handleSampleSelection = (samples) => {
    setSelectedSamples(samples);
    const sampleIds = samples.map(s => s.id);
    setFormData(prev => ({ ...prev, sample_ids: sampleIds }));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploadedFile(file);
    setFileProcessingStatus('Processing file...');
    
    try {
      const text = await file.text();
      const specimenNumbers = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')) // Remove empty lines and comments
        .map(line => parseInt(line))
        .filter(num => !isNaN(num)); // Only keep valid numbers
      
      if (specimenNumbers.length === 0) {
        setFileProcessingStatus('Error: No valid specimen numbers found in file');
        return;
      }
      
      // Find specimens matching the uploaded numbers
      const matchingSpecimens = specimens.filter(specimen => {
        if (!specimen.specimen_number) return false;
        const specimenNum = parseInt(specimen.specimen_number);
        return !isNaN(specimenNum) && specimenNumbers.includes(specimenNum);
      });
      
      if (matchingSpecimens.length === 0) {
        setFileProcessingStatus(`Error: No specimens found matching the ${specimenNumbers.length} numbers in file`);
        return;
      }
      
      // Merge with existing selections (avoid duplicates)
      const existingIds = new Set(selectedSamples.map(s => s.id));
      const newSpecimens = matchingSpecimens.filter(s => !existingIds.has(s.id));
      const updatedSelection = [...selectedSamples, ...newSpecimens];
      
      setSelectedSamples(updatedSelection);
      setFormData(prev => ({ 
        ...prev, 
        sample_ids: updatedSelection.map(s => s.id) 
      }));
      
      setFileProcessingStatus(`Successfully added ${newSpecimens.length} specimens (${matchingSpecimens.length} found, ${specimenNumbers.length} requested)`);
      
      // Clear status after a delay
      setTimeout(() => {
        setFileProcessingStatus('');
      }, 5000);
      
    } catch (error) {
      console.error('Error processing file:', error);
      setFileProcessingStatus('Error: Failed to process file');
    }
  };


  const handleRangeSelection = () => {
    setRangeSelectionStatus('');
    
    // Parse numbers directly
    const startNum = parseInt(rangeStart.trim());
    const endNum = parseInt(rangeEnd.trim());
    
    if (isNaN(startNum) || isNaN(endNum)) {
      setRangeSelectionStatus('Error: Please enter valid numbers');
      return;
    }
    
    if (startNum > endNum) {
      setRangeSelectionStatus('Error: Start number must be less than or equal to end number');
      return;
    }
    
    // Find specimens in the range using specimen_number
    const rangeSpecimens = specimens.filter(specimen => {
      if (!specimen.specimen_number) return false;
      
      const specimenNum = parseInt(specimen.specimen_number);
      if (isNaN(specimenNum)) return false;
      
      return specimenNum >= startNum && specimenNum <= endNum;
    });
    
    if (rangeSpecimens.length === 0) {
      setRangeSelectionStatus(`Error: No specimens found in range ${rangeStart}-${rangeEnd}`);
      return;
    }
    
    // Merge with existing selections (avoid duplicates)
    const existingIds = new Set(selectedSamples.map(s => s.id));
    const newSpecimens = rangeSpecimens.filter(s => !existingIds.has(s.id));
    const updatedSelection = [...selectedSamples, ...newSpecimens];
    
    setSelectedSamples(updatedSelection);
    setFormData(prev => ({ 
      ...prev, 
      sample_ids: updatedSelection.map(s => s.id) 
    }));
    
    setRangeSelectionStatus(`Added ${newSpecimens.length} specimens (${rangeSpecimens.length} found in range)`);
    
    // Clear range inputs
    setTimeout(() => {
      setRangeStart('');
      setRangeEnd('');
      setRangeSelectionStatus('');
    }, 3000);
  };

  const fetchExperiment = async () => {
    setLoading(true);
    try {
      const response = await experimentsAPI.getById(id);
      const experiment = response.data;
      
      setFormData({
        protocol_id: experiment.protocol_id || '',
        date_performed: new Date(experiment.date_performed),
        sample_ids: experiment.sample_ids || [],
        actual_reagents_used: experiment.actual_reagents_used || [],
        notes: experiment.notes || '',
        status: experiment.status || 'completed',
      });

      // Set selected samples based on experiment data
      if (experiment.sample_ids) {
        const experimentSamples = specimens.filter(s => experiment.sample_ids.includes(s.id));
        setSelectedSamples(experimentSamples);
      }
    } catch (err) {
      console.error('Error fetching experiment:', err);
      setError('Failed to load experiment');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = async (event, newValue) => {
    setSelectedProject(newValue);
    
    // Don't clear selected specimens - just update the filter
    // Users might want to keep specimens from multiple projects
    
    if (newValue) {
      // Fetch specimens for the selected project (filter mode)
      await fetchSpecimens(newValue.id);
    } else {
      // Load all specimens if no project filter
      await fetchSpecimens();
    }
  };

  const handleSubmit = async () => {
    if (!formData.protocol_id || selectedSamples.length === 0) {
      toast.error('Please complete all steps before executing the experiment');
      return;
    }

    // Final availability check if reagents are not available
    if (reagentCalculation && !reagentCalculation.all_reagents_available) {
      const confirm = window.confirm(
        'Some reagents may not be available in sufficient quantities. Do you want to proceed anyway?'
      );
      if (!confirm) {
        return;
      }
    }

    setLoading(true);
    try {
      // Build inventory requirements for automatic deduction
      const inventoryRequirements = reagentCalculation?.calculated_reagents?.map(r => {
        // For each reagent, find the best matching inventory item(s)
        const sortedItems = r.matching_inventory_items?.sort((a, b) => {
          // Prioritize non-expired, then by expiration date, then by quantity
          if (a.is_expired !== b.is_expired) return a.is_expired ? 1 : -1;
          if (a.expiration_date && b.expiration_date) {
            return new Date(a.expiration_date) - new Date(b.expiration_date);
          }
          return b.current_quantity - a.current_quantity;
        }) || [];

        // Use the first (best) matching item
        const bestMatch = sortedItems[0];
        
        if (bestMatch) {
          // Calculate quantity needed, ensuring it's not null or undefined
          let quantityNeeded = r.total_quantity_needed;
          
          // Handle "As needed" or null quantities - skip these reagents in inventory processing
          if (quantityNeeded === null || quantityNeeded === undefined || isNaN(quantityNeeded) || quantityNeeded === 0) {
            return null; // Skip reagents with undefined quantities
          }
          
          return {
            inventory_id: bestMatch.id,
            quantity: Math.min(quantityNeeded, bestMatch.current_quantity),
            reagent_name: r.name,
            unit: r.unit
          };
        }
        
        return null;
      }).filter(item => item !== null) || [];

      // Build actual reagents used data for the experiment record
      const actualReagentsUsed = inventoryRequirements.map(req => ({
        inventory_id: req.inventory_id,
        reagent_name: req.reagent_name,
        quantity: req.quantity,
        unit: req.unit
      }));

      const experimentData = {
        ...formData,
        date_performed: formData.date_performed.toISOString().split('T')[0],
        sample_ids: selectedSamples.map(s => s.id),
        actual_reagents_used: actualReagentsUsed,
        inventory_requirements: inventoryRequirements // Pass requirements for automatic deduction
      };

      if (isEdit) {
        await experimentsAPI.update(id, experimentData);
        toast.success('Experiment updated successfully');
      } else {
        const response = await experimentsAPI.create(experimentData);
        
        // Debug: Log the response structure
        console.log('Experiment creation response:', response.data);
        
        // Handle inventory warnings
        if (response.data.has_inventory_warnings && Array.isArray(response.data.inventory_warnings) && response.data.inventory_warnings.length > 0) {
          const warnings = response.data.inventory_warnings;
          const untrackedCount = warnings.filter(w => w.type === 'untracked_reagent').length;
          const insufficientCount = warnings.filter(w => w.type === 'insufficient_quantity').length;
          
          let warningMessage = 'Experiment executed successfully';
          if (untrackedCount > 0) {
            warningMessage += ` - ${untrackedCount} reagent(s) not tracked in inventory`;
          }
          if (insufficientCount > 0) {
            warningMessage += ` - ${insufficientCount} reagent(s) had insufficient quantities`;
          }
          
          // Show detailed warnings in console for debugging
          console.warn('Inventory warnings:', warnings);
          
          // Show warning toast with details
          toast.warning(warningMessage, { 
            position: "top-right",
            autoClose: 8000, // Longer duration for warnings
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          
          // Show detailed warning messages
          warnings.forEach(warning => {
            if (warning.type === 'insufficient_quantity') {
              toast.warn(`⚠️ ${warning.message}`, { 
                autoClose: 10000,
                position: "top-center"
              });
            }
          });
        } else {
          toast.success('Experiment executed successfully - inventory automatically updated');
        }
        
        navigate('/experiments');
      }
    } catch (err) {
      console.error('Error saving experiment:', err);
      if (err.response?.data?.msg?.includes('Inventory reservation failed')) {
        toast.error('Failed to process inventory - please check system logs');
      } else if (err.response?.data?.msg) {
        toast.error(`Error: ${err.response.data.msg}`);
      } else {
        toast.error('Failed to save experiment');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Choose a Protocol
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Select the laboratory protocol you want to execute
              </Typography>
              
              <FormControl fullWidth required sx={{ mt: 2 }}>
                <InputLabel>Protocol</InputLabel>
                <Select
                  value={formData.protocol_id}
                  onChange={(e) => handleProtocolSelection(e.target.value)}
                  disabled={loading}
                >
                  {protocols.map((protocol) => (
                    <MenuItem key={protocol.id} value={protocol.id}>
                      <Box>
                        <Typography variant="body1">
                          {protocol.name} (v{protocol.version})
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {protocol.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedProtocol && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Protocol Details:
                  </Typography>
                  <Typography variant="body2" paragraph>
                    {selectedProtocol.description}
                  </Typography>
                  {selectedProtocol.required_reagents && selectedProtocol.required_reagents.length > 0 && (
                    <Box>
                      <Typography variant="caption" display="block" gutterBottom>
                        Required reagents per sample:
                      </Typography>
                      {selectedProtocol.required_reagents.map((reagent, index) => (
                        <Chip
                          key={index}
                          label={`${reagent.name}: ${reagent.quantity_per_sample} ${reagent.unit}`}
                          size="small"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        );

      case 1:
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Select Samples
              </Typography>
              
              {/* Instructions */}
              <Typography variant="body2" color="text.secondary" paragraph>
                Select specimens using any combination of methods below. You can filter by project, select ranges, upload files, or search manually.
              </Typography>

              {/* Unified Selection Interface */}
              <Box>
                {/* Optional Project Filter */}
                <Box sx={{ mb: 3 }}>
                  <Autocomplete
                    fullWidth
                    options={projects}
                    getOptionLabel={(project) => `#${project.project_number} - ${project.disease || 'Unnamed Project'} (${project.pi_name})`}
                    value={selectedProject}
                    onChange={handleProjectSelect}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Filter by Project (Optional)"
                        placeholder="Search for a project to filter specimens..."
                        helperText="Leave empty to search all projects, or select a project to filter specimens"
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
                  {selectedProject && (
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => {
                        setSelectedProject(null);
                        fetchSpecimens(); // Load all specimens
                      }}
                      sx={{ mt: 1 }}
                    >
                      Clear Project Filter
                    </Button>
                  )}
                </Box>

                {/* Range Selection */}
                <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Quick Range Selection
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    Select specimens by number range {selectedProject ? `from project #${selectedProject.project_number}` : 'across all projects'}
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <TextField
                        size="small"
                        label="Start Number"
                        placeholder="Start number"
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        size="small"
                        label="End Number"
                        placeholder="End number"
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Button
                        variant="outlined"
                        onClick={handleRangeSelection}
                        disabled={!rangeStart || !rangeEnd}
                        size="small"
                      >
                        Select Range
                      </Button>
                      <Button
                        variant="text"
                        onClick={() => {
                          setRangeStart('');
                          setRangeEnd('');
                        }}
                        size="small"
                        sx={{ ml: 1 }}
                      >
                        Clear
                      </Button>
                    </Grid>
                    <Grid item xs={12} sm={2}>
                      {rangeSelectionStatus && (
                        <Typography variant="caption" color={rangeSelectionStatus.includes('Error') ? 'error' : 'success.main'}>
                          {rangeSelectionStatus}
                        </Typography>
                      )}
                    </Grid>
                  </Grid>
                </Box>

                {/* File Upload Section */}
                <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Upload WUIDs
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    Upload a text file containing WUIDs (one per line)
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                      <input
                        accept=".txt,.csv"
                        style={{ display: 'none' }}
                        id="specimen-file-upload"
                        type="file"
                        onChange={handleFileUpload}
                      />
                      <label htmlFor="specimen-file-upload">
                        <Button variant="outlined" component="span" size="small">
                          Choose File
                        </Button>
                      </label>
                      {uploadedFile && (
                        <Typography variant="body2" sx={{ ml: 2, display: 'inline' }}>
                          {uploadedFile.name}
                        </Typography>
                      )}
                    </Grid>
                    <Grid item xs={12}>
                      {fileProcessingStatus && (
                        <Typography 
                          variant="caption" 
                          color={fileProcessingStatus.includes('Error') ? 'error' : fileProcessingStatus.includes('Success') ? 'success.main' : 'info.main'}
                        >
                          {fileProcessingStatus}
                        </Typography>
                      )}
                    </Grid>
                  </Grid>
                </Box>

                {/* Manual Search Section */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">
                    Manual Selection {selectedProject ? `(Project #${selectedProject.project_number})` : '(All Projects)'}
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showSpecimenNumbers}
                        onChange={(e) => setShowSpecimenNumbers(e.target.checked)}
                        size="small"
                      />
                    }
                    label={showSpecimenNumbers ? "WUIDs" : "Tube IDs"}
                    sx={{ ml: 2 }}
                  />
                </Box>
                <Autocomplete
                  multiple
                  options={specimens}
                  getOptionLabel={(specimen) => {
                    const displayId = showSpecimenNumbers 
                      ? (specimen.specimen_number || 'No Number')
                      : (specimen.tube_id || 'No ID');
                    // Add project info when not filtering by project
                    const projectInfo = !selectedProject && specimen.project_number ? ` (Project #${specimen.project_number})` : '';
                    return `${displayId}${projectInfo}`;
                  }}
                  value={selectedSamples}
                  onChange={(event, newValue) => handleSampleSelection(newValue)}
                  renderTags={(selected, getTagProps) =>
                    selected.map((specimen, index) => {
                      const displayId = showSpecimenNumbers 
                        ? (specimen.specimen_number || 'No Number')
                        : (specimen.tube_id || 'No ID');
                      const projectInfo = !selectedProject && specimen.project_number ? ` (P#${specimen.project_number})` : '';
                      return (
                        <Chip
                          {...getTagProps({ index })}
                          key={specimen.id}
                          label={`${displayId}${projectInfo}`}
                          size="small"
                        />
                      );
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={selectedProject ? `Search specimens from project #${selectedProject.project_number}...` : "Search specimens from all projects..."}
                      helperText={`${selectedSamples.length} of ${specimens.length} specimens selected`}
                    />
                  )}
                />

                {selectedSamples.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Selected Samples ({selectedSamples.length}){!selectedProject ? ' - Grouped by Project:' : ':'}
                    </Typography>
                    <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                      {!selectedProject ? (
                        // Multi-project grouping
                        (() => {
                          const groupedByProject = selectedSamples.reduce((groups, specimen) => {
                            const projectKey = specimen.project_number || 'Unknown Project';
                            const projectName = specimen.disease || 'Unnamed Project';
                            const key = `#${projectKey} - ${projectName}`;
                            if (!groups[key]) groups[key] = [];
                            groups[key].push(specimen);
                            return groups;
                          }, {});

                          return Object.entries(groupedByProject).map(([projectKey, specimens]) => (
                            <Box key={projectKey} sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" color="primary" gutterBottom>
                                {projectKey} ({specimens.length} specimens)
                              </Typography>
                              <Grid container spacing={1}>
                                {specimens.map((specimen) => {
                                  const displayId = showSpecimenNumbers 
                                    ? (specimen.specimen_number || 'No Number')
                                    : (specimen.tube_id || 'No ID');
                                  return (
                                    <Grid item key={specimen.id} xs={6} sm={4} md={3}>
                                      <Box sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'grey.50' }}>
                                        <Typography variant="body2">
                                          {displayId}
                                        </Typography>
                                      </Box>
                                    </Grid>
                                  );
                                })}
                              </Grid>
                            </Box>
                          ));
                        })()
                      ) : (
                        // Single project simple list
                        selectedSamples.map((specimen) => {
                          const displayId = showSpecimenNumbers 
                            ? (specimen.specimen_number || 'No Number')
                            : (specimen.tube_id || 'No ID');
                          return (
                            <Box key={specimen.id} sx={{ p: 1, border: 1, borderColor: 'divider', mb: 1 }}>
                              <Typography variant="body2">
                                <strong>{displayId}</strong>
                              </Typography>
                            </Box>
                          );
                        })
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Review Reagent Requirements
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Verify reagent availability and estimated costs
              </Typography>

              {calculatingReagents && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <Typography variant="body2">Calculating reagent requirements...</Typography>
                </Box>
              )}

              {reagentCalculation && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Total Reagent Requirements:
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Reagent</TableCell>
                          <TableCell align="right">Per Sample</TableCell>
                          <TableCell align="right">Total Needed</TableCell>
                          <TableCell align="center">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reagentCalculation.calculated_reagents.map((reagent, index) => {
                          return (
                            <TableRow key={index}>
                              <TableCell>
                                <Box>
                                  <Typography variant="body2">{reagent.name}</Typography>
                                  {reagent.matching_inventory_items.length > 0 && (
                                    <Typography variant="caption" color="text.secondary">
                                      Found {reagent.matching_inventory_items.length} matching item(s)
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                {reagent.quantity_per_sample} {reagent.unit}
                              </TableCell>
                              <TableCell align="right">
                                <strong>{reagent.total_quantity_needed} {reagent.unit}</strong>
                                <Typography variant="caption" display="block" color="text.secondary">
                                  Available: {reagent.available_quantity} {reagent.unit}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                {reagent.is_available ? (
                                  <Tooltip title="Sufficient inventory available">
                                    <CheckIcon color="success" />
                                  </Tooltip>
                                ) : (
                                  <Tooltip title={`Short by ${reagent.shortage} ${reagent.unit}`}>
                                    <WarningIcon color="warning" />
                                  </Tooltip>
                                )}
                                {reagent.warnings.length > 0 && (
                                  <Tooltip title={reagent.warnings.join('; ')}>
                                    <WarningIcon color="warning" sx={{ ml: 1 }} />
                                  </Tooltip>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {reagentCalculation && (
                <Box>
                  <Alert 
                    severity={reagentCalculation.all_reagents_available ? 'success' : 'warning'}
                    sx={{ mb: 2 }}
                  >
                    {reagentCalculation.all_reagents_available 
                      ? 'All reagents are available! Ready to proceed.' 
                      : (
                        <Box>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            Some reagents may not be available in sufficient quantities:
                          </Typography>
                          {reagentCalculation.calculated_reagents
                            ?.filter(r => !r.is_available)
                            .map((reagent, idx) => (
                              <Typography key={idx} variant="body2" sx={{ ml: 2, fontSize: '0.85em' }}>
                                • {reagent.name}: Need {reagent.total_quantity_needed} {reagent.unit}, 
                                Available {reagent.available_quantity || 0} {reagent.unit}
                                {reagent.available_quantity === 0 && ' (not tracked in inventory)'}
                              </Typography>
                            ))
                          }
                          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                            You can still proceed - the experiment will use available quantities and log warnings.
                          </Typography>
                        </Box>
                      )}
                  </Alert>
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Total reagents required: {reagentCalculation.total_unique_reagents}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Execute Experiment
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Final details and experiment execution
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Date Performed"
                      value={formData.date_performed}
                      onChange={(date) => setFormData(prev => ({ ...prev, date_performed: date }))}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </LocalizationProvider>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="in_progress">In Progress</MenuItem>
                      <MenuItem value="failed">Failed</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any notes about this experiment..."
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Experiment Summary:
                </Typography>
                <Typography variant="body2">
                  • Protocol: {selectedProtocol?.name} (v{selectedProtocol?.version})
                </Typography>
                <Typography variant="body2">
                  • Samples: {selectedSamples.length} specimens
                </Typography>
                <Typography variant="body2">
                  • Reagents: {reagentCalculation?.total_unique_reagents || 0} types
                </Typography>
                <Typography variant="body2">
                  • Available: {reagentCalculation?.all_reagents_available ? 'Yes' : 'Partial'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  if (loading && isEdit && !formData.protocol_id) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {isEdit ? 'Edit Experiment' : 'Plan New Experiment'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ mt: 2 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label} completed={completedSteps.has(index)}>
                <StepLabel
                  optional={
                    index === 2 && reagentCalculation && !reagentCalculation.all_reagents_available ? (
                      <Typography variant="caption" color="warning.main">
                        Some reagents may be unavailable
                      </Typography>
                    ) : null
                  }
                  StepIconComponent={({ completed, active }) => (
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: completed ? 'success.main' : active ? 'primary.main' : 'grey.300',
                        color: 'white'
                      }}
                    >
                      {completed ? <CheckIcon fontSize="small" /> : step.icon}
                    </Box>
                  )}
                >
                  {step.label}
                </StepLabel>
                <StepContent>
                  {renderStepContent(index)}
                  
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      disabled={activeStep === 0}
                      onClick={handleBack}
                      startIcon={<BackIcon />}
                    >
                      Back
                    </Button>
                    
                    {activeStep < steps.length - 1 ? (
                      <Button
                        variant="contained"
                        onClick={handleNext}
                        disabled={!canProceedToNextStep()}
                        endIcon={<NextIcon />}
                      >
                        Next
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={handleSubmit}
                        disabled={loading || !canProceedToNextStep()}
                        startIcon={loading ? <CircularProgress size={16} /> : <SaveIcon />}
                      >
                        {loading ? 'Saving...' : isEdit ? 'Update' : 'Execute Experiment'}
                      </Button>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default ExperimentForm;