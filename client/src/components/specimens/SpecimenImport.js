import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  FormControlLabel,
  Checkbox,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Card,
  CardContent,
  CardActions,
  Tab,
  Tabs,
} from '@mui/material';
import {
  CloudUpload,
  Download,
  Science,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  Upload,
  GetApp as TemplateIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import ProjectSelector from '../common/ProjectSelector';
import TemplateDownloader from '../common/TemplateDownloader';
import { specimenAPI, projectAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const SpecimenImport = ({ open, onClose, onImportComplete }) => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [importType, setImportType] = useState('project'); // 'project' or 'migration'
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState('');
  const [options, setOptions] = useState({
    skipDuplicates: false,
    updateDuplicates: true,
    batchSize: 500,
    createMissingEntities: true
  });
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const { currentUser } = useAuth();
  
  useEffect(() => {
    if (shouldNavigate) {
      navigate('migration-import');
      setShouldNavigate(false);
    }
  }, [shouldNavigate, navigate]);
  const getSteps = () => {
    if (importType === 'migration') {
      return ['Select Import Type', 'Upload File', 'Preview & Validate', 'Import'];
    }
    return ['Select Import Type', 'Choose Project', 'Upload File', 'Preview & Validate', 'Import'];
  };

  const steps = getSteps();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      const selectedFile = acceptedFiles[0];
      if (selectedFile) {
        setFile(selectedFile);
        await handlePreview(selectedFile);
      }
    }
  });

  const handlePreview = async (selectedFile) => {
    if (!selectedProject && importType === 'project') {
      setError('Please select a project before uploading files');
      return;
    }

    try {
      setError('');
      setImporting(true); // Show loading state during preview
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('importType', importType);
      if (selectedProject) {
        formData.append('projectId', selectedProject.id);
      }

      const token = localStorage.getItem('token');
      const endpoint = importType === 'migration' ? '/api/import/preview' : '/api/specimens/import/preview';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to preview file');
      }

      const data = await response.json();
      setPreviewData(data);
      setValidationResults(data);
      setActiveStep(3);
    } catch (err) {
      setError(err.message || 'Failed to preview file');
    } finally {
      setImporting(false); // Hide loading state
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      setError('');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('importType', importType);
      if (selectedProject) {
        formData.append('projectId', selectedProject.id);
      }
      formData.append('skipDuplicates', options.skipDuplicates);
      formData.append('updateDuplicates', options.updateDuplicates);
      formData.append('batchSize', options.batchSize);
      formData.append('createMissingEntities', options.createMissingEntities);

      const token = localStorage.getItem('token');
      const executeEndpoint = importType === 'migration' ? '/api/import/execute' : '/api/specimens/import/execute';
      const response = await fetch(executeEndpoint, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const data = await response.json();
      setImportResults(data.results);
      setActiveStep(4);
      
      if (onImportComplete) {
        onImportComplete(data.results);
      }
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };


  const handleClose = () => {
    setActiveStep(0);
    setImportType('project');
    setSelectedProject(null);
    setFile(null);
    setPreviewData(null);
    setValidationResults(null);
    setImporting(false);
    setImportResults(null);
    setError('');
    onClose();
  };

  const handleNext = () => {
    if (activeStep === 0 && !importType) {
      setError('Please select an import type');
      return;
    }
    if (activeStep === 1 && !selectedProject) {
      setError('Please select a project');
      return;
    }
    if (activeStep === 2 && !file) {
      setError('Please upload a file');
      return;
    }
    setError('');
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const renderImportTypeStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Choose Import Type
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Select the type of import based on your needs:
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Card 
          sx={{ 
            flex: 1, 
            cursor: 'pointer',
            border: importType === 'project' ? '2px solid' : '1px solid',
            borderColor: importType === 'project' ? 'primary.main' : 'grey.300',
            '&:hover': { borderColor: 'primary.main' }
          }}
          onClick={() => setImportType('project')}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Science sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Project Import</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Import specimens into a selected project. Only tube_id is required - system generates WUIDs automatically. No patient data needed.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Chip label="Recommended" color="primary" size="small" />
              <Chip label="Flexible Format" variant="outlined" size="small" sx={{ ml: 1 }} />
            </Box>
          </CardContent>
        </Card>

        <Card 
          sx={{ 
            flex: 1, 
            cursor: 'pointer',
            border: importType === 'migration' ? '2px solid' : '1px solid',
            borderColor: importType === 'migration' ? 'primary.main' : 'grey.300',
            '&:hover': { borderColor: 'primary.main' }
          }}
          onClick={() => {
            onClose();
            setShouldNavigate(true);
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Upload sx={{ mr: 1, color: 'warning.main' }} />
              <Typography variant="h6">Migration Import</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Import multiple CSV files from legacy systems while preserving existing IDs and relationships. 
              Creates all entities automatically from your data.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Chip label="Multiple Projects" color="warning" size="small" />
              <Chip label="Auto-Creates Everything" variant="outlined" size="small" sx={{ ml: 1 }} />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );

  const renderProjectStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select Project
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        {importType === 'project' 
          ? 'Choose the project where these specimens will be imported.'
          : 'Optionally select a default project, or specimens will be organized by project data in the file.'
        }
      </Typography>
      
      <ProjectSelector
        selectedProject={selectedProject}
        onProjectChange={setSelectedProject}
        label="Target Project"
        helperText="All imported specimens will be associated with this project and receive auto-generated WUIDs. Type exact project ID (e.g., 35) for instant exact match."
        required={importType === 'project'}
        showCreateButton={true}
        simplified={true}
      />

      {importType === 'project' && selectedProject && (
        <Box sx={{ mt: 3 }}>
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Import your data as-is:</strong> Upload your CSV file in whatever format you have.
              The system will work with your existing column names and data structure.
            </Typography>
          </Alert>
        </Box>
      )}
    </Box>
  );

  const renderFileUploadStep = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Upload Specimen Data
          </Typography>
      <Typography variant="body2" color="text.secondary">
        Upload your CSV or Excel file with specimen data. Only <strong>tube_id</strong> is required - all other fields are optional. 
        The system recognizes 70+ column name variations and generates WUIDs automatically.
      </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<TemplateIcon />}
          onClick={() => setTemplateDialogOpen(true)}
          size="small"
        >
          Download Template
        </Button>
      </Box>
      
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          mt: 2,
          transition: 'border-color 0.2s',
          '&:hover': {
            borderColor: 'primary.main'
          }
        }}
      >
        <input {...getInputProps()} />
        <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        {file ? (
          <Typography variant="body1">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </Typography>
        ) : (
          <Typography variant="body1">
            {isDragActive ? 'Drop the file here...' : 'Drag & drop a file here, or click to select'}
          </Typography>
        )}
      </Box>

      {file && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info">
            <Typography variant="body2">
              File ready for preview. Click "Next" to validate the data.
            </Typography>
          </Alert>
        </Box>
      )}
    </Box>
  );

  const renderPreviewStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Preview & Validate
      </Typography>
      
      {previewData && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Chip 
              icon={<CheckCircle />} 
              label={`${previewData.validRows} Valid Rows`} 
              color="success" 
            />
            {previewData.errorRows > 0 && (
              <Chip 
                icon={<ErrorIcon />} 
                label={`${previewData.errorRows} Error Rows`} 
                color="error" 
              />
            )}
            {previewData.duplicateRows > 0 && (
              <Chip 
                icon={<Warning />} 
                label={`${previewData.duplicateRows} Duplicates`} 
                color="warning" 
              />
            )}
          </Box>

          {/* Column Mapping Preview */}
          {previewData.mappingFeedback && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Column Mapping
              </Typography>
              
              {/* Successfully mapped columns */}
              {Object.keys(previewData.mappingFeedback.mapped).length > 0 && (
                <Alert severity="success" sx={{ mb: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Mapped Columns:</strong>
                  </Typography>
                  {Object.entries(previewData.mappingFeedback.mapped).map(([header, field]) => (
                    <Typography key={header} variant="body2">
                      • "{header}" → {field.replace(/_/g, ' ')}
                    </Typography>
                  ))}
                </Alert>
              )}
              
              {/* Conflict warnings */}
              {previewData.mappingFeedback.conflicts && previewData.mappingFeedback.conflicts.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Column Conflicts:</strong>
                  </Typography>
                  {previewData.mappingFeedback.conflicts.map((conflict, index) => (
                    <Typography key={index} variant="body2">
                      • {conflict.message}
                    </Typography>
                  ))}
                </Alert>
              )}
              
              {/* Warnings (including unsupported sequencing columns) */}
              {previewData.mappingFeedback.warnings && previewData.mappingFeedback.warnings.length > 0 && (
                previewData.mappingFeedback.warnings.map((warning, index) => (
                  <Alert 
                    key={index}
                    severity={warning.severity === 'warning' ? 'warning' : 'info'} 
                    sx={{ mb: 1 }}
                  >
                    <Typography variant="body2">
                      <strong>{warning.type === 'unsupported_sequencing_columns' ? 'Unsupported Sequencing Columns:' : 'Note:'}</strong> {warning.message}
                    </Typography>
                  </Alert>
                ))
              )}
              
              {/* Unmatched columns */}
              {previewData.mappingFeedback.unmatched && previewData.mappingFeedback.unmatched.length > 0 && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Unrecognized Columns:</strong>
                  </Typography>
                  <Typography variant="body2">
                    These columns weren't recognized and will be ignored: {previewData.mappingFeedback.unmatched.join(', ')}
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          {previewData.errors && previewData.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Validation Errors:</strong>
              </Typography>
              {previewData.errors.slice(0, 5).map((error, index) => (
                <Typography key={index} variant="body2">
                  • {error}
                </Typography>
              ))}
              {previewData.errors.length > 5 && (
                <Typography variant="body2" color="text.secondary">
                  ... and {previewData.errors.length - 5} more errors
                </Typography>
              )}
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle1" gutterBottom>
            Import Options
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.skipDuplicates}
                  onChange={(e) => setOptions({ ...options, skipDuplicates: e.target.checked })}
                />
              }
              label="Skip duplicate specimens"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.updateDuplicates}
                  onChange={(e) => setOptions({ ...options, updateDuplicates: e.target.checked })}
                  disabled={options.skipDuplicates}
                />
              }
              label="Update existing specimens"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.createMissingEntities}
                  onChange={(e) => setOptions({ ...options, createMissingEntities: e.target.checked })}
                />
              }
              label="Create missing collaborators"
            />
          </Box>
          
          <TextField
            label="Batch Size"
            type="number"
            value={options.batchSize}
            onChange={(e) => setOptions({ ...options, batchSize: parseInt(e.target.value) || 500 })}
            size="small"
            sx={{ width: 150 }}
            inputProps={{ min: 100, max: 2000 }}
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" gutterBottom>
            Sample Data Preview
          </Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>Tube ID</TableCell>
                  <TableCell>Preview WUID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Issues</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewData.preview?.slice(0, 10).map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{row.specimen_id || row.tube_id || 'N/A'}</TableCell>
                    <TableCell>
                      {row.preview_wuid ? (
                        <Chip 
                          label={`WUID-${row.preview_wuid}`} 
                          color="primary"
                          variant="outlined"
                          size="small" 
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={row.status || 'Valid'} 
                        color={row.status === 'Error' ? 'error' : 'success'}
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      {row.issues ? (
                        <Typography variant="body2" color="error">
                          {row.issues}
                        </Typography>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );

  const renderResultsStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Import Complete
      </Typography>
      
      {importResults && (
        <Box>
          <Alert severity="success" sx={{ mb: 2 }}>
            Import completed successfully!
          </Alert>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Chip 
              icon={<CheckCircle />} 
              label={`${importResults.created} Created`} 
              color="success" 
            />
            <Chip 
              icon={<CheckCircle />} 
              label={`${importResults.updated} Updated`} 
              color="info" 
            />
            {importResults.errors > 0 && (
              <Chip 
                icon={<ErrorIcon />} 
                label={`${importResults.errors} Errors`} 
                color="error" 
              />
            )}
            {importResults.duplicatesSkipped > 0 && (
              <Chip 
                label={`${importResults.duplicatesSkipped} Skipped`} 
                color="warning" 
              />
            )}
          </Box>

          <Typography variant="body2" color="text.secondary">
            Total processed: {importResults.processed} specimens
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <>
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Import Specimens
      </DialogTitle>
      
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {importing && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              {activeStep === 2 ? 'Processing file...' : activeStep === 3 ? 'Importing specimens...' : 'Processing...'}
            </Typography>
          </Box>
        )}

        {activeStep === 0 && renderImportTypeStep()}
        {activeStep === 1 && importType === 'project' && renderProjectStep()}
        {activeStep === 1 && importType === 'migration' && renderFileUploadStep()}
        {activeStep === 2 && importType === 'project' && renderFileUploadStep()}
        {activeStep === 2 && importType === 'migration' && renderPreviewStep()}
        {activeStep === 3 && importType === 'project' && renderPreviewStep()}
        {activeStep === 3 && importType === 'migration' && renderResultsStep()}
        {activeStep === 4 && importType === 'project' && renderResultsStep()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {(activeStep === 4 && importType === 'project') || (activeStep === 3 && importType === 'migration') ? 'Close' : 'Cancel'}
        </Button>
        
        {activeStep > 0 && ((importType === 'project' && activeStep < 4) || (importType === 'migration' && activeStep < 3)) && (
          <Button onClick={handleBack}>
            Back
          </Button>
        )}
        
        {((importType === 'project' && activeStep < 3) || (importType === 'migration' && activeStep < 2)) && (
          <Button 
            variant="contained" 
            onClick={handleNext}
            disabled={
              (activeStep === 0 && !importType) ||
              (activeStep === 1 && !selectedProject && importType === 'project') ||
              ((activeStep === 2 && importType === 'project') || (activeStep === 1 && importType === 'migration')) && !file
            }
          >
            Next
          </Button>
        )}
        
        {((activeStep === 3 && importType === 'project') || (activeStep === 2 && importType === 'migration')) && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || (previewData?.errors?.length > 0)}
            startIcon={importing ? <CircularProgress size={20} /> : <Upload />}
          >
            {importing ? 'Importing...' : 'Start Import'}
          </Button>
        )}
      </DialogActions>
    </Dialog>

    <TemplateDownloader
      open={templateDialogOpen}
      onClose={() => setTemplateDialogOpen(false)}
      defaultTemplate={importType === 'project' ? 'project_import' : null}
    />
    </>
  );
};

export default SpecimenImport;