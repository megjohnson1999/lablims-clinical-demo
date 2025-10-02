import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  IconButton,
  CircularProgress,
  Alert,
  Pagination,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Collapse,
  InputAdornment,
  Checkbox,
  ListItemText,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  GetApp as ExportIcon,
  Upload as ImportIcon,
  Print as PrintIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  Clear as ClearIcon,
  CloudUpload as FileUploadIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { specimenAPI, labelAPI, collaboratorAPI, projectAPI } from '../../services/api';
import { formatDate, getLocationString } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import { useDropzone } from 'react-dropzone';
import ExportDialog from '../common/ExportDialog';
import SpecimenImport from './SpecimenImport';

// Available filter columns configuration - moved outside component to prevent re-renders
const FILTER_COLUMNS = {
  wuid: {
    label: 'WUID',
    type: 'text',
    apiField: 'specimen_number',
    placeholder: 'Enter WUID...'
  },
  tube_id: {
    label: 'Tube ID',
    type: 'text',
    apiField: 'tube_id',
    placeholder: 'Enter Tube ID...'
  },
  specimen_type: {
    label: 'Specimen Type',
    type: 'multiselect',
    apiField: 'specimen_type',
    placeholder: 'Select specimen types...',
    options: ['stool', 'serum', 'plasma', 'blood', 'urine', 'tissue', 'swab', 'saliva', 'csf']
  },
  disease: {
    label: 'Disease',
    type: 'multiselect', 
    apiField: 'disease',
    placeholder: 'Type to search diseases or select from list...',
    options: [] // Will be populated from data + common diseases
  },
  collaborator: {
    label: 'Collaborator/PI',
    type: 'autocomplete',
    apiField: 'collaboratorId',
    options: 'collaborators',
    placeholder: 'Search by PI name, institute, or number...',
    searchFields: ['pi_name', 'pi_institute', 'collaborator_number']
  },
  project: {
    label: 'Project',
    type: 'autocomplete',
    apiField: 'projectId', 
    options: 'projects',
    placeholder: 'Search by disease, project number, or specimen type...',
    searchFields: ['disease', 'project_number', 'specimen_type']
  },
  date_collected: {
    label: 'Date Collected',
    type: 'daterange',
    apiField: 'date_collected',
    placeholder: 'Select date range...'
  },
  freezer: {
    label: 'Freezer',
    type: 'multiselect',
    apiField: 'position_freezer',
    placeholder: 'Select freezers...',
    options: [] // Will be populated from data
  },
  rack: {
    label: 'Rack',
    type: 'text',
    apiField: 'position_rack',
    placeholder: 'Enter rack...'
  },
  box: {
    label: 'Box',
    type: 'text',
    apiField: 'position_box',
    placeholder: 'Enter box...'
  },
  extracted: {
    label: 'Extracted Status',
    type: 'select',
    apiField: 'extracted',
    options: [
      { value: 'true', label: 'Extracted' },
      { value: 'false', label: 'Not Extracted' }
    ]
  },
  used_up: {
    label: 'Used Up Status', 
    type: 'select',
    apiField: 'used_up',
    options: [
      { value: 'true', label: 'Used Up' },
      { value: 'false', label: 'Available' }
    ]
  }
};

const SpecimenList = () => {
  const [specimens, setSpecimens] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedSpecimens, setSelectedSpecimens] = useState([]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [metadataFilterOpen, setMetadataFilterOpen] = useState(false);
  const [metadataFilters, setMetadataFilters] = useState({});
  
  // Dynamic filter system state
  const [quickSearchTerm, setQuickSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);
  const [nextFilterId, setNextFilterId] = useState(1);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [projects, setProjects] = useState([]);
  const [dynamicOptions, setDynamicOptions] = useState({
    disease: [],
    freezer: []
  });
  
  // Bulk ID upload state
  const [bulkIdText, setBulkIdText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [bulkIdMode, setBulkIdMode] = useState(0); // 0 = text, 1 = file
  
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const canEdit = canEditLabData(currentUser);

  // Pagination component
  const PaginationControls = ({ className = '' }) => {
    if ((!debouncedSearchTerm && totalCount <= limit) || totalCount === 0) {
      return null;
    }

    return (
      <Box className={className} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, my: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {bulkIdText && bulkIdText.trim() ? (
            `Showing ${specimens.length} of ${totalCount} specimens (bulk search)`
          ) : (
            `Showing ${Math.min((page - 1) * limit + 1, totalCount)} - ${Math.min(page * limit, totalCount)} of ${totalCount} specimens`
          )}
        </Typography>
        {!(bulkIdText && bulkIdText.trim()) && (
          <Pagination
            count={Math.ceil(totalCount / limit)}
            page={page}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
            disabled={loading}
          />
        )}
      </Box>
    );
  };


  // Refresh function to trigger a re-load
  const refreshSpecimens = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    // Force a re-render by updating a state value
    setPage(prevPage => prevPage); // This will trigger the useEffect
  }, []);

  // MINIMAL dropdown options - disabled to avoid crashes
  const fetchDropdownOptions = useCallback(async () => {
    console.log('🔴 MINIMAL fetchDropdownOptions called - doing NOTHING');
    // Completely disable to isolate crash
    return;
  }, []);

  // Disable automatic search-while-typing
  // useEffect(() => {
  //   console.log('⏰ Setting up debounce for:', quickSearchTerm);
  //   const timer = setTimeout(() => {
  //     console.log('⏰ Debounce complete, setting debouncedSearchTerm to:', quickSearchTerm);
  //     setDebouncedSearchTerm(quickSearchTerm);
  //   }, 500);

  //   return () => clearTimeout(timer);
  // }, [quickSearchTerm]);

  // Manual search trigger
  const handleSearch = (event) => {
    if (event.key === 'Enter') {
      console.log('🔍 Enter pressed, triggering search for:', quickSearchTerm);
      setDebouncedSearchTerm(quickSearchTerm);
    }
  };

  // Single effect to handle all data loading scenarios
  useEffect(() => {
    console.log('🟡 Data loading triggered - page:', page, 'searchTerm:', debouncedSearchTerm);
    
    const loadData = async () => {
      console.log('🔴 loadData called with search term:', debouncedSearchTerm);
      setLoading(true);
      
      try {
        let response;
        
        // Handle bulk ID search vs normal filtering
        if (bulkIdText && bulkIdText.trim()) {
          console.log('📋 Using bulk search for IDs:', bulkIdText.trim());
          
          // Parse bulk IDs from text
          const identifiers = bulkIdText
            .split(/[,;\n\r]+/)
            .map(id => id.trim())
            .filter(Boolean);
          
          console.log('📋 Parsed identifiers:', identifiers);
          
          // Use bulk search API
          response = await specimenAPI.bulkSearch({ identifiers });
          console.log('✅ Bulk search completed:', response.data);
          
        } else {
          // Build query parameters including search term and advanced filters
          const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString()
          });
          
          // Add search term if present
          if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
            params.append('searchTerm', debouncedSearchTerm.trim());
            console.log('🔍 Adding search term:', debouncedSearchTerm.trim());
          }
          
          // Add advanced filters
          if (activeFilters && activeFilters.length > 0) {
            console.log('🔧 Adding advanced filters:', activeFilters);
            activeFilters.forEach(filter => {
              if (filter.value && filter.value.toString().trim()) {
                // Get the API field name from FILTER_COLUMNS config
                const columnConfig = FILTER_COLUMNS[filter.column];
                const paramName = columnConfig?.apiField || filter.column;
                const paramValue = filter.value.toString().trim();
                
                // Handle multi-select filters (arrays) by joining with commas
                if (Array.isArray(filter.value)) {
                  params.append(paramName, filter.value.join(','));
                  console.log(`🔧 Added filter: ${paramName} = [${filter.value.join(', ')}]`);
                } else {
                  params.append(paramName, paramValue);
                  console.log(`🔧 Added filter: ${paramName} = ${paramValue}`);
                }
              }
            });
          }
          
          console.log('📡 API call with params:', params.toString());
          console.log('📡 Full API URL would be: /api/specimens?' + params.toString());
          
          response = await specimenAPI.getAll(`?${params.toString()}`);
          console.log('✅ API response received:', response.data);
        }
        
        if (response.data.specimens) {
          setSpecimens(response.data.specimens);
          
          // Handle different response formats
          if (response.data.summary) {
            // Bulk search response format
            setTotalCount(response.data.summary.found_count);
            console.log('✅ Bulk search completed - found:', response.data.summary.found_count, 'missing:', response.data.summary.missing_count);
          } else {
            // Regular paginated response format
            setTotalCount(response.data.totalCount);
            console.log('✅ Data loaded - page:', page, 'showing:', response.data.specimens.length, 'total found:', response.data.totalCount);
          }
        } else {
          setSpecimens(response.data || []);
          setTotalCount(response.data?.length || 0);
        }
        
        setError('');
      } catch (err) {
        console.error('❌ Error in loadData:', err);
        setError('Failed to load specimens');
        setSpecimens([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
        console.log('🏁 loadData completed');
      }
    };
    
    loadData();
  }, [page, debouncedSearchTerm, limit, activeFilters, bulkIdText]); // Run when page, search term, limit, filters, or bulk IDs change

  // useEffect(() => {
  //   fetchDropdownOptions();
  // }, [fetchDropdownOptions]);


  const handlePageChange = (event, newPage) => {
    setPage(newPage);
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

  const handleGenerateLabels = async () => {
    if (selectedSpecimens.length === 0) {
      toast.error('Please select at least one specimen');
      return;
    }

    try {
      const response = await labelAPI.generateLabels(selectedSpecimens);
      console.log('Label content:', response.data.content);

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
      toast.error('Failed to generate labels');
    }
  };

  const handleDeleteSpecimen = async (id) => {
    if (!window.confirm('Are you sure you want to delete this specimen?')) {
      return;
    }

    try {
      await specimenAPI.delete(id);
      toast.success('Specimen deleted successfully');
      refreshSpecimens();
    } catch (err) {
      console.error('Error deleting specimen', err);
      toast.error('Failed to delete specimen');
    }
  };

  const handleImportComplete = (results) => {
    toast.success(`Import completed: ${results.created} created, ${results.updated} updated`);
    refreshSpecimens(); // Refresh the list
    setImportDialogOpen(false);
  };

  const handleMetadataFilter = (field, value) => {
    setMetadataFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPage(1); // Reset to first page when filtering
  };

  const clearMetadataFilters = () => {
    setMetadataFilters({});
    setPage(1);
  };

  // Dynamic filter management functions
  const addFilter = (columnKey) => {
    const column = FILTER_COLUMNS[columnKey];
    const newFilter = {
      id: nextFilterId,
      column: columnKey,
      value: column?.type === 'multiselect' ? [] : '',
      operator: 'contains' // Default operator
    };
    setActiveFilters(prev => [...prev, newFilter]);
    setNextFilterId(prev => prev + 1);
  };

  const updateFilter = (filterId, field, value) => {
    console.log('🔧 updateFilter called:', { filterId, field, value });
    setActiveFilters(prev => {
      const updated = prev.map(filter =>
        filter.id === filterId ? { ...filter, [field]: value } : filter
      );
      console.log('🔧 Updated activeFilters:', updated);
      return updated;
    });
  };

  const removeFilter = (filterId) => {
    setActiveFilters(prev => prev.filter(filter => filter.id !== filterId));
  };

  const clearAllFilters = () => {
    setQuickSearchTerm('');
    setActiveFilters([]);
    setBulkIdText('');
    setUploadedFile(null);
    setFileError('');
    setMetadataFilters({});
    setPage(1);
  };

  // Enhanced filtering functions
  const fetchCollaborators = async () => {
    try {
      // Limit to 1000 collaborators for dropdown performance
      const response = await collaboratorAPI.getAll('?limit=1000');
      setCollaborators(response.data.collaborators || []);
    } catch (err) {
      console.error('Error fetching collaborators:', err);
      setCollaborators([]);
    }
  };

  const fetchProjects = async () => {
    try {
      // Limit to 1000 projects for dropdown performance  
      const response = await projectAPI.getAll('?limit=1000');
      setProjects(response.data.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setProjects([]);
    }
  };

  // Load collaborators and projects when filters are expanded
  useEffect(() => {
    if (filtersExpanded) {
      fetchCollaborators();
      fetchProjects();
    }
  }, [filtersExpanded]);


  // File processing for bulk ID upload
  const parseFileContent = (content, filename) => {
    const extension = filename.toLowerCase().split('.').pop();
    
    if (extension === 'csv') {
      const lines = content.split('\n').filter(line => line.trim());
      const identifiers = [];
      
      lines.forEach(line => {
        const values = line.split(',').map(v => v.trim()).filter(Boolean);
        if (values.length > 0) {
          identifiers.push(values[0]);
        }
      });
      
      return identifiers;
    } else {
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    setFileError('');
    
    if (acceptedFiles.length === 0) {
      setFileError('Please upload a CSV or TXT file');
      return;
    }

    const file = acceptedFiles[0];
    const extension = file.name.toLowerCase().split('.').pop();
    
    if (!['csv', 'txt'].includes(extension)) {
      setFileError('Only CSV and TXT files are supported');
      return;
    }

    if (file.size > 1024 * 1024) {
      setFileError('File size must be less than 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const identifiers = parseFileContent(content, file.name);
        
        if (identifiers.length === 0) {
          setFileError('No valid identifiers found in file');
          return;
        }

        if (identifiers.length > 1000) {
          setFileError('File contains more than 1000 identifiers. Please limit to 1000 or fewer.');
          return;
        }

        setBulkIdText(identifiers.join('\n'));
        setUploadedFile(file);
        toast.success(`Loaded ${identifiers.length} identifiers from ${file.name}`);
        
      } catch (err) {
        setFileError(`Error parsing file: ${err.message}`);
      }
    };

    reader.onerror = () => {
      setFileError('Error reading file');
    };

    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/csv': ['.csv']
    },
    maxFiles: 1
  });


  return (
    <Box className="specimen-list page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Specimens
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={() => setExportDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Export CSV
          </Button>
          {canEdit && (
            <>
              <Button
                variant="outlined"
                startIcon={<ImportIcon />}
                onClick={() => setImportDialogOpen(true)}
                sx={{ mr: 1 }}
              >
                Import
              </Button>
              <Button
                component={Link}
                to="/specimens/new"
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
              >
                New Specimen
              </Button>
            </>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Enhanced Filtering Interface */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Search & Filter Specimens
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={filtersExpanded ? <ExpandMoreIcon sx={{ transform: 'rotate(180deg)' }} /> : <ExpandMoreIcon />}
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              size="small"
            >
{filtersExpanded ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={clearAllFilters}
              size="small"
            >
              Clear All
            </Button>
          </Box>
        </Box>

        {/* Quick Search Bar - Always Visible */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Quick Search"
            variant="outlined"
            value={quickSearchTerm}
            onChange={(e) => setQuickSearchTerm(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Type search term and press Enter..."
            size="small"
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              )
            }}
          />
          {debouncedSearchTerm && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setQuickSearchTerm('');
                setDebouncedSearchTerm('');
              }}
              startIcon={<ClearIcon />}
            >
              Clear
            </Button>
          )}
        </Box>

        {/* Dynamic Filter Builder - Collapsible */}
        <Collapse in={filtersExpanded}>
          <Box sx={{ pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            
            {/* Filter Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Advanced Filters
              </Typography>
              
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Add Filter</InputLabel>
                <Select
                  value=""
                  label="Add Filter"
                  onChange={(e) => {
                    if (e.target.value) {
                      addFilter(e.target.value);
                    }
                  }}
                >
                  {Object.entries(FILTER_COLUMNS).map(([key, config]) => (
                    <MenuItem 
                      key={key} 
                      value={key}
                      disabled={activeFilters.some(f => f.column === key)}
                    >
                      {config.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Active Filters */}
            {activeFilters.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Active filters (all conditions must match):
                </Typography>
                <Grid container spacing={2}>
                  {activeFilters.map((filter) => {
                    const columnConfig = FILTER_COLUMNS[filter.column];
                    return (
                      <Grid item xs={12} md={6} key={filter.id}>
                        <Paper sx={{ p: 2, position: 'relative' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="body2" sx={{ minWidth: 100, fontWeight: 'medium' }}>
                              {columnConfig?.label}:
                            </Typography>
                            
                            {columnConfig?.type === 'text' && (
                              <TextField
                                size="small"
                                placeholder={columnConfig.placeholder}
                                value={filter.value}
                                onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                sx={{ flexGrow: 1 }}
                              />
                            )}
                            
                            {columnConfig?.type === 'dropdown' && (
                              <FormControl size="small" sx={{ flexGrow: 1 }}>
                                <Select
                                  value={filter.value}
                                  onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                  displayEmpty
                                >
                                  <MenuItem value="">All</MenuItem>
                                  {columnConfig.options === 'collaborators' && collaborators.map((item) => (
                                    <MenuItem key={item.id} value={item.id}>
                                      {item.pi_name} - {item.pi_institute}
                                    </MenuItem>
                                  ))}
                                  {columnConfig.options === 'projects' && projects.map((item) => (
                                    <MenuItem key={item.id} value={item.id}>
                                      {item.disease || 'Unnamed Project'} - {item.pi_name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                            
                            {columnConfig?.type === 'autocomplete' && (
                              <Autocomplete
                                size="small"
                                sx={{ flexGrow: 1 }}
                                options={columnConfig.options === 'collaborators' ? collaborators : projects}
                                getOptionLabel={(option) => {
                                  if (columnConfig.options === 'collaborators') {
                                    return `${option.pi_name} - ${option.pi_institute} (#${option.collaborator_number || 'N/A'})`;
                                  } else {
                                    return `${option.disease || 'Unnamed Project'} (#${option.project_number || 'N/A'}) - ${option.pi_name}`;
                                  }
                                }}
                                value={columnConfig.options === 'collaborators' 
                                  ? collaborators.find(item => item.id === filter.value) || null
                                  : projects.find(item => item.id === filter.value) || null
                                }
                                onChange={(event, newValue) => {
                                  console.log('🔍 Autocomplete selection:', {
                                    filterType: columnConfig.options,
                                    selectedValue: newValue,
                                    extractedId: newValue?.id
                                  });
                                  updateFilter(filter.id, 'value', newValue?.id || '');
                                }}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder={columnConfig.placeholder}
                                    variant="outlined"
                                  />
                                )}
                                filterOptions={(options, { inputValue }) => {
                                  if (!inputValue) return options;
                                  
                                  const searchText = inputValue.toLowerCase();
                                  return options.filter((option) => {
                                    if (columnConfig.options === 'collaborators') {
                                      return (
                                        option.pi_name?.toLowerCase().includes(searchText) ||
                                        option.pi_institute?.toLowerCase().includes(searchText) ||
                                        option.collaborator_number?.toString().includes(searchText)
                                      );
                                    } else {
                                      return (
                                        option.disease?.toLowerCase().includes(searchText) ||
                                        option.project_number?.toString().includes(searchText) ||
                                        option.specimen_type?.toLowerCase().includes(searchText) ||
                                        option.pi_name?.toLowerCase().includes(searchText)
                                      );
                                    }
                                  });
                                }}
                              />
                            )}
                            
                            {columnConfig?.type === 'multiselect' && (
                              <Autocomplete
                                multiple
                                size="small"
                                value={filter.value || []}
                                onChange={(event, newValue) => updateFilter(filter.id, 'value', newValue)}
                                options={
                                  filter.column === 'specimen_type' ? columnConfig.options :
                                  filter.column === 'disease' ? dynamicOptions.disease :
                                  filter.column === 'freezer' ? dynamicOptions.freezer : []
                                }
                                freeSolo
                                clearOnBlur
                                selectOnFocus
                                handleHomeEndKeys
                                filterSelectedOptions
                                renderTags={(tagValue, getTagProps) =>
                                  tagValue.map((option, index) => (
                                    <Chip
                                      label={option}
                                      size="small"
                                      {...getTagProps({ index })}
                                      key={option}
                                    />
                                  ))
                                }
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder={columnConfig.placeholder}
                                    variant="outlined"
                                  />
                                )}
                                sx={{ flexGrow: 1 }}
                              />
                            )}
                            
                            {columnConfig?.type === 'select' && (
                              <FormControl size="small" sx={{ flexGrow: 1 }}>
                                <Select
                                  value={filter.value}
                                  onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                  displayEmpty
                                >
                                  <MenuItem value="">Any</MenuItem>
                                  {columnConfig.options.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                      {option.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                            
                            <IconButton
                              size="small"
                              onClick={() => removeFilter(filter.id)}
                              sx={{ color: 'error.main' }}
                            >
                              <ClearIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}

            {/* Bulk ID Upload */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                Search by Specific Specimen IDs
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Search for specific specimens by uploading a file or entering IDs manually
              </Typography>

              <Box sx={{ mt: 2 }}>
                <Tabs 
                  value={bulkIdMode} 
                  onChange={(e, newValue) => setBulkIdMode(newValue)}
                  sx={{ mb: 2 }}
                >
                  <Tab label="Text Input" />
                  <Tab label="File Upload" />
                </Tabs>

                {bulkIdMode === 0 ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={bulkIdText}
                    onChange={(e) => setBulkIdText(e.target.value)}
                    placeholder="Enter WUIDs (one per line or comma-separated):&#10;123, 456, 789&#10;1001, 1002, 1003"
                    variant="outlined"
                    size="small"
                  />
                ) : (
                  <Box>
                    <Paper
                      {...getRootProps()}
                      sx={{
                        p: 3,
                        textAlign: 'center',
                        border: '2px dashed',
                        borderColor: isDragActive ? 'primary.main' : 'grey.300',
                        backgroundColor: isDragActive ? 'action.hover' : 'transparent',
                        cursor: 'pointer',
                        mb: 2,
                        '&:hover': {
                          backgroundColor: 'action.hover',
                          borderColor: 'primary.main'
                        }
                      }}
                    >
                      <input {...getInputProps()} />
                      <FileUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body1" gutterBottom>
                        {isDragActive ? 'Drop file here' : 'Drag & drop file here, or click to browse'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Supports CSV and TXT files • Max 1MB • Up to 1000 WUIDs
                      </Typography>
                    </Paper>
                    
                    {uploadedFile && (
                      <Alert severity="success" sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <FileIcon />
                          <Typography variant="body2">
                            {uploadedFile.name} loaded successfully
                          </Typography>
                        </Box>
                      </Alert>
                    )}
                    
                    {fileError && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {fileError}
                      </Alert>
                    )}

                    {bulkIdText && (
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={bulkIdText}
                        onChange={(e) => setBulkIdText(e.target.value)}
                        label="Loaded Identifiers (editable)"
                        variant="outlined"
                        size="small"
                      />
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Collapse>

        {/* Active Filter Chips */}
        {(quickSearchTerm || activeFilters.length > 0 || Object.keys(metadataFilters).length > 0 || bulkIdText) && (
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Active filters:
            </Typography>
            
            {/* Quick search chip */}
            {quickSearchTerm && (
              <Chip
                label={`Quick Search: ${quickSearchTerm}`}
                onDelete={() => setQuickSearchTerm('')}
                size="small"
                color="primary"
              />
            )}
            
            {/* Dynamic filter chips */}
            {activeFilters.map(filter => {
              const columnConfig = FILTER_COLUMNS[filter.column];
              let displayValue = filter.value;
              
              // Format display value for different filter types
              if (columnConfig?.type === 'multiselect' && Array.isArray(filter.value)) {
                displayValue = filter.value.length > 0 ? filter.value.join(', ') : '';
              } else if (columnConfig?.type === 'dropdown' || columnConfig?.type === 'autocomplete') {
                if (columnConfig.options === 'collaborators') {
                  const collab = collaborators.find(c => c.id === filter.value);
                  displayValue = collab ? `${collab.pi_name} (#${collab.collaborator_number || 'N/A'})` : filter.value;
                } else if (columnConfig.options === 'projects') {
                  const proj = projects.find(p => p.id === filter.value);
                  displayValue = proj ? `${proj.disease || 'Unnamed Project'} (#${proj.project_number || 'N/A'})` : filter.value;
                }
              } else if (columnConfig?.type === 'select') {
                const option = columnConfig.options.find(o => o.value === filter.value);
                displayValue = option?.label || filter.value;
              }
              
              // Don't show empty multiselect chips
              if (columnConfig?.type === 'multiselect' && (!filter.value || filter.value.length === 0)) {
                return null;
              }
              
              return (
                <Chip
                  key={filter.id}
                  label={`${columnConfig?.label}: ${displayValue}`}
                  onDelete={() => removeFilter(filter.id)}
                  size="small"
                  color="primary"
                />
              );
            })}
            
            {/* Bulk IDs chip */}
            {bulkIdText && (
              <Chip
                label={`Bulk IDs: ${bulkIdText.split(/[,;\n\r]+/).length} specimens`}
                onDelete={() => setBulkIdText('')}
                size="small"
                color="secondary"
              />
            )}
            
            {/* Metadata filter chips */}
            {Object.entries(metadataFilters).map(([field, value]) => (
              <Chip
                key={field}
                label={`${field}: ${value}`}
                onDelete={() => handleMetadataFilter(field, '')}
                size="small"
                color="primary"
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Top Pagination */}
      <PaginationControls className="top-pagination" />

      {selectedSpecimens.length > 0 && (
        <Box mb={2} display="flex" alignItems="center">
          <Typography variant="body2" mr={2}>
            {selectedSpecimens.length} specimens selected
          </Typography>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handleGenerateLabels}
            size="small"
          >
            Print Labels
          </Button>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <input
                  type="checkbox"
                  checked={
                    specimens.length > 0 &&
                    selectedSpecimens.length === specimens.length
                  }
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>WUID</TableCell>
              <TableCell>Tube ID</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Date Collected</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : specimens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No specimens found
                </TableCell>
              </TableRow>
            ) : (
              specimens.map((specimen) => (
                <TableRow key={specimen.id} hover>
                  <TableCell padding="checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSpecimens.includes(specimen.id)}
                      onChange={() => handleSelectSpecimen(specimen.id)}
                    />
                  </TableCell>
                  <TableCell>{specimen.specimen_number || '—'}</TableCell>
                  <TableCell>{specimen.tube_id || '—'}</TableCell>
                  <TableCell>{getLocationString(specimen) || '—'}</TableCell>
                  <TableCell>{specimen.specimen_type || '—'}</TableCell>
                  <TableCell>{formatDate(specimen.date_collected) || '—'}</TableCell>
                  <TableCell>
                    <Box>
                      {specimen.project_number && (
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {specimen.project_number} - {specimen.disease || 'Unnamed Project'}
                        </Typography>
                      )}
                      {!specimen.project_number && (
                        <Typography variant="body2">
                          {specimen.disease || '—'}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      component={Link}
                      to={`/specimens/${specimen.id}`}
                      title="View"
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                    {canEdit && (
                      <>
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/specimens/edit/${specimen.id}`}
                          title="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteSpecimen(specimen.id)}
                          title="Delete"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Bottom Pagination */}
      <PaginationControls className="bottom-pagination" />

      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        selectedSpecimens={selectedSpecimens}
        searchTerm={debouncedSearchTerm}
        bulkIdText={bulkIdText}
      />

      <SpecimenImport
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImportComplete={handleImportComplete}
      />


      {/* Metadata Filter Dialog */}
      <Dialog open={metadataFilterOpen} onClose={() => setMetadataFilterOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterIcon />
            Filter by Metadata
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Better metadata tools are available!</strong><br />
              For easier metadata viewing and filtering, use the <strong>Project Detail pages</strong> or <strong>individual specimen pages</strong> where metadata is more contextually organized.
            </Typography>
          </Alert>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Advanced users can filter by metadata using URL parameters like: <code>?metadata.field_name=value</code>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearMetadataFilters} color="inherit">
            Clear All
          </Button>
          <Button onClick={() => setMetadataFilterOpen(false)} variant="contained">
            Apply Filters
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SpecimenList;