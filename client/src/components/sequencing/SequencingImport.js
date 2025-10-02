import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Grid,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import { Upload, CheckCircle, Error, Warning } from '@mui/icons-material';
import axios from 'axios';

const SequencingImport = () => {
  const [file, setFile] = useState(null);
  const [runMetadata, setRunMetadata] = useState({
    sequencing_run: '',
    sequencer_type: 'NovaSeq',
    base_directory: '',
    file_pattern_r1: '_R1.fastq.gz',
    file_pattern_r2: '_R2.fastq.gz',
    library_type: ''
  });
  const [customLibraryType, setCustomLibraryType] = useState('');
  const [showCustomLibraryType, setShowCustomLibraryType] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResults(null);
      setPreview(null); // Clear preview when new file selected
    }
  };

  const handleMetadataChange = (field, value) => {
    setRunMetadata(prev => ({
      ...prev,
      [field]: value
    }));

    // Show custom input when "Other" is selected
    if (field === 'library_type') {
      if (value === 'Other') {
        setShowCustomLibraryType(true);
      } else {
        setShowCustomLibraryType(false);
        setCustomLibraryType('');
      }
    }
  };

  const handlePreview = async () => {
    if (!file) {
      setError('Please select a file to preview');
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await axios.post('/api/sequencing/preview', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setPreview(response.data.preview);

    } catch (err) {
      console.error('Preview error:', err);
      setError(err.response?.data?.error || err.response?.data?.details || 'Failed to preview sequencing data');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file to import');
      return;
    }

    if (!runMetadata.sequencing_run) {
      setError('Please provide sequencing run identifier');
      return;
    }

    if (!runMetadata.base_directory) {
      setError('Please provide base directory path');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('flowcell_id', runMetadata.sequencing_run);
      formData.append('service_request_number', runMetadata.sequencing_run);
      formData.append('sequencer_type', runMetadata.sequencer_type);
      formData.append('base_directory', runMetadata.base_directory);
      formData.append('file_pattern_r1', runMetadata.file_pattern_r1);
      formData.append('file_pattern_r2', runMetadata.file_pattern_r2);

      // Use custom library type if "Other" was selected, otherwise use selected value
      const libraryTypeValue = runMetadata.library_type === 'Other' ? customLibraryType : runMetadata.library_type;
      if (libraryTypeValue) {
        formData.append('library_type', libraryTypeValue);
      }

      const token = localStorage.getItem('token');
      const response = await axios.post('/api/sequencing/import', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setResults(response.data.results);
      setFile(null);

      // Reset file input
      document.getElementById('file-input').value = '';

    } catch (err) {
      console.error('Import error:', err);
      setError(err.response?.data?.error || err.response?.data?.details || 'Failed to import sequencing data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'linked': return 'success';
      case 'no_match': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Import Sequencing Data
        </Typography>

        <Typography variant="body2" color="text.secondary" paragraph>
          Upload sequencing facility CSV/Excel files. The system will automatically link samples to specimens using WUID extraction.
        </Typography>

        {/* Run Metadata */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Run Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Sequencing Run *"
                value={runMetadata.sequencing_run}
                onChange={(e) => handleMetadataChange('sequencing_run', e.target.value)}
                disabled={loading}
                helperText="e.g., N978, NovaSeq_N978"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Sequencer Type"
                value={runMetadata.sequencer_type}
                onChange={(e) => handleMetadataChange('sequencer_type', e.target.value)}
                disabled={loading}
                helperText="Optional"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Base Directory *"
                value={runMetadata.base_directory}
                onChange={(e) => handleMetadataChange('base_directory', e.target.value)}
                disabled={loading}
                helperText="Directory path where FASTQ files are stored (e.g., /lts/sahlab/data4/DATA_DOWNLOADS_3/NovaSeq_N978)"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="File Pattern R1"
                value={runMetadata.file_pattern_r1}
                onChange={(e) => handleMetadataChange('file_pattern_r1', e.target.value)}
                disabled={loading}
                helperText="Default: _R1.fastq.gz"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="File Pattern R2"
                value={runMetadata.file_pattern_r2}
                onChange={(e) => handleMetadataChange('file_pattern_r2', e.target.value)}
                disabled={loading}
                helperText="Default: _R2.fastq.gz"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Library/Sequencing Type"
                value={runMetadata.library_type}
                onChange={(e) => handleMetadataChange('library_type', e.target.value)}
                disabled={loading}
                helperText="Optional - e.g., 16S, Metagenomic, WGS"
                SelectProps={{ native: true }}
              >
                <option value=""></option>
                <option value="16S">16S</option>
                <option value="Metagenomic">Metagenomic</option>
                <option value="WGS">WGS (Whole Genome Sequencing)</option>
                <option value="RNA-Seq">RNA-Seq</option>
                <option value="Other">Other (specify below)</option>
              </TextField>
            </Grid>

            {showCustomLibraryType && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Custom Library Type"
                  value={customLibraryType}
                  onChange={(e) => setCustomLibraryType(e.target.value)}
                  disabled={loading}
                  helperText="Enter custom library/sequencing type"
                  placeholder="e.g., Amplicon, Targeted, etc."
                />
              </Grid>
            )}
          </Grid>

          {/* Path Preview */}
          {runMetadata.base_directory && runMetadata.sequencing_run && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                <strong>Path Preview (example)</strong>
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  wordBreak: 'break-all',
                  overflowWrap: 'break-word'
                }}
              >
                {runMetadata.base_directory}/{runMetadata.sequencing_run}_[Library_Name]{runMetadata.file_pattern_r1}
                <br/>
                {runMetadata.base_directory}/{runMetadata.sequencing_run}_[Library_Name]{runMetadata.file_pattern_r2}
              </Typography>
            </Box>
          )}
        </Box>

        {/* File Upload */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Upload Data File
          </Typography>
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={loading}
          />
          <label htmlFor="file-input">
            <Button
              variant="outlined"
              component="span"
              startIcon={<Upload />}
              disabled={loading}
            >
              Select CSV/Excel File
            </Button>
          </label>
          {file && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                Selected: {file.name}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={handlePreview}
                disabled={loading}
                sx={{ mt: 1 }}
              >
                Preview Import
              </Button>
            </Box>
          )}
        </Box>

        {/* Preview Section */}
        {preview && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
            <Typography variant="h6" gutterBottom>
              Import Preview
            </Typography>

            {/* Warnings */}
            {preview.warnings && preview.warnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Warnings:</strong>
                </Typography>
                {preview.warnings.map((warning, idx) => (
                  <Typography key={idx} variant="body2">
                    • {warning}
                  </Typography>
                ))}
              </Alert>
            )}

            {/* Metadata Summary */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h5">{preview.total_samples}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Samples</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                  <Typography variant="h5">{preview.samples_with_wuid}</Typography>
                  <Typography variant="body2">Will Link to Specimens</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Completion Date</Typography>
                  <Typography variant="h6">{preview.completion_date_display}</Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Sample Preview Table */}
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
              <strong>First 5 Samples:</strong>
            </Typography>
            <TableContainer component={Paper} sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Row</TableCell>
                    <TableCell>Library Name</TableCell>
                    <TableCell>WUID</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.sample_previews.map((sample) => (
                    <TableRow key={sample.row}>
                      <TableCell>{sample.row}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {sample.facility_sample_name}
                      </TableCell>
                      <TableCell>{sample.wuid || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip
                          label={sample.has_wuid ? 'Will Link' : 'No WUID'}
                          color={sample.has_wuid ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Import Button */}
        <Button
          variant="contained"
          color="primary"
          onClick={handleImport}
          disabled={loading || !file}
          sx={{ mb: 3 }}
        >
          {preview ? 'Confirm & Import Sequencing Data' : 'Import Sequencing Data'}
        </Button>

        {/* Loading */}
        {loading && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1 }}>
              Importing sequencing data...
            </Typography>
          </Box>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Results */}
        {results && (
          <Box sx={{ mt: 3 }}>
            <Alert severity="success" sx={{ mb: 2 }}>
              Import completed! Run #{results.run_number} created.
            </Alert>

            {/* Summary Stats */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light' }}>
                  <Typography variant="h4">{results.linked}</Typography>
                  <Typography variant="body2">Linked</Typography>
                </Paper>
              </Grid>
              <Grid item xs={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light' }}>
                  <Typography variant="h4">{results.no_match}</Typography>
                  <Typography variant="body2">No Match</Typography>
                </Paper>
              </Grid>
              <Grid item xs={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.light' }}>
                  <Typography variant="h4">{results.failed}</Typography>
                  <Typography variant="body2">Failed</Typography>
                </Paper>
              </Grid>
              <Grid item xs={3}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'info.light' }}>
                  <Typography variant="h4">{results.success}</Typography>
                  <Typography variant="body2">Total</Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Error Details */}
            {results.errors && results.errors.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Import Errors ({results.errors.length})
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Row</TableCell>
                        <TableCell>Sample Name</TableCell>
                        <TableCell>Error</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.errors.map((err, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{err.row}</TableCell>
                          <TableCell>{err.facility_sample_name}</TableCell>
                          <TableCell>{err.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Box>
        )}

        {/* Instructions */}
        <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            <strong>Upload your SampleMap2 file</strong>
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            The system expects a CSV/Excel file with the following columns from your sequencing facility:
          </Typography>
          <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 2 }}>
            Library Name, FASTQ Path - Read 1, FASTQ Path - Read 2, Flowcell ID, Index Sequence,
            Total Reads, % &gt;Q30 Read 1, % &gt;Q30 Read 2, Date Complete, etc.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Automatic Linking:</strong> The WUID (specimen number) is extracted from the <strong>second position</strong> of
            the Library Name column (e.g., from "I13129_<strong>39552</strong>_Sample_Name", the system extracts 39552
            and links it to specimen #39552 in your database).
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default SequencingImport;