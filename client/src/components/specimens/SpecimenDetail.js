import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { specimenAPI, labelAPI } from '../../services/api';
import { formatDate, getLocationString } from '../../utils/helpers';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import Barcode from '../common/Barcode';
import PrintableLabel from '../labels/PrintableLabel';
import ExperimentHistoryTable from '../common/ExperimentHistoryTable';

const SpecimenDetail = () => {
  const { id } = useParams();
  const [specimen, setSpecimen] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [sequencingData, setSequencingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  const [sequencingLoading, setSequencingLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isEditor = currentUser?.role === 'editor' || isAdmin

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch specimen details
        const specimenResponse = await specimenAPI.getById(id);
        setSpecimen(specimenResponse.data);
        
        // Fetch experiments for this specimen
        setExperimentsLoading(true);
        const experimentsResponse = await fetch(`/api/specimens/${id}/experiments`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        
        if (experimentsResponse.ok) {
          const experimentsData = await experimentsResponse.json();
          setExperiments(experimentsData.experiments || []);
        } else {
          console.warn('Could not fetch experiments for specimen');
          setExperiments([]);
        }

        // Fetch sequencing data for this specimen
        setSequencingLoading(true);
        try {
          const sequencingResponse = await fetch(`/api/sequencing/specimen/${id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });

          if (sequencingResponse.ok) {
            const sequencingDataResult = await sequencingResponse.json();
            setSequencingData(sequencingDataResult || []);
          } else {
            console.warn('Could not fetch sequencing data for specimen');
            setSequencingData([]);
          }
        } catch (seqErr) {
          console.warn('Sequencing data fetch failed:', seqErr);
          setSequencingData([]);
        } finally {
          setSequencingLoading(false);
        }

      } catch (err) {
        console.error('Error fetching specimen data', err);
        setError('Failed to load specimen details');
      } finally {
        setLoading(false);
        setExperimentsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this specimen?')) {
      return;
    }

    try {
      await specimenAPI.delete(id);
      toast.success('Specimen deleted successfully');
      navigate('/specimens');
    } catch (err) {
      console.error('Error deleting specimen', err);
      toast.error('Failed to delete specimen');
    }
  };

  const handlePrintLabel = async () => {
    try {
      const response = await labelAPI.generateLabels([id]);
      toast.success('Label generated successfully');
      // Here you would typically trigger a download or send to printer
      console.log('Label content:', response.data.content);
    } catch (err) {
      console.error('Error generating label', err);
      toast.error('Failed to generate label');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box my={4}>
        <Alert severity="error">{error}</Alert>
        <Button
          component={Link}
          to="/specimens"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Specimens
        </Button>
      </Box>
    );
  }

  if (!specimen) {
    return (
      <Box my={4}>
        <Alert severity="info">Specimen not found</Alert>
        <Button
          component={Link}
          to="/specimens"
          startIcon={<ArrowBackIcon />}
          sx={{ mt: 2 }}
        >
          Back to Specimens
        </Button>
      </Box>
    );
  }

  return (
    <Box className="specimen-detail page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton
            component={Link}
            to="/specimens"
            sx={{ mr: 1 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Specimen {specimen.tube_id || specimen.id.substring(0, 8)}
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintLabel}
            sx={{ mr: 1 }}
          >
            Print Label
          </Button>
          {isEditor && (
            <>
              <Button
                component={Link}
                to={`/specimens/edit/${id}`}
                variant="outlined"
                startIcon={<EditIcon />}
                sx={{ mr: 1 }}
              >
                Edit
              </Button>
              {isAdmin && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Main specimen information */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Specimen Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Tube ID</Typography>
                <Typography variant="body1">{specimen.tube_id || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Date Collected</Typography>
                <Typography variant="body1">{formatDate(specimen.date_collected) || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Specimen Type</Typography>
                <Typography variant="body1">{specimen.specimen_type || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Activity Status</Typography>
                <Typography variant="body1">
                  <Chip 
                    label={specimen.activity_status || 'Active'} 
                    color={specimen.activity_status === 'Inactive' ? 'default' : 'success'} 
                    size="small"
                  />
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Extracted</Typography>
                <Typography variant="body1">{specimen.extracted ? 'Yes' : 'No'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Used Up</Typography>
                <Typography variant="body1">{specimen.used_up ? 'Yes' : 'No'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Initial Quantity</Typography>
                <Typography variant="body1">{specimen.initial_quantity || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Specimen Site</Typography>
                <Typography variant="body1">{specimen.specimen_site || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Collection Category</Typography>
                <Typography variant="body1">{specimen.collection_category || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Run Number</Typography>
                <Typography variant="body1">{specimen.run_number || '—'}</Typography>
              </Grid>
            </Grid>

            {specimen.comments && (
              <Box mt={2}>
                <Typography variant="subtitle2" color="text.secondary">Comments</Typography>
                <Typography variant="body2">{specimen.comments}</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Barcode & Label */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              Barcode & Label
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <Barcode 
                    value={specimen.tube_id || specimen.id}
                    height={80}
                    showValue={true}
                    style={{ backgroundColor: '#fff', p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}
                  />
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Specimen ID: {specimen.tube_id || specimen.id}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PrintIcon />}
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      printWindow.document.write(`
                        <html>
                          <head><title>Specimen Label</title></head>
                          <body style="margin: 0; padding: 20px; font-family: Arial;">
                            <div style="text-align: center;">
                              <h3>Specimen Label</h3>
                              <p>This feature will be implemented with proper React rendering</p>
                              <p><strong>Specimen ID:</strong> ${specimen.tube_id || specimen.id}</p>
                              <p><strong>Disease:</strong> ${specimen.disease || 'N/A'}</p>
                              <p><strong>Type:</strong> ${specimen.specimen_type || 'N/A'}</p>
                            </div>
                          </body>
                        </html>
                      `);
                      printWindow.print();
                      printWindow.close();
                    }}
                  >
                    Print Label
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Sequencing & Analysis Tracking */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              Sequencing & Analysis Tracking
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Sequencing Run ID</Typography>
                <Typography variant="body2">
                  {sequencingData && sequencingData.length > 0
                    ? (sequencingData[0].service_request_number || sequencingData[0].flowcell_id || 'Not specified')
                    : 'Not specified'}
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Analysis Status</Typography>
                <Chip
                  label={specimen.analysis_status || 'pending'}
                  color={
                    specimen.analysis_status === 'completed' ? 'success' :
                    specimen.analysis_status === 'in_progress' ? 'warning' :
                    specimen.analysis_status === 'failed' ? 'error' : 'default'
                  }
                  size="small"
                  sx={{ textTransform: 'capitalize' }}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">FASTQ Location</Typography>
                {sequencingData && sequencingData.length > 0 && sequencingData[0].fastq_r1_path ? (
                  <Box sx={{ p: 1, bgcolor: 'grey.100', borderRadius: 1, mt: 0.5 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                      R1: {sequencingData[0].fastq_r1_path}
                    </Typography>
                    {sequencingData[0].fastq_r2_path && (
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', mt: 0.5 }}>
                        R2: {sequencingData[0].fastq_r2_path}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {specimen.fastq_location || 'Not specified'}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">Results Location</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {specimen.results_location || 'Not specified'}
                </Typography>
              </Grid>

              {specimen.sequencing_notes && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Sequencing Notes</Typography>
                  <Typography variant="body2">{specimen.sequencing_notes}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Location and related information */}
        <Grid item xs={12} md={6}>
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Storage Location
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Freezer</Typography>
                <Typography variant="body1">{specimen.position_freezer || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Rack</Typography>
                <Typography variant="body1">{specimen.position_rack || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Box</Typography>
                <Typography variant="body1">{specimen.position_box || '—'}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">Position</Typography>
                <Typography variant="body1">
                  {specimen.position_dimension_one && specimen.position_dimension_two 
                    ? `${specimen.position_dimension_one}${specimen.position_dimension_two}`
                    : specimen.position_dimension_one || specimen.position_dimension_two || '—'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Related Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="subtitle2" color="text.secondary">Patient</Typography>
            <Typography variant="body1" gutterBottom>
              {specimen.patient_external_id ? (
                <Link to={`/patients/${specimen.patient_id}`}>
                  {specimen.patient_external_id} {specimen.patient_first_name && specimen.patient_last_name 
                    ? `(${specimen.patient_first_name} ${specimen.patient_last_name})` 
                    : ''}
                </Link>
              ) : '—'}
            </Typography>
            
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>Project</Typography>
            <Typography variant="body1" gutterBottom>
              <Link to={`/projects/${specimen.project_id}`}>
                {specimen.disease || 'Unnamed Project'}
              </Link>
            </Typography>
            
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>Collaborator</Typography>
            <Typography variant="body1">
              <Link to={`/collaborators/${specimen.collaborator_id}`}>
                {specimen.pi_name}, {specimen.pi_institute}
              </Link>
            </Typography>
          </Paper>
        </Grid>

        {/* Sequencing Data */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              Sequencing Data ({sequencingData.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {sequencingLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : sequencingData.length > 0 ? (
              <Box>
                {sequencingData.map((seq, idx) => (
                  <Box key={seq.id} sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            Run: {seq.service_request_number || seq.flowcell_id || `#${seq.run_number}`}
                          </Typography>
                          <Chip
                            size="small"
                            label={seq.link_status}
                            color={seq.link_status === 'linked' ? 'success' : 'warning'}
                          />
                        </Box>
                      </Grid>

                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">Library ID</Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                          }}
                        >
                          {seq.library_id || '—'}
                        </Typography>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Typography variant="subtitle2" color="text.secondary">Total Reads</Typography>
                        <Typography variant="body2">
                          {seq.total_reads ? seq.total_reads.toLocaleString() : '—'}
                        </Typography>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Typography variant="subtitle2" color="text.secondary">Q30 R1 / R2</Typography>
                        <Typography variant="body2">
                          {seq.pct_q30_r1 || '—'}% / {seq.pct_q30_r2 || '—'}%
                        </Typography>
                      </Grid>

                      <Grid item xs={12} sm={4}>
                        <Typography variant="subtitle2" color="text.secondary">Completion Date</Typography>
                        <Typography variant="body2">{formatDate(seq.completion_date)}</Typography>
                      </Grid>

                      {seq.fastq_r1_path && (
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            FASTQ Files
                          </Typography>
                          <Box
                            sx={{
                              p: 1.5,
                              bgcolor: 'grey.100',
                              borderRadius: 1,
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              wordBreak: 'break-all',
                              overflowWrap: 'break-word',
                              maxWidth: '100%'
                            }}
                          >
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 0.5 }}>
                              <strong>R1:</strong> {seq.fastq_r1_path}
                            </Typography>
                            {seq.fastq_r2_path && (
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                <strong>R2:</strong> {seq.fastq_r2_path}
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                ))}
              </Box>
            ) : (
              <Alert severity="info">
                This specimen has not been sequenced yet.
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Protocols Performed */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              Protocols Performed ({experiments.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <ExperimentHistoryTable
              experiments={experiments}
              loading={experimentsLoading}
              showProtocolColumn={true}
              showSpecimenColumn={false}
              emptyMessage="No protocols have been performed on this specimen"
            />
          </Paper>
        </Grid>

        {/* Additional specimen details */}
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Technical Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">Extraction Method</Typography>
                <Typography variant="body1">{specimen.extraction_method || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">Nucleated Cells</Typography>
                <Typography variant="body1">{specimen.nucleated_cells || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">Cell Numbers</Typography>
                <Typography variant="body1">{specimen.cell_numbers || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">Percentage Segs</Typography>
                <Typography variant="body1">
                  {specimen.percentage_segs ? `${specimen.percentage_segs}%` : '—'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">CSF Protein</Typography>
                <Typography variant="body1">{specimen.csf_protein || '—'}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="subtitle2" color="text.secondary">CSF Glucose</Typography>
                <Typography variant="body1">{specimen.csf_gluc || '—'}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SpecimenDetail;