import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  CircularProgress,
  Alert,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Divider,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Description as DocumentIcon,
  AutoAwesome as AIIcon,
  Upload as UploadIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import ProtocolReagentCSVUpload from './ProtocolReagentCSVUpload';
import DocumentLibrary from './DocumentLibrary';
import DocumentUpload from './DocumentUpload';

const ProtocolForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    required_reagents: [],
    is_active: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reagentDialogOpen, setReagentDialogOpen] = useState(false);
  const [newReagent, setNewReagent] = useState({
    name: '',
    quantity_per_sample: '',
    unit: '',
  });
  
  // Reagent input method management
  const [reagentInputTab, setReagentInputTab] = useState(1); // 0 = Manual, 1 = CSV
  const [manualReagents, setManualReagents] = useState([]);
  const [csvReagents, setCsvReagents] = useState([]);
  
  // Document upload for new protocols
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [uploadedDocument, setUploadedDocument] = useState(null);


  useEffect(() => {
    if (isEdit) {
      fetchProtocol();
    }
  }, [id, isEdit]);

  const fetchProtocol = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/protocols/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch protocol');
      }

      const protocol = await response.json();
      setFormData({
        name: protocol.name || '',
        description: protocol.description || '',
        is_active: protocol.is_active !== false,
      });
      
      // Separate reagents into manual reagents (for editing)
      setManualReagents(protocol.required_reagents || []);
    } catch (err) {
      console.error('Error fetching protocol:', err);
      setError('Failed to load protocol');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddReagent = () => {
    if (!newReagent.name || !newReagent.quantity_per_sample || !newReagent.unit) {
      toast.error('Please fill in all reagent fields');
      return;
    }

    const quantity = parseFloat(newReagent.quantity_per_sample);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Quantity per sample must be a positive number');
      return;
    }

    setManualReagents(prev => [
      ...prev,
      {
        name: newReagent.name.trim(),
        quantity_per_sample: quantity,
        unit: newReagent.unit.trim(),
      },
    ]);

    setNewReagent({ name: '', quantity_per_sample: '', unit: '' });
    setReagentDialogOpen(false);
  };

  const handleRemoveReagent = (index) => {
    setManualReagents(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveCsvReagent = (index) => {
    setCsvReagents(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditCsvReagent = (index, field, value) => {
    setCsvReagents(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCsvReagentsLoaded = (reagents, document) => {
    console.log('handleCsvReagentsLoaded called:', { reagents, document });
    setCsvReagents(reagents);
    if (document) {
      console.log('Setting uploaded document:', document);
      setUploadedDocument(document);
    } else {
      console.log('No document provided in callback');
    }
  };

  // Combine manual and CSV reagents for form submission
  const getAllReagents = () => {
    return [...manualReagents, ...csvReagents];
  };

  const handleTabChange = (event, newValue) => {
    setReagentInputTab(newValue);
  };

  const handleDocumentUpload = (document) => {
    setUploadedDocuments(prev => [...prev, document]);
    setDocumentUploadOpen(false);
  };


  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Protocol name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const url = isEdit ? `/api/protocols/${id}` : '/api/protocols';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        required_reagents: getAllReagents()
      };

      // Include document_id if available from AI extraction
      console.log('uploadedDocument state:', uploadedDocument);
      if (uploadedDocument && uploadedDocument.id) {
        console.log('Adding document_id to payload:', uploadedDocument.id);
        payload.document_id = uploadedDocument.id;
      } else {
        console.log('No uploadedDocument or document.id');
      }
      console.log('Final payload:', payload);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to save protocol');
      }

      const savedProtocol = await response.json();
      toast.success(`Protocol ${isEdit ? 'updated' : 'created'} successfully`);
      navigate(`/protocols/${savedProtocol.id}`);
    } catch (err) {
      console.error('Error saving protocol:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit && !formData.name) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {isEdit ? 'Edit Protocol' : 'New Protocol'}
      </Typography>

      {!isEdit && (
        <Card sx={{ mb: 3, bgcolor: 'info.50', borderLeft: 4, borderColor: 'info.main' }}>
          <CardContent>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AIIcon sx={{ mr: 1 }} />
              Recommended Workflow for New Protocols
            </Typography>
            
            <Stepper orientation="vertical" sx={{ ml: 2 }}>
              <Step active>
                <StepLabel
                  icon={<AIIcon />}
                  sx={{ '& .MuiStepLabel-label': { fontSize: '0.9rem' } }}
                >
                  AI Extraction (Recommended)
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Upload your protocol document and let AI automatically extract reagents
                  </Typography>
                </StepContent>
              </Step>

              <Step active>
                <StepLabel
                  icon={<UploadIcon />}
                  sx={{ '& .MuiStepLabel-label': { fontSize: '0.9rem' } }}
                >
                  Manual CSV Upload (Alternative)
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Or manually create and upload a CSV with reagent information
                  </Typography>
                </StepContent>
              </Step>

              <Step active>
                <StepLabel
                  icon={<DocumentIcon />}
                  sx={{ '& .MuiStepLabel-label': { fontSize: '0.9rem' } }}
                >
                  Review & Save
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Review extracted reagents, add protocol details, and save
                  </Typography>
                </StepContent>
              </Step>
              
              <Step active>
                <StepLabel 
                  icon={<CheckIcon />}
                  sx={{ '& .MuiStepLabel-label': { fontSize: '0.9rem' } }}
                >
                  Review & Save
                </StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Review all protocol information and save to the LIMS
                  </Typography>
                </StepContent>
              </Step>
            </Stepper>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}


      <Paper component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <TextField
              label="Protocol Name"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              disabled={loading}
            />
          </Grid>
          
          {isEdit && (
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => handleInputChange('is_active', e.target.checked)}
                    disabled={loading}
                  />
                }
                label="Active Protocol"
              />
            </Grid>
          )}
        </Grid>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Required Reagents</Typography>
          
          <Paper variant="outlined">
            <Tabs 
              value={reagentInputTab} 
              onChange={handleTabChange}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label={`Manual Entry (${manualReagents.length})`} />
              <Tab label={`CSV Upload (${csvReagents.length})`} />
            </Tabs>
            
            <Box sx={{ p: 3 }}>
              {reagentInputTab === 0 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1">Add Reagents Individually</Typography>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => setReagentDialogOpen(true)}
                      disabled={loading}
                    >
                      Add Reagent
                    </Button>
                  </Box>

                  {manualReagents.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                      No reagents added manually. Click "Add Reagent" to add individual reagents.
                    </Typography>
                  ) : (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Reagent Name</TableCell>
                            <TableCell align="right">Quantity per Sample</TableCell>
                            <TableCell>Unit</TableCell>
                            <TableCell align="center">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {manualReagents.map((reagent, index) => (
                            <TableRow key={index}>
                              <TableCell>{reagent.name}</TableCell>
                              <TableCell align="right">{reagent.quantity_per_sample}</TableCell>
                              <TableCell>{reagent.unit}</TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRemoveReagent(index)}
                                  disabled={loading}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {reagentInputTab === 1 && (
                <Box>
                  <ProtocolReagentCSVUpload
                    onReagentsLoaded={handleCsvReagentsLoaded}
                    existingReagents={manualReagents}
                    disabled={loading}
                  />

                  {/* Editable Review Table for CSV/AI-extracted Reagents */}
                  {csvReagents.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        Extracted Reagents - Review & Edit
                        <Typography variant="caption" color="text.secondary">
                          Click on any field to edit
                        </Typography>
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                              <TableCell>Reagent Name</TableCell>
                              <TableCell align="right">Quantity per Sample</TableCell>
                              <TableCell>Unit</TableCell>
                              <TableCell align="center">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {csvReagents.map((reagent, index) => (
                              <TableRow key={index} hover>
                                <TableCell>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    variant="standard"
                                    value={reagent.name}
                                    onChange={(e) => handleEditCsvReagent(index, 'name', e.target.value)}
                                    disabled={loading}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <TextField
                                    size="small"
                                    variant="standard"
                                    type="number"
                                    value={reagent.quantity_per_sample}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleEditCsvReagent(index, 'quantity_per_sample', val === '' ? '' : parseFloat(val));
                                    }}
                                    disabled={loading}
                                    sx={{ maxWidth: 100 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    variant="standard"
                                    value={reagent.unit}
                                    onChange={(e) => handleEditCsvReagent(index, 'unit', e.target.value)}
                                    disabled={loading}
                                    sx={{ maxWidth: 80 }}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRemoveCsvReagent(index)}
                                    disabled={loading}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Alert severity="info" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          <strong>Review required:</strong> AI extraction may not be perfect. Please verify all reagent names, quantities, and units before saving.
                        </Typography>
                      </Alert>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Paper>

          {/* Combined Reagent Summary */}
          {(manualReagents.length > 0 || csvReagents.length > 0) && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Total Protocol Reagents: {getAllReagents().length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {manualReagents.length} manual + {csvReagents.length} from CSV
              </Typography>
            </Box>
          )}
        </Box>

        {/* Protocol Documents Section */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Protocol Documents</Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            {isEdit && id ? (
              <DocumentLibrary 
                protocolId={id} 
                showProtocolFilter={false}
              />
            ) : (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1">Protocol Documents</Typography>
                  <Button
                    variant="outlined"
                    startIcon={<DocumentIcon />}
                    onClick={() => setDocumentUploadOpen(true)}
                    disabled={loading}
                  >
                    Upload Document
                  </Button>
                </Box>
                
                {uploadedDocuments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No documents uploaded yet. Click "Upload Document" to add protocol documentation.
                  </Typography>
                ) : (
                  <Box>
                    {uploadedDocuments.map((doc, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'center', p: 1, mb: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <DocumentIcon sx={{ mr: 2, color: 'primary.main' }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight="medium">{doc.original_filename}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {doc.category && `Category: ${doc.category}`}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4 }}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={() => navigate('/protocols')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : (isEdit ? 'Update' : 'Create')}
          </Button>
        </Box>
      </Paper>

      {/* Add Reagent Dialog */}
      <Dialog open={reagentDialogOpen} onClose={() => setReagentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Required Reagent</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Reagent Name"
                fullWidth
                value={newReagent.name}
                onChange={(e) => setNewReagent(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Taq Polymerase, Buffer A, dNTPs"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Quantity per Sample"
                fullWidth
                type="number"
                inputProps={{ min: 0, step: 0.1 }}
                value={newReagent.quantity_per_sample}
                onChange={(e) => setNewReagent(prev => ({ ...prev, quantity_per_sample: e.target.value }))}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Unit"
                fullWidth
                value={newReagent.unit}
                onChange={(e) => setNewReagent(prev => ({ ...prev, unit: e.target.value }))}
                placeholder="e.g., μL, mL, mg, units"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReagentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddReagent} variant="contained">Add Reagent</Button>
        </DialogActions>
      </Dialog>

      {/* Document Upload Dialog */}
      <DocumentUpload
        open={documentUploadOpen}
        onClose={() => setDocumentUploadOpen(false)}
        onSuccess={handleDocumentUpload}
        protocolId={null} // For new protocols, no ID yet
      />
    </Box>
  );
};

export default ProtocolForm;