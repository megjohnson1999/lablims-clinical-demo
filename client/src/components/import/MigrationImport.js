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
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Preview as PreviewIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  People as PeopleIcon,
  Work as WorkIcon,
  Science as ScienceIcon,
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  GetApp as TemplateIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';
import TemplateDownloader from '../common/TemplateDownloader';

const MigrationImport = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [files, setFiles] = useState({
    collaborators: null,
    projects: null,
    specimens: null,
    patients: null
  });
  const [previewData, setPreviewData] = useState(null);
  const [importResults, setImportResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const steps = ['Upload CSV Files', 'Preview Data', 'Import Results'];

  const fileTypes = [
    { key: 'collaborators', label: 'Collaborators CSV', icon: PeopleIcon, required: true },
    { key: 'projects', label: 'Projects CSV', icon: WorkIcon, required: true },
    { key: 'specimens', label: 'Specimens CSV', icon: ScienceIcon, required: false },
    { key: 'patients', label: 'Patients CSV', icon: PersonAddIcon, required: false }
  ];

  const handleFileSelect = (fileType, selectedFile) => {
    if (selectedFile) {
      setFiles(prev => ({ ...prev, [fileType]: selectedFile }));
      setError('');
    }
  };

  const removeFile = (fileType) => {
    setFiles(prev => ({ ...prev, [fileType]: null }));
  };

  const validateFiles = () => {
    const requiredFiles = fileTypes.filter(type => type.required);
    const missingFiles = requiredFiles.filter(type => !files[type.key]);
    
    if (missingFiles.length > 0) {
      setError(`Missing required files: ${missingFiles.map(f => f.label).join(', ')}`);
      return false;
    }
    
    return true;
  };

  const handlePreview = async () => {
    if (!validateFiles()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      
      Object.entries(files).forEach(([type, file]) => {
        if (file) {
          formData.append(type, file);
        }
      });

      const response = await axios.post('/api/import/multi-file/preview', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPreviewData(response.data);
      setActiveStep(1);
    } catch (err) {
      console.error('Preview error:', err);
      let errorMsg = 'Failed to preview files';
      
      if (err.response?.status === 400) {
        if (err.response.data?.error?.includes('File too large')) {
          errorMsg = 'One or more files are too large. Maximum file size is 50MB per file.';
        } else if (err.response.data?.error?.includes('Invalid file type')) {
          errorMsg = 'Invalid file type. Only CSV files are allowed for migration import.';
        } else {
          errorMsg = err.response.data?.error || err.response.data?.msg || errorMsg;
        }
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!validateFiles()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      
      Object.entries(files).forEach(([type, file]) => {
        if (file) {
          formData.append(type, file);
        }
      });

      const response = await axios.post('/api/import/multi-file/execute', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResults(response.data);
      setActiveStep(2);
      toast.success('Migration import completed successfully!');
    } catch (err) {
      console.error('Import error:', err);
      let errorMsg = 'Failed to import files';
      
      if (err.response?.status === 400) {
        if (err.response.data?.error?.includes('File too large')) {
          errorMsg = 'One or more files are too large. Maximum file size is 50MB per file.';
        } else if (err.response.data?.error?.includes('Invalid file type')) {
          errorMsg = 'Invalid file type. Only CSV files are allowed for migration import.';
        } else {
          errorMsg = err.response.data?.error || err.response.data?.msg || errorMsg;
        }
      } else if (err.response?.status === 500) {
        // Handle validation failures and database errors
        const responseData = err.response.data;
        if (responseData?.msg) {
          errorMsg = responseData.msg;
          
          // Add specific guidance if available
          if (responseData?.details?.commonCauses?.length > 0) {
            const primaryCause = responseData.details.commonCauses[0];
            errorMsg += `\n\nLikely cause: ${primaryCause.description}`;
            if (primaryCause.solution) {
              errorMsg += `\nSolution: ${primaryCause.solution}`;
            }
          }
        } else {
          errorMsg = err.response.data?.error || errorMsg;
        }
      } else if (err.response?.data) {
        // Handle other status codes
        errorMsg = err.response.data?.msg || err.response.data?.error || errorMsg;
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setFiles({
      collaborators: null,
      projects: null,
      specimens: null,
      patients: null
    });
    setPreviewData(null);
    setImportResults(null);
    setError('');
  };

  const renderFileUploadCard = (fileType) => {
    const config = fileTypes.find(t => t.key === fileType.key);
    const file = files[fileType.key];
    const IconComponent = config.icon;

    return (
      <Card key={fileType.key} sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <IconComponent sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {config.label}
              {config.required && <span style={{ color: 'red' }}> *</span>}
            </Typography>
            {file && (
              <Button
                size="small"
                startIcon={<DeleteIcon />}
                onClick={() => removeFile(fileType.key)}
                color="error"
              >
                Remove
              </Button>
            )}
          </Box>

          {!file ? (
            <Paper
              sx={{
                p: 2,
                border: '2px dashed',
                borderColor: 'grey.300',
                bgcolor: 'background.paper',
                textAlign: 'center',
                '&:hover': {
                  borderColor: 'primary.main',
                },
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
              <Button
                variant="outlined"
                component="label"
                size="small"
              >
                Choose CSV File
                <input
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={(e) => handleFileSelect(fileType.key, e.target.files[0])}
                />
              </Button>
            </Paper>
          ) : (
            <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                ✓ {file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {(file.size / 1024).toFixed(1)} KB
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Migration Import
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Import multiple CSV files from your legacy system while preserving existing IDs and relationships.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<TemplateIcon />}
          onClick={() => setTemplateDialogOpen(true)}
        >
          Download Templates
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Upload Files */}
          <Step>
            <StepLabel>Upload CSV Files</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                Upload your legacy CSV files. Files will be imported in dependency order.
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  {fileTypes.slice(0, 2).map(renderFileUploadCard)}
                </Grid>
                <Grid item xs={12} md={6}>
                  {fileTypes.slice(2, 4).map(renderFileUploadCard)}
                </Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handlePreview}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <PreviewIcon />}
                >
                  {loading ? 'Processing...' : 'Preview Import'}
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
                    Import Preview Summary
                  </Typography>
                  
                  {/* Show counts for each file type */}
                  {Object.entries(previewData).map(([fileType, data]) => {
                    if (fileType === 'errors' || fileType === 'warnings' || fileType === 'summary' || !data || typeof data !== 'object') return null;
                    
                    // Get count from summary if available, otherwise fall back to data.length
                    let recordCount = data.length || 0;
                    if (previewData.summary && previewData.summary[fileType]) {
                      recordCount = previewData.summary[fileType].total || recordCount;
                    }
                    
                    return (
                      <Box key={fileType} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                          {fileType}: {recordCount} records
                        </Typography>
                        
                        {data.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              Sample data: {fileType === 'collaborators' ? 
                                `${data[0]?.pi_name} (ID: ${data[0]?.id})` :
                                fileType === 'projects' ?
                                `${data[0]?.disease} (ID: ${data[0]?.id})` :
                                `${Object.keys(data[0] || {}).slice(0,2).join(', ')}`
                              }
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                  
                  {previewData.errors && previewData.errors.length > 0 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Found {previewData.errors.length} validation issues:</strong>
                      </Typography>
                      {previewData.errors.slice(0, 5).map((error, index) => (
                        <Typography key={index} variant="body2" sx={{ ml: 2 }}>
                          • {error.file} (Row {error.row}): {error.message}
                        </Typography>
                      ))}
                      {previewData.errors.length > 5 && (
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                          ... and {previewData.errors.length - 5} more issues
                        </Typography>
                      )}
                    </Alert>
                  )}
                  
                  {previewData.warnings && previewData.warnings.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Warnings:</strong>
                      </Typography>
                      {previewData.warnings.map((warning, index) => (
                        <Typography key={index} variant="body2" sx={{ ml: 2 }}>
                          • {warning}
                        </Typography>
                      ))}
                    </Alert>
                  )}
                  
                  {(!previewData.errors || previewData.errors.length === 0) && (
                    <Typography variant="body2" color="primary.main" sx={{ fontWeight: 'medium' }}>
                      ✓ Preview validated successfully! Ready to import.
                    </Typography>
                  )}
                </Box>
              )}

              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleImport}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                  sx={{ mr: 1 }}
                >
                  {loading ? 'Importing...' : 'Execute Import'}
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
                      Migration Import Completed Successfully!
                    </Typography>
                  </Alert>
                </Box>
              )}

              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleReset}
                  startIcon={<CheckCircleIcon />}
                >
                  Import More Files
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </Paper>

      <TemplateDownloader
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        defaultTemplate="migration_collaborators"
      />
    </Box>
  );
};

export default MigrationImport;