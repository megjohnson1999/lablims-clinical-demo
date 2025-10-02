import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  IconButton,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { metadataAPI } from '../../services/api';

const MetadataUpload = ({ open, onClose, onSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // File upload state
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  
  // Column mapping state
  const [specimenIdColumn, setSpecimenIdColumn] = useState('');
  const [matchingStrategy, setMatchingStrategy] = useState('tube_id');
  
  // Preview state
  const [previewResults, setPreviewResults] = useState(null);
  
  // Apply state
  const [applyResults, setApplyResults] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const steps = [
    'Upload CSV File',
    'Configure Column Mapping',
    'Review Cross-Project Impact',
    'Apply Metadata Updates'
  ];

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setActiveStep(0);
      setFile(null);
      setCsvData([]);
      setCsvHeaders([]);
      setSpecimenIdColumn('');
      setMatchingStrategy('tube_id');
      setPreviewResults(null);
      setApplyResults(null);
      setUploadProgress(0);
      setError('');
    }
  }, [open]);

  const handleFileUpload = useCallback((event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    const isCSV = fileName.endsWith('.csv');
    const isTSV = fileName.endsWith('.tsv') || fileName.endsWith('.txt');
    
    if (!isCSV && !isTSV) {
      setError('Please select a CSV (.csv) or TSV (.tsv/.txt) file');
      return;
    }

    setFile(selectedFile);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const lines = content.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setError('File must contain at least a header row and one data row');
          return;
        }

        // Determine delimiter based on file type
        const delimiter = isTSV ? '\t' : ',';
        
        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).map(line => {
          const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });

        setCsvHeaders(headers);
        setCsvData(rows);
        setActiveStep(1);
      } catch (err) {
        console.error('Error parsing file:', err);
        const fileType = isTSV ? 'TSV' : 'CSV';
        setError(`Failed to parse ${fileType} file. Please check the format and ensure it uses the correct delimiter (${isTSV ? 'tabs' : 'commas'}).`);
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
    };

    reader.readAsText(selectedFile);
  }, []);

  const handlePreview = async () => {
    if (!specimenIdColumn) {
      setError('Please select a specimen ID column');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await metadataAPI.uploadPreview(csvData, specimenIdColumn, matchingStrategy);
      setPreviewResults(response.data);
      setActiveStep(2);
    } catch (err) {
      console.error('Preview error:', err);
      const errorData = err.response?.data;
      
      if (errorData && errorData.suggestions) {
        // Display enhanced error with suggestions
        setError({
          message: errorData.error || errorData.msg || 'Failed to preview metadata upload',
          suggestions: errorData.suggestions,
          maxSize: errorData.maxSize,
          actualSize: errorData.actualSize
        });
      } else {
        setError(errorData?.msg || errorData?.error || 'Failed to preview metadata upload');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMetadata = async () => {
    setLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      // Simulate progress for user feedback
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await metadataAPI.uploadApply(csvData, specimenIdColumn, matchingStrategy);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setApplyResults(response.data);
      
      if (response.data.success) {
        toast.success(`Successfully updated ${response.data.summary.successCount} specimens with metadata`);
        onSuccess && onSuccess();
      } else {
        setError('Some metadata updates failed. Check the results below.');
      }
      
    } catch (err) {
      console.error('Apply metadata error:', err);
      const errorData = err.response?.data;
      
      if (errorData && errorData.suggestions) {
        setError({
          message: errorData.error || errorData.msg || 'Failed to apply metadata updates',
          suggestions: errorData.suggestions,
          maxSize: errorData.maxSize,
          actualSize: errorData.actualSize
        });
      } else {
        setError(errorData?.msg || errorData?.error || 'Failed to apply metadata updates');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    switch (activeStep) {
      case 1:
        handlePreview();
        break;
      case 2:
        setActiveStep(3);
        break;
      case 3:
        handleApplyMetadata();
        break;
      default:
        setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError('');
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return csvData.length > 0 && csvHeaders.length > 0;
      case 1:
        return specimenIdColumn !== '';
      case 2:
        return previewResults && previewResults.summary.matchedSpecimenIds > 0;
      case 3:
        return false; // Final step
      default:
        return false;
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Upload a CSV or TSV file containing specimen metadata. The system will automatically detect 
              whether your data affects single or multiple projects and show you the impact before applying changes.
            </Typography>
            
            <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
              <Typography variant="body2">
                <strong>Smart Upload:</strong> The system will match specimens by your chosen identifier (Tube ID or WUID) 
                across all projects and provide a detailed preview of which specimens will be updated.
              </Typography>
            </Alert>
            
            <Box sx={{ mt: 3, mb: 2 }}>
              <input
                accept=".csv,.tsv,.txt"
                style={{ display: 'none' }}
                id="metadata-file-upload"
                type="file"
                onChange={handleFileUpload}
              />
              <label htmlFor="metadata-file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  size="large"
                  fullWidth
                >
                  Select CSV or TSV File
                </Button>
              </label>
            </Box>

            {file && (
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>File:</strong> {file.name}<br />
                  <strong>Size:</strong> {(file.size / 1024).toFixed(1)} KB<br />
                  <strong>Rows:</strong> {csvData.length}<br />
                  <strong>Columns:</strong> {csvHeaders.length}
                </Typography>
              </Alert>
            )}

            {csvHeaders.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Detected Columns:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {csvHeaders.map((header, index) => (
                    <Chip key={index} label={header} size="small" />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Configure how specimens will be matched across all projects in the system.
            </Typography>

            <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
              <InputLabel>Matching Strategy</InputLabel>
              <Select
                value={matchingStrategy}
                onChange={(e) => setMatchingStrategy(e.target.value)}
                label="Matching Strategy"
              >
                <MenuItem value="tube_id">Match by Tube ID</MenuItem>
                <MenuItem value="specimen_number">Match by WUID (Specimen Number)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
              <InputLabel>
                {matchingStrategy === 'specimen_number' ? 'WUID Column' : 'Tube ID Column'}
              </InputLabel>
              <Select
                value={specimenIdColumn}
                onChange={(e) => setSpecimenIdColumn(e.target.value)}
                label={matchingStrategy === 'specimen_number' ? 'WUID Column' : 'Tube ID Column'}
              >
                {csvHeaders.map((header) => (
                  <MenuItem key={header} value={header}>
                    {header}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>
                  {matchingStrategy === 'specimen_number' ? 'WUID Matching:' : 'Tube ID Matching:'}
                </strong> The system will search for these {matchingStrategy === 'specimen_number' ? 'specimen numbers' : 'tube IDs'} across all projects in the database.<br />
                <strong>Smart Detection:</strong> The preview will show you whether this affects one project or multiple projects.
              </Typography>
            </Alert>

            {specimenIdColumn && csvData.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Sample {matchingStrategy === 'specimen_number' ? 'WUIDs' : 'Tube IDs'} from {specimenIdColumn}:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {[...new Set(csvData.slice(0, 8).map(row => row[specimenIdColumn]))].map((value, index) => (
                    <Chip key={index} label={value} size="small" />
                  ))}
                  {csvData.length > 8 && <Chip label="..." size="small" variant="outlined" />}
                </Box>
              </Box>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Review the impact of your metadata upload. The system has analyzed which specimens 
              will be updated and shows you the project distribution.
            </Typography>

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Analyzing specimen matches and project impact...</Typography>
              </Box>
            )}

            {!loading && previewResults && (
              <Box sx={{ mt: 2 }}>
                {/* Summary Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">
                          {previewResults.summary.totalSpecimensToUpdate}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Specimens to Update
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="secondary">
                          {previewResults.summary.projectsAffected}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Projects Affected
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="success.main">
                          {previewResults.summary.matchedSpecimenIds}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Matched {matchingStrategy === 'specimen_number' ? 'WUIDs' : 'Tube IDs'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Card>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color={previewResults.summary.unmatchedSpecimenIds > 0 ? "warning.main" : "text.secondary"}>
                          {previewResults.summary.unmatchedSpecimenIds}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Unmatched {matchingStrategy === 'specimen_number' ? 'WUIDs' : 'Tube IDs'}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Project Impact Details */}
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">
                      <AssessmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Project Impact Analysis ({previewResults.summary.projectsAffected} projects)
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Project</TableCell>
                            <TableCell>Disease</TableCell>
                            <TableCell>PI</TableCell>
                            <TableCell align="right">Specimens</TableCell>
                            <TableCell align="right">Tube IDs</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {previewResults.projectImpact.map((project, index) => (
                            <TableRow key={index}>
                              <TableCell>{project.projectNumber}</TableCell>
                              <TableCell>{project.disease}</TableCell>
                              <TableCell>{project.piName}</TableCell>
                              <TableCell align="right">{project.specimenCount}</TableCell>
                              <TableCell align="right">{project.tubeIdCount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>

                {/* Metadata Fields */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">
                      Metadata Fields ({previewResults.summary.metadataFieldCount})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {previewResults.metadataFields.map((field, index) => (
                        <Chip key={index} label={field} size="small" color="primary" variant="outlined" />
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>

                {/* Sample Metadata Preview */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">
                      Sample Metadata Preview
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>{matchingStrategy === 'specimen_number' ? 'WUID' : 'Tube ID'}</TableCell>
                            {previewResults.metadataFields.map((field) => (
                              <TableCell key={field}>{field}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {previewResults.sampleMetadata.map((sample, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Chip label={sample.specimenId} size="small" />
                              </TableCell>
                              {previewResults.metadataFields.map((field) => (
                                <TableCell key={field}>
                                  {sample.metadata[field] || '—'}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>

                {/* Unmatched Tube IDs Warning */}
                {previewResults.summary.unmatchedSpecimenIds > 0 && (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" color="warning.main">
                        <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Unmatched {matchingStrategy === 'specimen_number' ? 'WUIDs' : 'Tube IDs'} ({previewResults.summary.unmatchedSpecimenIds})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        These {matchingStrategy === 'specimen_number' ? 'specimen numbers (WUIDs)' : 'tube IDs'} from your CSV file were not found in any project and will be skipped.
                      </Alert>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {previewResults.unmatchedSpecimenIds.map((specimenId, index) => (
                          <Chip key={index} label={specimenId} size="small" color="warning" />
                        ))}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                )}
              </Box>
            )}
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Apply metadata updates to the matched specimens. This will permanently update 
              the specimen records with the metadata from your CSV file.
            </Typography>

            {loading && (
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Applying metadata updates... {Math.round(uploadProgress)}% complete
                </Typography>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}

            {previewResults && !loading && !applyResults && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Ready to update <strong>{previewResults.summary.totalSpecimensToUpdate}</strong> specimens 
                  across <strong>{previewResults.summary.projectsAffected}</strong> projects 
                  with <strong>{previewResults.summary.metadataFieldCount}</strong> metadata fields.
                </Typography>
              </Alert>
            )}

            {applyResults && (
              <Box sx={{ mt: 2 }}>
                <Alert severity={applyResults.success ? "success" : "error"} sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Update Results:</strong><br />
                    • Successfully updated: {applyResults.summary.successCount} specimens<br />
                    • Failed updates: {applyResults.summary.failureCount} specimens<br />
                    • Metadata fields applied: {applyResults.summary.metadataFields}<br />
                    • Unique specimen IDs processed: {applyResults.summary.uniqueSpecimenIds}
                  </Typography>
                </Alert>

                {applyResults.errors && applyResults.errors.length > 0 && (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" color="error">
                        <ErrorIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Update Errors ({applyResults.errors.length})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {applyResults.errors.map((error, index) => (
                          <ListItem key={index}>
                            <ListItemText
                              primary={`Specimen ${error.specimen} (${error.tubeId})`}
                              secondary={error.error}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                )}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Metadata Upload
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {typeof error === 'string' ? (
              error
            ) : (
              <Box>
                <Typography variant="body2" gutterBottom>
                  <strong>{error.message}</strong>
                </Typography>
                {error.maxSize && error.actualSize && (
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    File size: {error.actualSize} (Maximum: {error.maxSize})
                  </Typography>
                )}
                {error.suggestions && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" gutterBottom>
                      <strong>What you can do:</strong>
                    </Typography>
                    <ul style={{ margin: '0 0 0 16px', padding: 0 }}>
                      {error.suggestions.map((suggestion, index) => (
                        <li key={index}>
                          <Typography variant="body2">{suggestion}</Typography>
                        </li>
                      ))}
                    </ul>
                  </Box>
                )}
              </Box>
            )}
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                {renderStepContent(index)}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        
        {activeStep < steps.length - 1 && (
          <Button
            onClick={handleNext}
            variant="contained"
            disabled={!canProceed() || loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Next'}
          </Button>
        )}
        
        {activeStep === steps.length - 1 && !applyResults && (
          <Button
            onClick={handleApplyMetadata}
            variant="contained"
            color="primary"
            disabled={loading || !previewResults || previewResults.summary.matchedSpecimenIds === 0}
            startIcon={loading ? <CircularProgress size={20} /> : <CheckIcon />}
          >
            {loading ? 'Applying...' : 'Apply Metadata'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MetadataUpload;