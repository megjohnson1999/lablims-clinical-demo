import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  FormGroup,
  FormControlLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { projectAPI, specimenAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import EnhancedExportDialog from '../common/EnhancedExportDialog';

const MetadataSearch = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Data state
  const [projects, setProjects] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [metadataFields, setMetadataFields] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search state
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [metadataFilters, setMetadataFilters] = useState({});
  const [advancedFiltersExpanded, setAdvancedFiltersExpanded] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // UI state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjects.length > 0) {
      fetchMetadataFields();
    } else {
      setMetadataFields([]);
    }
  }, [selectedProjects]);

  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getAll();
      const projectsData = response.data.projects || response.data;
      setProjects(projectsData);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      toast.error('Failed to load projects');
    }
  };

  const fetchMetadataFields = async () => {
    try {
      // Get metadata fields from all selected projects
      const fieldPromises = selectedProjects.map(projectId =>
        specimenAPI.getMetadataFields(projectId)
      );
      
      const fieldResponses = await Promise.all(fieldPromises);
      
      // Combine and deduplicate metadata fields
      const allFields = fieldResponses.flatMap(response => response.data || []);
      const uniqueFields = allFields.reduce((unique, field) => {
        const existing = unique.find(f => f.field_name === field.field_name);
        if (!existing) {
          unique.push(field);
        } else {
          // Combine usage statistics
          existing.usage_count = (existing.usage_count || 0) + (field.usage_count || 0);
          existing.usage_frequency = Math.max(existing.usage_frequency || 0, field.usage_frequency || 0);
        }
        return unique;
      }, []);

      setMetadataFields(uniqueFields.sort((a, b) => (b.usage_frequency || 0) - (a.usage_frequency || 0)));
    } catch (err) {
      console.error('Failed to fetch metadata fields:', err);
      toast.error('Failed to load metadata fields');
    }
  };

  const performSearch = useCallback(async () => {
    if (selectedProjects.length === 0) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);

      // Search specimens across selected projects
      const searchPromises = selectedProjects.map(async (projectId) => {
        const response = await projectAPI.getSpecimens(projectId);
        const specimens = response.data || [];
        
        // Apply filters
        return specimens
          .filter(specimen => {
            // Text search filter
            if (searchTerm) {
              const searchableText = [
                specimen.tube_id,
                specimen.specimen_number?.toString(),
                JSON.stringify(specimen.metadata || {})
              ].join(' ').toLowerCase();
              
              if (!searchableText.includes(searchTerm.toLowerCase())) {
                return false;
              }
            }

            // Metadata filters
            return Object.entries(metadataFilters).every(([field, value]) => {
              if (!value || !value.trim()) return true;
              
              const metadataValue = specimen.metadata?.[field];
              if (!metadataValue) return false;
              
              return metadataValue.toLowerCase().includes(value.toLowerCase());
            });
          })
          .map(specimen => ({
            ...specimen,
            projectId: projectId,
            project: projects.find(p => p.id === projectId)
          }));
      });

      const results = await Promise.all(searchPromises);
      const flatResults = results.flat();
      
      setSearchResults(flatResults);
      setPage(0); // Reset pagination
      
    } catch (err) {
      console.error('Search failed:', err);
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedProjects, searchTerm, metadataFilters, projects]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch();
    }, 500); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [performSearch]);

  const handleProjectSelection = (projectId, checked) => {
    setSelectedProjects(prev => 
      checked 
        ? [...prev, projectId]
        : prev.filter(id => id !== projectId)
    );
  };

  const handleMetadataFilterChange = (field, value) => {
    setMetadataFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setMetadataFilters({});
    setSelectedProjects([]);
  };

  const getDisplayedMetadataFields = () => {
    return metadataFields.slice(0, 8); // Show top 8 most common fields
  };

  const paginatedResults = searchResults.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box className="metadata-search page-container">
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" display="flex" alignItems="center">
          <SearchIcon sx={{ mr: 2 }} />
          Advanced Metadata Search
        </Typography>
        
        <Box>
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={clearAllFilters}
            sx={{ mr: 1 }}
            disabled={selectedProjects.length === 0 && !searchTerm && Object.keys(metadataFilters).length === 0}
          >
            Clear All
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => setExportDialogOpen(true)}
            disabled={searchResults.length === 0}
          >
            Export Results
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Search Filters */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom display="flex" alignItems="center">
              <FilterIcon sx={{ mr: 1 }} />
              Search Filters
            </Typography>

            {/* Project Selection */}
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              Select Projects
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
              <FormGroup>
                {projects.map((project) => (
                  <FormControlLabel
                    key={project.id}
                    control={
                      <Checkbox
                        checked={selectedProjects.includes(project.id)}
                        onChange={(e) => handleProjectSelection(project.id, e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">
                          {project.disease || `Project ${project.id}`}
                        </Typography>
                        {project.pi_name && (
                          <Typography variant="caption" color="text.secondary">
                            {project.pi_name}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
            </Box>

            {selectedProjects.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                
                {/* Text Search */}
                <TextField
                  fullWidth
                  label="Search text"
                  placeholder="Search in specimen IDs, tube IDs, and metadata..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                  }}
                  sx={{ mb: 2 }}
                />

                {/* Metadata Filters */}
                {metadataFields.length > 0 && (
                  <Accordion 
                    expanded={advancedFiltersExpanded}
                    onChange={() => setAdvancedFiltersExpanded(!advancedFiltersExpanded)}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">
                        Metadata Filters ({Object.keys(metadataFilters).filter(k => metadataFilters[k]).length} active)
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        {getDisplayedMetadataFields().map((field) => (
                          <Grid item xs={12} key={field.field_name}>
                            <TextField
                              fullWidth
                              size="small"
                              label={field.field_name}
                              value={metadataFilters[field.field_name] || ''}
                              onChange={(e) => handleMetadataFilterChange(field.field_name, e.target.value)}
                              helperText={`Used in ${field.usage_frequency?.toFixed(1)}% of specimens`}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                )}
              </>
            )}
          </Paper>
        </Grid>

        {/* Search Results */}
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" display="flex" alignItems="center">
                <AssessmentIcon sx={{ mr: 1 }} />
                Search Results
              </Typography>
              
              {!loading && searchResults.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {searchResults.length} specimens found across {selectedProjects.length} projects
                </Typography>
              )}
            </Box>

            {selectedProjects.length === 0 ? (
              <Alert severity="info">
                Select one or more projects to begin searching
              </Alert>
            ) : loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Searching...</Typography>
              </Box>
            ) : searchResults.length === 0 ? (
              <Alert severity="info">
                No specimens found matching your search criteria
              </Alert>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Project</TableCell>
                        <TableCell>Specimen ID</TableCell>
                        <TableCell>Tube ID</TableCell>
                        <TableCell>Metadata Fields</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedResults.map((specimen) => (
                        <TableRow key={`${specimen.projectId}-${specimen.id}`} hover>
                          <TableCell>
                            <Typography variant="body2">
                              {specimen.project?.disease || `Project ${specimen.projectId}`}
                            </Typography>
                          </TableCell>
                          <TableCell>{specimen.specimen_number || specimen.id}</TableCell>
                          <TableCell>{specimen.tube_id}</TableCell>
                          <TableCell>
                            <Box display="flex" flexWrap="wrap" gap={0.5}>
                              {specimen.metadata && Object.keys(specimen.metadata).length > 0 ? (
                                Object.entries(specimen.metadata).slice(0, 3).map(([key, value]) => (
                                  <Chip
                                    key={key}
                                    label={`${key}: ${value}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No metadata
                                </Typography>
                              )}
                              {specimen.metadata && Object.keys(specimen.metadata).length > 3 && (
                                <Chip 
                                  label={`+${Object.keys(specimen.metadata).length - 3} more`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="View in project">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/metadata/${specimen.projectId}`)}
                              >
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                <TablePagination
                  component="div"
                  count={searchResults.length}
                  page={page}
                  onPageChange={(event, newPage) => setPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(parseInt(event.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                />
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Export Dialog */}
      <EnhancedExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        defaultFilters={{ 
          projectId: selectedProjects.length === 1 ? selectedProjects[0] : undefined 
        }}
        title="Export Search Results"
      />
    </Box>
  );
};

export default MetadataSearch;