import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Alert,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  ListItemText,
  Grid,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewColumn as ViewColumnIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { projectAPI, specimenAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import ProjectMetadataUpload from '../projects/ProjectMetadataUpload';
import EnhancedExportDialog from '../common/EnhancedExportDialog';

const ProjectMetadataView = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isEditor = currentUser?.role === 'editor' || currentUser?.role === 'admin';

  const [project, setProject] = useState(null);
  const [specimens, setSpecimens] = useState([]);
  const [filteredSpecimens, setFilteredSpecimens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metadataFields, setMetadataFields] = useState([]);
  const [fieldAnalytics, setFieldAnalytics] = useState(null);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMetadataFields, setSelectedMetadataFields] = useState([]);
  const [showAllFields, setShowAllFields] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Metadata filters
  const [metadataFilters, setMetadataFilters] = useState({});

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
      fetchSpecimens();
      fetchFieldAnalytics();
    }
  }, [projectId]);

  useEffect(() => {
    applyFilters();
  }, [specimens, searchTerm, metadataFilters, selectedMetadataFields]);

  const fetchProjectData = async () => {
    try {
      const response = await projectAPI.getById(projectId);
      setProject(response.data);
    } catch (err) {
      console.error('Failed to fetch project:', err);
      toast.error('Failed to load project details');
    }
  };

  const fetchSpecimens = async () => {
    try {
      setLoading(true);
      const [specimenRes, metadataFieldsRes] = await Promise.all([
        projectAPI.getSpecimens(projectId),
        specimenAPI.getMetadataFields(projectId)
      ]);
      
      const specimenData = specimenRes.data || [];
      const fieldData = metadataFieldsRes.data || [];
      
      setSpecimens(specimenData);
      setMetadataFields(fieldData);
      
      // Auto-select commonly used metadata fields
      const commonFields = fieldData
        .filter(field => field.usage_frequency > 50) // Used in >50% of specimens
        .slice(0, 5) // Show top 5 by default
        .map(field => field.field_name);
      
      setSelectedMetadataFields(commonFields);
      
    } catch (err) {
      console.error('Failed to fetch specimens:', err);
      toast.error('Failed to load specimen data');
    } finally {
      setLoading(false);
    }
  };

  const fetchFieldAnalytics = async () => {
    try {
      const response = await specimenAPI.getMetadataAnalytics(projectId);
      setFieldAnalytics(response.data);
    } catch (err) {
      console.error('Failed to fetch field analytics:', err);
      // Don't show error toast as this is optional enhancement
    }
  };

  const applyFilters = () => {
    let filtered = specimens;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(specimen => 
        specimen.tube_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        specimen.specimen_number?.toString().includes(searchTerm) ||
        JSON.stringify(specimen.metadata || {}).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Metadata filters
    Object.entries(metadataFilters).forEach(([field, value]) => {
      if (value) {
        const fieldType = getFieldType(field);
        
        // Handle array values (multi-select for categorical)
        if (Array.isArray(value) && value.length > 0) {
          filtered = filtered.filter(specimen =>
            specimen.metadata && 
            specimen.metadata[field] && 
            value.includes(specimen.metadata[field])
          );
        }
        // Handle string values (text input)
        else if (typeof value === 'string' && value.trim()) {
          filtered = filtered.filter(specimen => {
            if (!specimen.metadata || !specimen.metadata[field]) return false;
            
            const fieldValue = specimen.metadata[field];
            
            // Use numerical filtering for numeric fields
            if (fieldType === 'numeric') {
              return evaluateNumericalFilter(fieldValue, value);
            }
            
            // Use text search for other field types
            return fieldValue.toLowerCase().includes(value.toLowerCase());
          });
        }
      }
    });

    setFilteredSpecimens(filtered);
    setPage(0); // Reset pagination
  };

  const handleMetadataFieldToggle = (field) => {
    setSelectedMetadataFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    fetchSpecimens(); // Refresh data
    toast.success('Metadata uploaded successfully');
  };

  const getDisplayedMetadataFields = () => {
    if (showAllFields) {
      return metadataFields.map(f => f.field_name);
    }
    return selectedMetadataFields;
  };

  const getFieldUsageStats = (fieldName) => {
    const field = metadataFields.find(f => f.field_name === fieldName);
    return field ? {
      usage: parseInt(field.usage_count) || 0,
      percentage: parseFloat(field.usage_frequency) || 0,
      uniqueValues: parseInt(field.unique_values) || 0
    } : null;
  };

  // Get field type from analytics data
  const getFieldType = (fieldName) => {
    if (!fieldAnalytics?.fields) return 'text';
    const fieldInfo = fieldAnalytics.fields.find(f => f.fieldName === fieldName);
    return fieldInfo?.fieldType || 'text';
  };

  // Get unique values for categorical fields
  const getFieldUniqueValues = (fieldName) => {
    if (!fieldAnalytics?.fields) return [];
    const fieldInfo = fieldAnalytics.fields.find(f => f.fieldName === fieldName);
    if (fieldInfo?.fieldType === 'categorical' && fieldInfo?.distribution) {
      return fieldInfo.distribution.map(d => d.value).slice(0, 20); // Limit to 20 values
    }
    return [];
  };

  // Parse and evaluate numerical filter expressions
  const evaluateNumericalFilter = (value, filterExpression) => {
    if (!filterExpression || !filterExpression.trim()) return true;
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return false;
    
    const expr = filterExpression.trim();
    
    // Handle range expressions like "12-60" or "12 - 60"
    const rangeMatch = expr.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      return numValue >= min && numValue <= max;
    }
    
    // Handle comparison expressions like "<36", ">=12", "!24"
    const comparisonMatch = expr.match(/^(<=|>=|<|>|!=|!|=)?\s*(\d+(?:\.\d+)?)$/);
    if (comparisonMatch) {
      const operator = comparisonMatch[1] || '=';
      const filterValue = parseFloat(comparisonMatch[2]);
      
      switch (operator) {
        case '<': return numValue < filterValue;
        case '<=': return numValue <= filterValue;
        case '>': return numValue > filterValue;
        case '>=': return numValue >= filterValue;
        case '!=':
        case '!': return numValue !== filterValue;
        case '=':
        default: return numValue === filterValue;
      }
    }
    
    // Handle comma-separated values like "12,24,36"
    if (expr.includes(',')) {
      const values = expr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      return values.includes(numValue);
    }
    
    // Default: exact match
    const filterValue = parseFloat(expr);
    return !isNaN(filterValue) && numValue === filterValue;
  };

  // Handle metadata filter change for different field types
  const handleMetadataFilterChange = (field, value) => {
    setMetadataFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box my={4}>
        <Alert severity="error">Project not found</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/metadata')}
          sx={{ mt: 2 }}
        >
          Back to Metadata
        </Button>
      </Box>
    );
  }

  const displayedFields = getDisplayedMetadataFields();
  const paginatedSpecimens = filteredSpecimens.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box className="project-metadata-view page-container">
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton onClick={() => navigate('/metadata')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            {project.disease || `Project ${project.id}`} - Metadata
          </Typography>
        </Box>
        
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchSpecimens}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => setExportDialogOpen(true)}
            sx={{ mr: 1 }}
          >
            Export
          </Button>
          {isEditor && (
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Metadata
            </Button>
          )}
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h5" color="primary">
                {specimens.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Specimens
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h5" color="success.main">
                {specimens.filter(s => s.metadata && Object.keys(s.metadata).length > 0).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                With Metadata
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h5" color="info.main">
                {metadataFields.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Metadata Fields
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h5" color="secondary.main">
                {filteredSpecimens.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Filtered Results
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <TextField
            placeholder="Search specimens and metadata..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
            }}
            sx={{ flexGrow: 1 }}
          />
          
          <Button
            startIcon={<FilterIcon />}
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            endIcon={filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            Filters
          </Button>
          
          <Button
            startIcon={<ViewColumnIcon />}
            onClick={() => setShowAllFields(!showAllFields)}
            variant={showAllFields ? "contained" : "outlined"}
          >
            {showAllFields ? 'Show Selected' : 'Show All Fields'}
          </Button>
        </Box>

        <Collapse in={filtersExpanded}>
          <Divider sx={{ mb: 2 }} />
          
          {/* Field Selection */}
          <Typography variant="subtitle2" gutterBottom>
            Select Metadata Fields to Display:
          </Typography>
          <Box sx={{ mb: 2, maxHeight: 150, overflow: 'auto' }}>
            <FormGroup row>
              {metadataFields.map((field) => {
                const stats = getFieldUsageStats(field.field_name);
                return (
                  <FormControlLabel
                    key={field.field_name}
                    control={
                      <Checkbox
                        checked={selectedMetadataFields.includes(field.field_name)}
                        onChange={() => handleMetadataFieldToggle(field.field_name)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">
                          {field.field_name}
                        </Typography>
                        {stats && (
                          <Typography variant="caption" color="text.secondary">
                            {stats.usage} specimens ({stats.percentage.toFixed(1)}%)
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                );
              })}
            </FormGroup>
          </Box>

          {/* Metadata Filters */}
          {selectedMetadataFields.length > 0 && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Filter by Metadata Values:
              </Typography>
              <Grid container spacing={2}>
                {selectedMetadataFields.slice(0, 6).map((field) => {
                  const fieldType = getFieldType(field);
                  const uniqueValues = getFieldUniqueValues(field);
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} key={field}>
                      {fieldType === 'categorical' && uniqueValues.length > 0 ? (
                        <FormControl size="small" fullWidth>
                          <InputLabel>{`Filter by ${field}`}</InputLabel>
                          <Select
                            multiple
                            value={metadataFilters[field] || []}
                            onChange={(e) => handleMetadataFilterChange(field, e.target.value)}
                            input={<OutlinedInput label={`Filter by ${field}`} />}
                            renderValue={(selected) => (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map((value) => (
                                  <Chip key={value} label={value} size="small" />
                                ))}
                              </Box>
                            )}
                          >
                            {uniqueValues.map((value) => (
                              <MenuItem key={value} value={value}>
                                <Checkbox 
                                  checked={(metadataFilters[field] || []).indexOf(value) > -1}
                                />
                                <ListItemText primary={value} />
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          label={`Filter by ${field} (${fieldType})`}
                          value={metadataFilters[field] || ''}
                          onChange={(e) => handleMetadataFilterChange(field, e.target.value)}
                          size="small"
                          fullWidth
                          placeholder={
                            fieldType === 'numeric' ? 'e.g. <36, >=12, 12-60, 12,24,36' :
                            fieldType === 'temporal' ? 'Enter date' :
                            'Enter text to search'
                          }
                          helperText={
                            fieldType === 'numeric' ? 'Supports: <, <=, >, >=, !=, ranges (12-60), lists (12,24,36)' :
                            fieldType === 'temporal' ? 'Enter date or date range' :
                            'Case-insensitive text search'
                          }
                        />
                      )}
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}
        </Collapse>
      </Paper>

      {/* Metadata Table */}
      <Paper elevation={2}>
        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Specimen ID</TableCell>
                <TableCell>Tube ID</TableCell>
                {displayedFields.map((field) => (
                  <TableCell key={field}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {field}
                      {(() => {
                        const stats = getFieldUsageStats(field);
                        return stats && (
                          <Tooltip title={`Used in ${stats.usage} specimens (${stats.percentage.toFixed(1)}%)`}>
                            <Chip
                              label={stats.usage}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          </Tooltip>
                        );
                      })()}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedSpecimens.map((specimen) => (
                <TableRow key={specimen.id} hover>
                  <TableCell>{specimen.specimen_number || specimen.id}</TableCell>
                  <TableCell>{specimen.tube_id}</TableCell>
                  {displayedFields.map((field) => (
                    <TableCell key={`${specimen.id}-${field}`}>
                      {specimen.metadata && specimen.metadata[field] ? (
                        <Chip
                          label={specimen.metadata[field]}
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              
              {paginatedSpecimens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2 + displayedFields.length} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">
                      {filteredSpecimens.length === 0 ? 
                        (specimens.length === 0 ? 'No specimens found' : 'No specimens match the current filters') :
                        'No data to display'
                      }
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          component="div"
          count={filteredSpecimens.length}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      {/* Dialogs */}
      <ProjectMetadataUpload
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        project={project}
        onSuccess={handleUploadSuccess}
      />

      <EnhancedExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        defaultFilters={{ projectId: projectId }}
        title={`Export Data - ${project.disease || 'Project'}`}
      />
    </Box>
  );
};

export default ProjectMetadataView;