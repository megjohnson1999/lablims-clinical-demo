import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider
} from '@mui/material';
import { Upload, CloudUpload } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const ImportDialog = ({ open, onClose, onImportComplete }) => {
  const { token } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState('');
  const [options, setOptions] = useState({
    skipDuplicates: false,
    updateDuplicates: true,
    batchSize: 1000
  });

  const steps = ['Upload File', 'Preview Data', 'Import'];

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
    try {
      setError('');
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post('/api/import/preview', formData);

      setPreviewData(response.data);
      setActiveStep(1);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to preview file');
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      setError('');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('skipDuplicates', options.skipDuplicates);
      formData.append('updateDuplicates', options.updateDuplicates);
      formData.append('batchSize', options.batchSize);

      const response = await axios.post('/api/import/execute', formData);

      setImportResults(response.data.results);
      setImportComplete(true);
      setActiveStep(2);
      
      if (onImportComplete) {
        onImportComplete(response.data.results);
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setFile(null);
    setPreviewData(null);
    setImporting(false);
    setImportComplete(false);
    setImportResults(null);
    setError('');
    onClose();
  };

  const renderUploadStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Upload Excel or CSV File
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Upload an Excel (.xlsx) or CSV file with specimen data. The file should have the same format as our export files.
      </Typography>
      
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
          <Button
            variant="contained"
            onClick={() => handlePreview(file)}
            disabled={!file}
          >
            Preview Data
          </Button>
        </Box>
      )}
    </Box>
  );

  const renderPreviewStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Preview Import Data
      </Typography>
      
      {previewData && (
        <Box>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Total Rows:</strong> {previewData.totalRows}
            </Typography>
            <Typography variant="body2">
              <strong>Preview Rows:</strong> {previewData.previewRows}
            </Typography>
            {previewData.unmatchedHeaders.length > 0 && (
              <Typography variant="body2" color="warning.main">
                <strong>Unmatched Headers:</strong> {previewData.unmatchedHeaders.join(', ')}
              </Typography>
            )}
          </Box>

          {previewData.validationErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Validation Errors ({previewData.validationErrors.length}):</strong>
              </Typography>
              {previewData.validationErrors.slice(0, 5).map((error, index) => (
                <Typography key={index} variant="body2">
                  • {error}
                </Typography>
              ))}
              {previewData.hasMoreErrors && (
                <Typography variant="body2" color="text.secondary">
                  ... and more errors
                </Typography>
              )}
            </Alert>
          )}

          {previewData.duplicates.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Duplicate Specimens Found ({previewData.duplicates.length}):</strong>
              </Typography>
              <Typography variant="body2">
                {previewData.duplicates.slice(0, 5).join(', ')}
                {previewData.duplicates.length > 5 && '...'}
              </Typography>
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle1" gutterBottom>
            Import Options
          </Typography>
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
          <TextField
            label="Batch Size"
            type="number"
            value={options.batchSize}
            onChange={(e) => setOptions({ ...options, batchSize: parseInt(e.target.value) || 1000 })}
            size="small"
            sx={{ ml: 2, width: 120 }}
            inputProps={{ min: 100, max: 5000 }}
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" gutterBottom>
            Sample Data Preview
          </Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Specimen ID</TableCell>
                  <TableCell>PI Name</TableCell>
                  <TableCell>Disease</TableCell>
                  <TableCell>Specimen Type</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewData.preview.slice(0, 10).map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.tube_id || row.specimen_id}</TableCell>
                    <TableCell>{row.pi_name}</TableCell>
                    <TableCell>{row.disease}</TableCell>
                    <TableCell>{row.specimen_type}</TableCell>
                    <TableCell>
                      {previewData.duplicates.includes(row.tube_id || row.specimen_id) ? (
                        <Chip label="Duplicate" color="warning" size="small" />
                      ) : (
                        <Chip label="New" color="success" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={previewData.validationErrors.length > 0 || importing}
              startIcon={importing ? <CircularProgress size={20} /> : <Upload />}
            >
              {importing ? 'Importing...' : 'Start Import'}
            </Button>
            <Button sx={{ ml: 1 }} onClick={() => setActiveStep(0)}>
              Back
            </Button>
          </Box>
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

          <Box sx={{ mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              <strong>Import Summary:</strong>
            </Typography>
            <Typography variant="body2">
              • Total processed: {importResults.processed}
            </Typography>
            <Typography variant="body2">
              • New specimens created: {importResults.created}
            </Typography>
            <Typography variant="body2">
              • Existing specimens updated: {importResults.updated}
            </Typography>
            {importResults.duplicatesSkipped > 0 && (
              <Typography variant="body2">
                • Duplicates skipped: {importResults.duplicatesSkipped}
              </Typography>
            )}
            {importResults.errors.length > 0 && (
              <Typography variant="body2" color="error">
                • Errors encountered: {importResults.errors.length}
              </Typography>
            )}
          </Box>

          {importResults.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Errors:</strong>
              </Typography>
              {importResults.errors.slice(0, 5).map((error, index) => (
                <Typography key={index} variant="body2">
                  • Row {error.row} ({error.tube_id}): {error.error}
                </Typography>
              ))}
              {importResults.errors.length > 5 && (
                <Typography variant="body2">
                  ... and {importResults.errors.length - 5} more errors
                </Typography>
              )}
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Import Specimen Data
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

        {activeStep === 0 && renderUploadStep()}
        {activeStep === 1 && renderPreviewStep()}
        {activeStep === 2 && renderResultsStep()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {importComplete ? 'Close' : 'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportDialog;