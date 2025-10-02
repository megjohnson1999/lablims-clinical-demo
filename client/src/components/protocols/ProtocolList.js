import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
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
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  Assessment as StatsIcon,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';

const ProtocolList = () => {
  const [protocols, setProtocols] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [protocolToDelete, setProtocolToDelete] = useState(null);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const canEdit = canEditLabData(currentUser);

  const fetchProtocols = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        is_active: showInactive ? 'all' : 'true',
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`/api/protocols?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch protocols');
      }

      const data = await response.json();
      setProtocols(data.protocols || []);
      setTotalCount(data.totalCount || 0);
      setError('');
    } catch (err) {
      console.error('Error fetching protocols:', err);
      setError('Failed to load protocols');
      setProtocols([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProtocols();
  }, [page, showInactive, searchTerm]);

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleDeleteClick = (protocol) => {
    setProtocolToDelete(protocol);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!protocolToDelete) return;

    try {
      const response = await fetch(`/api/protocols/${protocolToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete protocol');
      }

      const result = await response.json();
      toast.success(result.msg || 'Protocol deleted successfully');
      fetchProtocols();
    } catch (err) {
      console.error('Error deleting protocol:', err);
      toast.error('Failed to delete protocol');
    } finally {
      setDeleteDialogOpen(false);
      setProtocolToDelete(null);
    }
  };

  const handleDuplicate = async (protocol) => {
    try {
      const response = await fetch(`/api/protocols/${protocol.id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          name: `${protocol.name} (Copy)`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate protocol');
      }

      const duplicatedProtocol = await response.json();
      toast.success('Protocol duplicated successfully');
      navigate(`/protocols/${duplicatedProtocol.id}/edit`);
    } catch (err) {
      console.error('Error duplicating protocol:', err);
      toast.error('Failed to duplicate protocol');
    }
  };

  if (loading && protocols.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Protocol Management
        </Typography>
        {canEdit && (
          <Button
            component={Link}
            to="/protocols/new"
            variant="contained"
            startIcon={<AddIcon />}
          >
            New Protocol
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Search protocols"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
            }}
            sx={{ minWidth: 250 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
            }
            label="Show inactive protocols"
          />
          <Button
            component={Link}
            to="/protocols/usage-stats"
            variant="outlined"
            startIcon={<StatsIcon />}
            size="small"
          >
            Usage Statistics
          </Button>
        </Box>
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Reagents</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : protocols.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No protocols found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                protocols.map((protocol) => (
                  <TableRow key={protocol.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="medium">
                        {protocol.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(protocol.updated_at || protocol.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {protocol.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${protocol.required_reagents?.length || 0} reagents`}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={protocol.is_active ? 'Active' : 'Inactive'}
                        size="small"
                        color={protocol.is_active ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {protocol.created_by_first_name} {protocol.created_by_last_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        @{protocol.created_by_username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(protocol.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            component={Link}
                            to={`/protocols/${protocol.id}`}
                            size="small"
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {canEdit && (
                          <>
                            <Tooltip title="Edit">
                              <IconButton
                                component={Link}
                                to={`/protocols/${protocol.id}/edit`}
                                size="small"
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Duplicate">
                              <IconButton
                                onClick={() => handleDuplicate(protocol)}
                                size="small"
                              >
                                <DuplicateIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {isAdmin && (
                          <Tooltip title="Delete">
                            <IconButton
                              onClick={() => handleDeleteClick(protocol)}
                              size="small"
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {totalCount > limit && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <Pagination
              count={Math.ceil(totalCount / limit)}
              page={page}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
              disabled={loading}
            />
          </Box>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Protocol</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the protocol "{protocolToDelete?.name}"? 
            {protocolToDelete && (
              <>
                <br />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Note: If this protocol is used in experiments, it will be deactivated instead of deleted.
                </Typography>
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProtocolList;