import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Edit as EditIcon,
  ContentCopy as DuplicateIcon,
  ArrowBack as BackIcon,
  Science as ExperimentIcon,
  Description as DocumentIcon,
  GetApp as DownloadIcon,
  Visibility as PreviewIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import ExperimentHistoryTable from '../common/ExperimentHistoryTable';

const ProtocolDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [protocol, setProtocol] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [usageStats, setUsageStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewContent, setPreviewContent] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const isEditor = currentUser?.role === 'editor' || currentUser?.role === 'admin';

  useEffect(() => {
    fetchProtocol();
    fetchUsageStats();
    fetchExperiments();
  }, [id]);

  const fetchProtocol = async () => {
    try {
      const response = await fetch(`/api/protocols/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch protocol');
      }

      const data = await response.json();
      setProtocol(data);
    } catch (err) {
      console.error('Error fetching protocol:', err);
      setError('Failed to load protocol');
    }
  };

  const fetchUsageStats = async () => {
    try {
      const response = await fetch('/api/protocols/usage-stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const stats = await response.json();
        const protocolStats = stats.find(stat => stat.protocol_id === id);
        setUsageStats(protocolStats);
      }
    } catch (err) {
      console.error('Error fetching usage stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExperiments = async () => {
    try {
      setExperimentsLoading(true);
      const response = await fetch(`/api/protocols/${id}/experiments`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setExperiments(data.experiments || []);
      } else {
        console.warn('Could not fetch experiments for protocol');
        setExperiments([]);
      }
    } catch (err) {
      console.error('Error fetching protocol experiments:', err);
      setExperiments([]);
    } finally {
      setExperimentsLoading(false);
    }
  };

  const handlePreview = async (doc) => {
    setPreviewDocument(doc);
    setPreviewLoading(true);

    try {
      const response = await fetch(`/api/protocols/documents/${doc.id}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load document');
      }

      // For text files, read as text
      if (doc.mime_type.startsWith('text/')) {
        const text = await response.text();
        setPreviewContent({ type: 'text', content: text });
      }
      // For PDFs, create blob URL for iframe
      else if (doc.mime_type === 'application/pdf') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setPreviewContent({ type: 'pdf', url });
      }
      // For other files (Word, Excel), show download message
      else {
        setPreviewContent({ type: 'unsupported' });
      }
    } catch (err) {
      console.error('Error loading preview:', err);
      toast.error('Failed to load document preview');
      setPreviewDocument(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const response = await fetch(`/api/protocols/documents/${doc.id}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document:', err);
      toast.error('Failed to download document');
    }
  };

  const handleDuplicate = async () => {
    try {
      const response = await fetch(`/api/protocols/${id}/duplicate`, {
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !protocol) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error || 'Protocol not found'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          component={Link}
          to="/protocols"
          startIcon={<BackIcon />}
          sx={{ mr: 2 }}
        >
          Back to Protocols
        </Button>
        <Typography variant="h4" component="h1" sx={{ flexGrow: 1 }}>
          {protocol.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isEditor && (
            <>
              <Button
                component={Link}
                to={`/protocols/${id}/edit`}
                variant="outlined"
                startIcon={<EditIcon />}
              >
                Edit
              </Button>
              <Button
                variant="outlined"
                startIcon={<DuplicateIcon />}
                onClick={handleDuplicate}
              >
                Duplicate
              </Button>
            </>
          )}
          <Button
            component={Link}
            to={`/experiments/new?protocol=${id}`}
            variant="contained"
            startIcon={<ExperimentIcon />}
          >
            Use Protocol
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Protocol Information
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body1">
                  {formatDate(protocol.updated_at || protocol.created_at)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Status
                </Typography>
                <Chip
                  label={protocol.is_active ? 'Active' : 'Inactive'}
                  size="small"
                  color={protocol.is_active ? 'success' : 'default'}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Created By
                </Typography>
                <Typography variant="body1">
                  {protocol.created_by_first_name} {protocol.created_by_last_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  @{protocol.created_by_username}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Created Date
                </Typography>
                <Typography variant="body1">
                  {formatDate(protocol.created_at)}
                </Typography>
              </Grid>
            </Grid>

            {protocol.description && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {protocol.description}
                </Typography>
              </>
            )}

            {protocol.basic_steps && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Protocol Steps
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {protocol.basic_steps}
                </Typography>
              </>
            )}

            {protocol.documents && protocol.documents.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Protocol Documents
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                  {protocol.documents.map((doc) => (
                    <Box key={doc.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DocumentIcon color="action" />
                        <Box>
                          <Typography variant="body2">
                            {doc.original_filename}
                          </Typography>
                          {doc.description && (
                            <Typography variant="caption" color="text.secondary">
                              {doc.description}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Button
                        size="small"
                        startIcon={<PreviewIcon />}
                        onClick={() => handlePreview(doc)}
                      >
                        Preview
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleDownload(doc)}
                      >
                        Download
                      </Button>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Paper>

          {protocol.required_reagents && protocol.required_reagents.length > 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Required Reagents
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Reagent Name</TableCell>
                      <TableCell align="right">Quantity per Sample</TableCell>
                      <TableCell>Unit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {protocol.required_reagents.map((reagent, index) => (
                      <TableRow key={index}>
                        <TableCell>{reagent.name}</TableCell>
                        <TableCell align="right">{reagent.quantity_per_sample}</TableCell>
                        <TableCell>{reagent.unit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Usage Statistics
              </Typography>
              {usageStats ? (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="primary">
                      {usageStats.usage_count || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Uses
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="primary">
                      {usageStats.user_count || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Different Users
                    </Typography>
                  </Grid>
                  {usageStats.last_used && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Last Used
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(usageStats.last_used)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No usage data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Usage History - Specimens */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              Usage History - Specimens ({experiments.length} experiments)
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <ExperimentHistoryTable
              experiments={experiments}
              loading={experimentsLoading}
              showProtocolColumn={false}
              showSpecimenColumn={true}
              emptyMessage="This protocol has not been used in any experiments"
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  component={Link}
                  to={`/experiments?protocol=${id}`}
                  variant="outlined"
                  size="small"
                  fullWidth
                >
                  View Experiments
                </Button>
                <Button
                  component={Link}
                  to={`/inventory/check-availability?protocol=${id}`}
                  variant="outlined"
                  size="small"
                  fullWidth
                >
                  Check Reagent Availability
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Document Preview Dialog */}
      <Dialog
        open={Boolean(previewDocument)}
        onClose={() => setPreviewDocument(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              {previewDocument?.original_filename}
            </Typography>
            <IconButton onClick={() => setPreviewDocument(null)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {previewLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : previewContent?.type === 'text' ? (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                maxHeight: '60vh',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {previewContent.content}
            </Paper>
          ) : previewContent?.type === 'pdf' ? (
            <Box sx={{ width: '100%', height: '70vh' }}>
              <iframe
                src={previewContent.url}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="PDF Preview"
              />
            </Box>
          ) : previewContent?.type === 'unsupported' ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="info">
                Preview not available for {previewDocument?.mime_type?.includes('word') ? 'Word' :
                  previewDocument?.mime_type?.includes('excel') || previewDocument?.mime_type?.includes('spreadsheet') ? 'Excel' :
                  'this file type'}. Please download to view.
              </Alert>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleDownload(previewDocument)}
            startIcon={<DownloadIcon />}
          >
            Download
          </Button>
          <Button onClick={() => setPreviewDocument(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProtocolDetail;