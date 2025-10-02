import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Grid,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Search as SearchIcon,
  Upload as UploadIcon,
  GetApp as ExportIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  CheckCircle as FoundIcon,
  Error as NotFoundIcon,
  CloudUpload as FileUploadIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { specimenAPI } from '../../services/api';
import { formatDate, getLocationString } from '../../utils/helpers';
import { toast } from 'react-toastify';
import ExportDialog from '../common/ExportDialog';

const BulkSearch = ({ open, onClose }) => {
  const [identifierText, setIdentifierText] = useState('');
  const [searchField, setSearchField] = useState('specimen_number');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [inputMethod, setInputMethod] = useState(0); // 0 = text, 1 = file
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const navigate = useNavigate();

  // File processing functions
  const parseFileContent = (content, filename) => {
    const extension = filename.toLowerCase().split('.').pop();
    
    if (extension === 'csv') {
      // Parse CSV - extract first column or all values if single column
      const lines = content.split('\n').filter(line => line.trim());
      const identifiers = [];
      
      lines.forEach(line => {
        // Split by comma and take first value, or handle single column
        const values = line.split(',').map(v => v.trim()).filter(Boolean);
        if (values.length > 0) {
          identifiers.push(values[0]); // Take first column
        }
      });
      
      return identifiers;
    } else {
      // Parse TXT - one identifier per line
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    setFileError('');
    
    if (acceptedFiles.length === 0) {
      setFileError('Please upload a CSV or TXT file');
      return;
    }

    const file = acceptedFiles[0];
    const extension = file.name.toLowerCase().split('.').pop();
    
    if (!['csv', 'txt'].includes(extension)) {
      setFileError('Only CSV and TXT files are supported');
      return;
    }

    if (file.size > 1024 * 1024) { // 1MB limit
      setFileError('File size must be less than 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const identifiers = parseFileContent(content, file.name);
        
        if (identifiers.length === 0) {
          setFileError('No valid identifiers found in file');
          return;
        }

        if (identifiers.length > 1000) {
          setFileError('File contains more than 1000 identifiers. Please limit to 1000 or fewer.');
          return;
        }

        // Set the parsed identifiers as text
        setIdentifierText(identifiers.join('\n'));
        setUploadedFile(file);
        toast.success(`Loaded ${identifiers.length} identifiers from ${file.name}`);
        
      } catch (err) {
        setFileError(`Error parsing file: ${err.message}`);
      }
    };

    reader.onerror = () => {
      setFileError('Error reading file');
    };

    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/csv': ['.csv']
    },
    maxFiles: 1
  });

  const handleSearch = async () => {
    if (!identifierText.trim()) {
      setError('Please enter at least one identifier');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Parse identifiers from text input
      const identifiers = identifierText
        .split(/[,;\n\r]+/)
        .map(id => id.trim())
        .filter(Boolean);

      if (identifiers.length === 0) {
        setError('No valid identifiers found');
        setLoading(false);
        return;
      }

      if (identifiers.length > 1000) {
        setError('Maximum 1000 identifiers allowed per search');
        setLoading(false);
        return;
      }

      const response = await specimenAPI.bulkSearch({
        identifiers,
        searchField
      });

      setResults(response.data);
      
      // Show success message with summary
      const { summary } = response.data;
      toast.success(
        `Search completed: ${summary.found_count} found, ${summary.missing_count} missing out of ${summary.total_searched} searched`
      );

    } catch (err) {
      console.error('Bulk search error:', err);
      setError(err.response?.data?.msg || 'Search failed. Please try again.');
      toast.error('Bulk search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setIdentifierText('');
    setResults(null);
    setError('');
    setFileError('');
    setUploadedFile(null);
  };

  const handleClose = () => {
    handleClear();
    onClose();
  };

  const handleViewSpecimen = (specimenId) => {
    navigate(`/specimens/${specimenId}`);
    handleClose();
  };

  const formatFoundIdentifiers = (identifiers) => {
    return identifiers.join(', ');
  };

  const handleOpenExportDialog = () => {
    if (!results || !results.specimens || results.specimens.length === 0) {
      toast.error('No results to export');
      return;
    }
    setExportDialogOpen(true);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{ sx: { height: '90vh' } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Bulk Specimen Search</Typography>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        <Grid container spacing={3}>
          {/* Input Section */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: 'fit-content' }}>
              <Typography variant="h6" gutterBottom>
                Search Identifiers
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Search Field</InputLabel>
                <Select
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  label="Search Field"
                >
                  <MenuItem value="specimen_number">WUID (Default)</MenuItem>
                  <MenuItem value="tube_id">Tube ID Only</MenuItem>
                  <MenuItem value="auto">Smart Auto-detect</MenuItem>
                </Select>
              </FormControl>

              <Tabs 
                value={inputMethod} 
                onChange={(e, newValue) => setInputMethod(newValue)}
                sx={{ mb: 2 }}
              >
                <Tab label="Text Input" />
                <Tab label="File Upload" />
              </Tabs>

              {inputMethod === 0 ? (
                // Text Input Tab
                <TextField
                  fullWidth
                  multiline
                  rows={8}
                  value={identifierText}
                  onChange={(e) => setIdentifierText(e.target.value)}
                  placeholder="Enter WUIDs (one per line or comma-separated):&#10;123, 456, 789&#10;1001, 1002, 1003"
                  sx={{ mb: 2 }}
                />
              ) : (
                // File Upload Tab
                <Box sx={{ mb: 2 }}>
                  <Paper
                    {...getRootProps()}
                    sx={{
                      p: 3,
                      textAlign: 'center',
                      border: '2px dashed',
                      borderColor: isDragActive ? 'primary.main' : 'grey.300',
                      backgroundColor: isDragActive ? 'action.hover' : 'transparent',
                      cursor: 'pointer',
                      mb: 2,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                        borderColor: 'primary.main'
                      }
                    }}
                  >
                    <input {...getInputProps()} />
                    <FileUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body1" gutterBottom>
                      {isDragActive ? 'Drop file here' : 'Drag & drop file here, or click to browse'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Supports CSV and TXT files • Max 1MB • Up to 1000 WUIDs
                    </Typography>
                  </Paper>
                  
                  {uploadedFile && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FileIcon />
                        <Typography variant="body2">
                          {uploadedFile.name} loaded successfully
                        </Typography>
                      </Box>
                    </Alert>
                  )}
                  
                  {fileError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {fileError}
                    </Alert>
                  )}

                  {/* Preview of loaded identifiers */}
                  {identifierText && (
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      value={identifierText}
                      onChange={(e) => setIdentifierText(e.target.value)}
                      label="Loaded Identifiers (editable)"
                      variant="outlined"
                      size="small"
                    />
                  )}
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleSearch}
                  disabled={loading || !identifierText.trim()}
                  startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
                  fullWidth
                >
                  {loading ? 'Searching...' : 'Search'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleClear}
                  disabled={loading}
                >
                  Clear
                </Button>
              </Box>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* Instructions */}
              <Typography variant="body2" color="text.secondary">
                <strong>Instructions:</strong><br />
                • <strong>Text Input:</strong> Enter WUIDs separated by commas, semicolons, or new lines<br />
                • <strong>File Upload:</strong> CSV files (first column) or TXT files (one per line)<br />
                • WUID search is precise and recommended for most cases<br />
                • Use "Tube ID Only" for alphanumeric tube identifiers<br />
                • Maximum 1000 identifiers per search • Duplicates removed automatically
              </Typography>
            </Paper>
          </Grid>

          {/* Results Section */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, height: '70vh', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Search Results
              </Typography>

              {results ? (
                <>
                  {/* Summary */}
                  <Box sx={{ mb: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item>
                        <Chip 
                          icon={<FoundIcon />} 
                          label={`${results.summary.found_count} Found`} 
                          color="success" 
                          variant="outlined" 
                        />
                      </Grid>
                      <Grid item>
                        <Chip 
                          icon={<NotFoundIcon />} 
                          label={`${results.summary.missing_count} Missing`} 
                          color="error" 
                          variant="outlined" 
                        />
                      </Grid>
                      <Grid item>
                        <Chip 
                          label={`${results.summary.total_searched} Total Searched`} 
                          variant="outlined" 
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  {/* Found Specimens Table */}
                  {results.specimens.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Found Specimens ({results.specimens.length})
                      </Typography>
                      <TableContainer sx={{ flexGrow: 1, mb: 2 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>WUID</TableCell>
                              <TableCell>Tube ID</TableCell>
                              <TableCell>Project</TableCell>
                              <TableCell>Patient</TableCell>
                              <TableCell>Disease</TableCell>
                              <TableCell>Location</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {results.specimens.map((specimen) => (
                              <TableRow key={specimen.id}>
                                <TableCell>
                                  <strong>{specimen.specimen_number}</strong>
                                </TableCell>
                                <TableCell>{specimen.tube_id || '-'}</TableCell>
                                <TableCell>
                                  {specimen.project_number}: {specimen.disease}
                                </TableCell>
                                <TableCell>
                                  {specimen.patient_name || specimen.patient_external_id || '-'}
                                </TableCell>
                                <TableCell>{specimen.specimen_type || '-'}</TableCell>
                                <TableCell>
                                  {getLocationString({
                                    position_freezer: specimen.position_freezer,
                                    position_rack: specimen.position_rack,
                                    position_box: specimen.position_box,
                                    position_dimension_one: specimen.position_dimension_one,
                                    position_dimension_two: specimen.position_dimension_two
                                  })}
                                </TableCell>
                                <TableCell>
                                  <Tooltip title="View Details">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleViewSpecimen(specimen.id)}
                                    >
                                      <ViewIcon />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}

                  {/* Missing Identifiers */}
                  {results.summary.missing_identifiers.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Not Found ({results.summary.missing_identifiers.length})
                      </Typography>
                      <Alert severity="warning">
                        <Typography variant="body2">
                          <strong>Missing identifiers:</strong><br />
                          {results.summary.missing_identifiers.join(', ')}
                        </Typography>
                      </Alert>
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '100%', 
                  color: 'text.secondary' 
                }}>
                  <Typography variant="body1">
                    Enter identifiers and click Search to see results
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose}>Close</Button>
        {results && results.specimens.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleOpenExportDialog}
          >
            Export CSV ({results.specimens.length})
          </Button>
        )}
      </DialogActions>
      
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        bulkSearchResults={results}
        exportMode="quick"
      />
    </Dialog>
  );
};

export default BulkSearch;