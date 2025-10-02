import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Link as MuiLink,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowBack, Delete } from '@mui/icons-material';
import axios from 'axios';

const SequencingRunDetail = () => {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRunDetails();
  }, [id]);

  const fetchRunDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const [runResponse, samplesResponse] = await Promise.all([
        axios.get(`/api/sequencing/runs/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`/api/sequencing/runs/${id}/samples`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setRun(runResponse.data);
      setSamples(samplesResponse.data);
    } catch (err) {
      console.error('Error fetching run details:', err);
      setError('Failed to load run details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'linked':
        return 'success';
      case 'no_match':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleDeleteRun = async () => {
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/sequencing/runs/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/sequencing');
    } catch (err) {
      console.error('Error deleting run:', err);
      setError('Failed to delete run');
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!run) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="warning">Run not found</Alert>
      </Container>
    );
  }

  const runIdentifier = run.service_request_number || run.flowcell_id || 'Unknown';

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/sequencing')} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Sequencing Run: {runIdentifier}
        </Typography>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Delete />}
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Run
        </Button>
      </Box>

      {/* Run Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Run Information</Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Service Request:</strong> {run.service_request_number || 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Flowcell ID:</strong> {run.flowcell_id || 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Pool Name:</strong> {run.pool_name || 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Sequencer:</strong> {run.sequencer_type || 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Completion Date:</strong> {formatDate(run.completion_date)}
                </Typography>
                {run.base_directory && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    <strong>Base Directory:</strong> {run.base_directory}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Sample Statistics</Typography>
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Total Samples:</Typography>
                  <Chip label={samples.length} color="primary" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Linked:</Typography>
                  <Chip
                    label={samples.filter(s => s.link_status === 'linked').length}
                    color="success"
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">No Match:</Typography>
                  <Chip
                    label={samples.filter(s => s.link_status === 'no_match').length}
                    color="warning"
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Failed:</Typography>
                  <Chip
                    label={samples.filter(s => s.link_status === 'failed').length}
                    color="error"
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Notes Section */}
      {run.notes && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Notes</Typography>
          <Typography variant="body2">{run.notes}</Typography>
        </Paper>
      )}

      {/* Samples Table */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Samples</Typography>

        {samples.length === 0 ? (
          <Alert severity="info">No samples found for this run.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Facility Sample Name</TableCell>
                  <TableCell>WUID</TableCell>
                  <TableCell>Library ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Specimen</TableCell>
                  <TableCell>FASTQ Files</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {samples.map((sample) => (
                  <TableRow key={sample.id} hover>
                    <TableCell>{sample.facility_sample_name || 'N/A'}</TableCell>
                    <TableCell>{sample.wuid || 'N/A'}</TableCell>
                    <TableCell>{sample.library_id || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip
                        label={sample.link_status || 'unknown'}
                        color={getStatusColor(sample.link_status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {sample.specimen_id ? (
                        <MuiLink
                          component="button"
                          variant="body2"
                          onClick={() => navigate(`/specimens/${sample.specimen_id}`)}
                        >
                          View Specimen
                        </MuiLink>
                      ) : (
                        'Not Linked'
                      )}
                    </TableCell>
                    <TableCell>
                      {sample.fastq_r1_path && (
                        <Typography variant="caption" display="block">
                          R1: {sample.fastq_r1_path.split('/').pop()}
                        </Typography>
                      )}
                      {sample.fastq_r2_path && (
                        <Typography variant="caption" display="block">
                          R2: {sample.fastq_r2_path.split('/').pop()}
                        </Typography>
                      )}
                      {!sample.fastq_r1_path && !sample.fastq_r2_path && 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Sequencing Run?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this sequencing run ({runIdentifier})?
            This will also delete all {samples.length} associated samples. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteRun} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SequencingRunDetail;