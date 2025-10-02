import React, { useState, useEffect, useCallback } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Link as MuiLink,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  GetApp as ExportIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { collaboratorAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

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

const CollaboratorList = () => {
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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
  
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isLabManager = currentUser?.role === 'lab_manager';
  const isLabTechnician = currentUser?.role === 'lab_technician';
  const canEdit = isAdmin || isLabManager || isLabTechnician;

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
            {pagination.limit === 10000 ? `${pagination.total} collaborators` : `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)`}
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
              onChange={(event, page) => fetchCollaborators(page, debouncedSearchTerm)}
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

  const fetchCollaborators = useCallback(async (page = 1, search = '', customLimit = null) => {
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
      }

      const response = await collaboratorAPI.getAll(`?${params.toString()}`);

      // Handle both old and new API response formats
      if (response.data.collaborators) {
        // New paginated format
        setCollaborators(response.data.collaborators);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination,
          limit: currentLimit // Keep the current limit
        }));
      } else {
        // Old format (fallback)
        setCollaborators(response.data);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching collaborators', err);
      setError('Failed to load collaborators');
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, [debouncedSearchTerm]); // Remove pagination.limit dependency

  // Initial fetch
  useEffect(() => {
    fetchCollaborators(1, '');
  }, []);

  // Fetch when debounced search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) return; // Only trigger when debounce is complete
    fetchCollaborators(1, debouncedSearchTerm);
  }, [debouncedSearchTerm]); // Remove fetchCollaborators dependency to prevent loops

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    // Reset to page 1 when searching
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDeleteCollaborator = async (id) => {
    if (!window.confirm('Are you sure you want to delete this collaborator? This will also delete all associated projects and specimens.')) {
      return;
    }

    try {
      await collaboratorAPI.delete(id);
      toast.success('Collaborator deleted successfully');
      // Refresh the current page
      fetchCollaborators(pagination.page, debouncedSearchTerm);
    } catch (err) {
      console.error('Error deleting collaborator', err);
      toast.error('Failed to delete collaborator');
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

      const response = await fetch(`/api/export/collaborators/excel?${params.toString()}`, {
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
      a.download = response.headers.get('content-disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'collaborators_export.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Collaborators exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export collaborators');
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

    // Use the updated fetchCollaborators with the new limit
    fetchCollaborators(1, debouncedSearchTerm, newLimit);
  };

  return (
    <Box className="collaborator-list page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Collaborators
        </Typography>
        {canEdit && (
          <Button
            component={Link}
            to="/collaborators/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
          >
            New Collaborator
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          label="Search Collaborators"
          variant="outlined"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Search by ID, PI name, institution, IRB ID, or email"
          InputProps={{
            endAdornment: searchLoading ? <CircularProgress size={20} /> : <SearchIcon color="action" />,
          }}
        />
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
              <TableCell>Collaborator Number</TableCell>
              <TableCell>Internal Contact</TableCell>
              <TableCell>PI Name</TableCell>
              <TableCell>Projects</TableCell>
              <TableCell>Institution</TableCell>
              <TableCell>PI Email</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Skeleton loading rows
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton animation="wave" width="40%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="70%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="80%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="90%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="90%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="70%" /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : collaborators.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {searchTerm ? 'No collaborators match your search' : 'No collaborators found'}
                </TableCell>
              </TableRow>
            ) : (
              collaborators.map((collaborator) => {
                // Parse projects from JSON if it exists
                const projects = Array.isArray(collaborator.projects) ? collaborator.projects : [];

                return (
                  <TableRow key={collaborator.id} hover>
                    <TableCell>
                      {collaborator.collaborator_number === 0 || collaborator.collaborator_number === null
                        ? 'Unknown'
                        : collaborator.collaborator_number || '—'}
                    </TableCell>
                    <TableCell>{collaborator.internal_contact || '—'}</TableCell>
                    <TableCell>{collaborator.pi_name}</TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      {projects.length > 0 ? (
                        projects.map((project, index) => (
                          <span key={project.id}>
                            <MuiLink
                              component={Link}
                              to={`/projects/${project.id}`}
                              sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {project.project_number || '—'}
                            </MuiLink>
                            {' '}({project.specimen_count})
                            {index < projects.length - 1 && ', '}
                          </span>
                        ))
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{collaborator.pi_institute}</TableCell>
                    <TableCell>
                      {collaborator.pi_email ? (
                        <MuiLink href={`mailto:${collaborator.pi_email}`}>
                          {collaborator.pi_email}
                        </MuiLink>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        component={Link}
                        to={`/collaborators/${collaborator.id}`}
                        title="View"
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      {canEdit && (
                        <>
                          <IconButton
                            size="small"
                            component={Link}
                            to={`/collaborators/edit/${collaborator.id}`}
                            title="Edit"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          {isAdmin && (
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteCollaborator(collaborator.id)}
                              title="Delete"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Bottom Pagination */}
      <PaginationControls className="bottom-pagination" />
    </Box>
  );
};

export default CollaboratorList;