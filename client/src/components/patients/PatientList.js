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
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { patientAPI } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';

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

const PatientList = () => {
  const [patients, setPatients] = useState([]);
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
  
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const canEdit = canEditLabData(currentUser);

  // Pagination component
  const PaginationControls = ({ className = '' }) => {
    if (pagination.totalPages <= 1) {
      return null;
    }

    return (
      <Box className={className} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, my: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Page {pagination.page} of {pagination.totalPages} ({pagination.total} total patients)
        </Typography>
        <Pagination
          count={pagination.totalPages}
          page={pagination.page}
          onChange={(event, page) => fetchPatients(page, debouncedSearchTerm)}
          disabled={loading || searchLoading}
          color="primary"
          showFirstButton
          showLastButton
        />
      </Box>
    );
  };
  
  // Debounce search term to avoid too many API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchPatients = useCallback(async (page = 1, search = '') => {
    try {
      const loadingState = search !== debouncedSearchTerm ? 'search' : 'page';
      if (loadingState === 'search') {
        setSearchLoading(true);
      } else {
        setLoading(true);
      }
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (search?.trim()) {
        params.append('search', search.trim());
      }
      
      const response = await patientAPI.getAll(`?${params.toString()}`);
      
      // Handle both old and new API response formats
      if (response.data.patients) {
        // New paginated format
        setPatients(response.data.patients);
        setPagination(response.data.pagination);
      } else {
        // Old format (fallback)
        setPatients(response.data);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching patients', err);
      setError('Failed to load patients');
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, [pagination.limit, debouncedSearchTerm]);

  // Initial fetch
  useEffect(() => {
    fetchPatients(1, '');
  }, []);

  // Fetch when debounced search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) return; // Only trigger when debounce is complete
    fetchPatients(1, debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchPatients]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    // Reset to page 1 when searching
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleDeletePatient = async (id) => {
    if (!window.confirm('Are you sure you want to delete this patient?')) {
      return;
    }

    try {
      await patientAPI.delete(id);
      toast.success('Patient deleted successfully');
      // Refresh the current page
      fetchPatients(pagination.page, debouncedSearchTerm);
    } catch (err) {
      console.error('Error deleting patient', err);
      if (err.response?.data?.msg) {
        toast.error(err.response.data.msg);
      } else {
        toast.error('Failed to delete patient');
      }
    }
  };

  return (
    <Box className="patient-list page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Patients
        </Typography>
        {canEdit && (
          <Button
            component={Link}
            to="/patients/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
          >
            New Patient
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
          label="Search Patients"
          variant="outlined"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Search by ID, name, diagnosis, or medical record number"
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

      {/* Top Pagination Controls */}
      <PaginationControls />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Patient Number</TableCell>
              <TableCell>External ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Date of Birth</TableCell>
              <TableCell>Diagnosis</TableCell>
              <TableCell>Physician</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Skeleton loading rows
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton animation="wave" width="40%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="60%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="80%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="50%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="70%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="90%" /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {searchTerm ? 'No patients match your search' : 'No patients found'}
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => (
                <TableRow key={patient.id} hover>
                  <TableCell>
                    {patient.patient_number ? `#${patient.patient_number}` : '—'}
                  </TableCell>
                  <TableCell>{patient.external_id || '—'}</TableCell>
                  <TableCell>
                    {patient.first_name || patient.last_name ? 
                      `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : 
                      '—'}
                  </TableCell>
                  <TableCell>{patient.date_of_birth || '—'}</TableCell>
                  <TableCell>{patient.diagnosis || '—'}</TableCell>
                  <TableCell>
                    {patient.physician_first_name || patient.physician_last_name ? 
                      `${patient.physician_first_name || ''} ${patient.physician_last_name || ''}`.trim() : 
                      '—'}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      component={Link}
                      to={`/patients/${patient.id}`}
                      title="View"
                    >
                      <ViewIcon fontSize="small" />
                    </IconButton>
                    {canEdit && (
                      <>
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/patients/edit/${patient.id}`}
                          title="Edit"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {isAdmin && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeletePatient(patient.id)}
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

      {/* Bottom Pagination Controls */}
      <PaginationControls />
    </Box>
  );
};

export default PatientList;