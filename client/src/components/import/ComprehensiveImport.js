import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Preview as PreviewIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  People as PeopleIcon,
  Work as WorkIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'react-toastify';

const ComprehensiveImport = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = [
    'Upload File',
    'Preview Data',
    'Import Results'
  ];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setError('');
      }
    },
    onDropRejected: (fileRejections) => {
      setError('Please upload a valid Excel (.xlsx, .xls) or CSV file');
    }
  });

  const handlePreview = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/import/comprehensive/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPreviewData(response.data);
      setActiveStep(1);
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.response?.data?.msg || 'Failed to preview file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/import/comprehensive/execute', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResults(response.data);
      setActiveStep(2);
      toast.success('Import completed successfully!');
    } catch (err) {
      console.error('Import error:', err);
      setError(err.response?.data?.msg || 'Failed to import file');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setFile(null);
    setPreviewData(null);
    setImportResults(null);
    setError('');
  };

  const renderSummaryCard = (title, icon, data, color = 'primary') => (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={1}>
          {icon}
          <Typography variant="h6" component="div" sx={{ ml: 1 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="div" color={`${color}.main`}>
          {data.total}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {data.new} new, {data.existing} existing
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Advanced Import - Create Everything
      </Typography>
      
      <Typography variant="body1" color="text.secondary" paragraph>
        <strong>Advanced users:</strong> Create collaborators, projects, and specimens all in one step from a single Excel/CSV file.
        <br />
        <strong>Use this when:</strong> You're setting up new projects or need to create collaborators and projects during import.
        <br />
        <strong>Most users should use:</strong> Standard Import for adding specimens to existing projects.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Upload File */}
          <Step>
            <StepLabel>Upload File</StepLabel>
            <StepContent>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Upload an Excel or CSV file with your data. The system will work with your existing column names and structure.
                </Typography>
                <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Any format works:</strong> Use your existing CSV/Excel structure. The system will adapt to your data and show you a preview before importing.
                  </Typography>
                </Box>
                
                <Paper
                  {...getRootProps()}
                  sx={{
                    p: 3,
                    border: '2px dashed',
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                    cursor: 'pointer',
                    textAlign: 'center',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <input {...getInputProps()} />
                  <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    {isDragActive ? 'Drop the file here' : 'Drag & drop or click to select'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Supports Excel (.xlsx, .xls) and CSV files
                  </Typography>
                </Paper>

                {file && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      Selected file: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                    </Typography>
                  </Box>
                )}
              </Box>

              <Box sx={{ mb: 1 }}>
                <Button
                  variant="contained"
                  onClick={handlePreview}
                  disabled={!file || loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <PreviewIcon />}
                >
                  {loading ? 'Processing...' : 'Preview Data'}
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 2: Preview Data */}
          <Step>
            <StepLabel>Preview Data</StepLabel>
            <StepContent>
              {previewData && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Import Summary
                  </Typography>
                  
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={4}>
                      {renderSummaryCard(
                        'Collaborators',
                        <PeopleIcon color="primary" />,
                        previewData.summary.collaborators,
                        'primary'
                      )}
                    </Grid>
                    <Grid item xs={12} md={4}>
                      {renderSummaryCard(
                        'Projects',
                        <WorkIcon color="secondary" />,
                        previewData.summary.projects,
                        'secondary'
                      )}
                    </Grid>
                    <Grid item xs={12} md={4}>
                      {renderSummaryCard(
                        'Specimens',
                        <ScienceIcon color="success" />,
                        previewData.summary.specimens,
                        'success'
                      )}
                    </Grid>
                  </Grid>

                  {previewData.errors.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">
                        {previewData.errors.length} validation errors found:
                      </Typography>
                      <List dense>
                        {previewData.errors.slice(0, 5).map((error, index) => (
                          <ListItem key={index} sx={{ py: 0 }}>
                            <ListItemIcon>
                              <ErrorIcon color="error" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={`Row ${error.row}: ${error.field}`}
                              secondary={error.message}
                            />
                          </ListItem>
                        ))}
                        {previewData.errors.length > 5 && (
                          <ListItem sx={{ py: 0 }}>
                            <ListItemText
                              primary={`... and ${previewData.errors.length - 5} more errors`}
                            />
                          </ListItem>
                        )}
                      </List>
                    </Alert>
                  )}

                  <Typography variant="h6" gutterBottom>
                    Sample Data Preview
                  </Typography>
                  <TableContainer component={Paper} sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Row</TableCell>
                          <TableCell>Collaborator</TableCell>
                          <TableCell>Project</TableCell>
                          <TableCell>Specimen</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previewData.sampleData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>{row.rowIndex}</TableCell>
                            <TableCell>
                              <Typography variant="body2" component="div">
                                {row.collaborator.pi_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {row.collaborator.pi_institute}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={`#${row.project.id}`} size="small" sx={{ mr: 1 }} />
                              <Typography variant="body2" component="div">
                                {row.project.disease}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {row.project.specimen_type}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {row.specimen.tube_id}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              <Box sx={{ mb: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleImport}
                  disabled={!previewData || loading || previewData.errors.length > 0}
                  startIcon={loading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                  sx={{ mr: 1 }}
                >
                  {loading ? 'Importing...' : 'Import Data'}
                </Button>
                <Button onClick={handleReset}>
                  Start Over
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 3: Import Results */}
          <Step>
            <StepLabel>Import Results</StepLabel>
            <StepContent>
              {importResults && (
                <Box sx={{ mb: 2 }}>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="h6">
                      Import Completed Successfully!
                    </Typography>
                    <Typography variant="body2">
                      Processed {importResults.summary.totalRows} rows with {importResults.summary.successfulRows} successful imports
                    </Typography>
                  </Alert>

                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={4}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="primary">
                            Collaborators
                          </Typography>
                          <Typography variant="body2">
                            Created: {importResults.results.collaborators.created}
                          </Typography>
                          <Typography variant="body2">
                            Updated: {importResults.results.collaborators.updated}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="secondary">
                            Projects
                          </Typography>
                          <Typography variant="body2">
                            Created: {importResults.results.projects.created}
                          </Typography>
                          <Typography variant="body2">
                            Updated: {importResults.results.projects.updated}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" color="success.main">
                            Specimens
                          </Typography>
                          <Typography variant="body2">
                            Created: {importResults.results.specimens.created}
                          </Typography>
                          <Typography variant="body2">
                            Updated: {importResults.results.specimens.updated}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>

                  {importResults.results.errors.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">
                        {importResults.results.errors.length} errors occurred during import:
                      </Typography>
                      <List dense>
                        {importResults.results.errors.map((error, index) => (
                          <ListItem key={index} sx={{ py: 0 }}>
                            <ListItemIcon>
                              <WarningIcon color="warning" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={`Row ${error.row}`}
                              secondary={error.message}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  )}
                </Box>
              )}

              <Box sx={{ mb: 1 }}>
                <Button
                  variant="contained"
                  onClick={handleReset}
                  startIcon={<CheckCircleIcon />}
                >
                  Import Another File
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </Paper>
    </Box>
  );
};

export default ComprehensiveImport;