import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Pagination,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Upload as UploadIcon,
  GetApp as ExportIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { projectAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import ProjectMetadataUpload from './ProjectMetadataUpload';

// Custom hook for debouncing values
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const ProjectList = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [isExporting, setIsExporting] = useState(false);
  
  // Metadata upload dialog state
  const [metadataUploadOpen, setMetadataUploadOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const canEdit = canEditLabData(currentUser);

  // Pagination component
  const PaginationControls = ({ className = '' }) => {
    return (
      <Box className={className} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, my: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Show</InputLabel>
            <Select
              value={pagination.limit}
              label="Show"
              onChange={handlePageSizeChange}
              disabled={loading || searchLoading}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value={10000}>Show All</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            {pagination.limit === 10000 ? `${pagination.total} projects` : `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)`}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ExportIcon />}
            onClick={handleExport}
            disabled={isExporting || loading}
          >
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </Button>
          {pagination.totalPages > 1 && pagination.limit !== 10000 && (
            <Pagination
              count={pagination.totalPages}
              page={pagination.page}
              onChange={(event, page) => fetchProjects(page, debouncedSearchTerm)}
              disabled={loading || searchLoading}
              color="primary"
              showFirstButton
              showLastButton
            />
          )}
        </Box>
      </Box>
    );
  };
  
  // Debounce search term to avoid too many API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchProjects = useCallback(async (page = 1, search = '', customLimit = null) => {
    try {
      const loadingState = search !== debouncedSearchTerm ? 'search' : 'page';
      if (loadingState === 'search') {
        setSearchLoading(true);
      } else {
        setLoading(true);
      }

      // Use custom limit if provided, otherwise use current pagination limit
      const currentLimit = customLimit || pagination.limit;

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: currentLimit.toString()
      });

      if (search?.trim()) {
        params.append('search', search.trim());
        if (searchField?.trim()) {
          params.append('field', searchField.trim());
        }
      }

      // Add cache-busting parameter to force fresh data
      params.append('_t', Date.now().toString());
      const response = await projectAPI.getAll(`?${params.toString()}`);

      // Handle both old and new API response formats
      if (response.data.projects) {
        // New paginated format
        setProjects(response.data.projects);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination,
          limit: currentLimit // Keep the current limit
        }));
      } else {
        // Old format (fallback)
        setProjects(response.data);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching projects', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, [debouncedSearchTerm]); // Remove pagination.limit dependency

  // Initial fetch
  useEffect(() => {
    fetchProjects(1, '');
  }, []);

  // Fetch when debounced search term or search field changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) return; // Only trigger when debounce is complete
    fetchProjects(1, debouncedSearchTerm);
  }, [debouncedSearchTerm, searchField]); // Remove fetchProjects dependency to prevent loops

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    // Reset to page 1 when searching
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project? This will also delete all associated specimens.')) {
      return;
    }

    try {
      await projectAPI.delete(id);
      toast.success('Project deleted successfully');
      setProjects(projects.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Error deleting project', err);
      toast.error('Failed to delete project');
    }
  };

  const handleExport = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearchTerm?.trim()) {
        params.append('search', debouncedSearchTerm.trim());
      }

      const response = await fetch(`/api/export/projects/excel?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'projects_export.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Projects exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export projects');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePageSizeChange = (event) => {
    const newLimit = parseInt(event.target.value);
    setPagination(prev => ({
      ...prev,
      limit: newLimit,
      page: 1
    }));

    // Use the updated fetchProjects with the new limit
    fetchProjects(1, debouncedSearchTerm, newLimit);
  };

  const handleMetadataUpload = (project) => {
    setSelectedProject(project);
    setMetadataUploadOpen(true);
  };

  return (
    <Box className="project-list page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        {canEdit && (
          <Button
            component={Link}
            to="/projects/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
          >
            New Project
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Search Projects"
            variant="outlined"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Search projects..."
            sx={{ flexGrow: 1 }}
            size="small"
            InputProps={{
              endAdornment: searchLoading ? <CircularProgress size={20} /> : <SearchIcon color="action" />,
            }}
          />
          <FormControl sx={{ minWidth: 180 }} size="small">
            <InputLabel>Search Field</InputLabel>
            <Select
              value={searchField}
              label="Search Field"
              onChange={(e) => setSearchField(e.target.value)}
            >
              <MenuItem value="">All Fields</MenuItem>
              <MenuItem value="project_number">Project Number</MenuItem>
              <MenuItem value="disease">Disease</MenuItem>
              <MenuItem value="specimen_type">Specimen Type</MenuItem>
              <MenuItem value="source">Source</MenuItem>
              <MenuItem value="pi_name">PI Name</MenuItem>
              <MenuItem value="pi_institute">PI Institute</MenuItem>
              <MenuItem value="collaborator_number">Collaborator Number</MenuItem>
            </Select>
          </FormControl>
        </Box>
        {searchLoading && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              Searching...
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Top Pagination */}
      <PaginationControls className="top-pagination" />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Project Number</TableCell>
              <TableCell>Disease</TableCell>
              <TableCell>Specimen Type</TableCell>
              <TableCell>Specimen Count</TableCell>
              <TableCell>PI</TableCell>
              <TableCell>Institution</TableCell>
              <TableCell>Date Received</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Skeleton loading rows
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton animation="wave" width="60%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="80%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="70%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="40%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="90%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="90%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="50%" /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  {searchTerm ? 'No projects match your search' : 'No projects found'}
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
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
                  <TableCell>{project.pi_name || '—'}</TableCell>
                  <TableCell>{project.pi_institute || '—'}</TableCell>
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
                    {canEdit && (
                      <>
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/projects/edit/${project.id}`}
                          title="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleMetadataUpload(project)}
                          title="Upload Metadata"
                        >
                          <UploadIcon fontSize="small" />
                        </IconButton>
                        {isAdmin && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteProject(project.id)}
                            title="Delete"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
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
      
      {/* Metadata Upload Dialog */}
      {metadataUploadOpen && (
        <ProjectMetadataUpload
          open={metadataUploadOpen}
          onClose={() => setMetadataUploadOpen(false)}
          project={selectedProject}
          onSuccess={() => {
            setMetadataUploadOpen(false);
            toast.success('Metadata uploaded successfully');
          }}
        />
      )}
    </Box>
  );
};

export default ProjectList;