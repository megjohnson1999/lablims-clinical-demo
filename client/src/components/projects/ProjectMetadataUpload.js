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
  TextField,
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
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { projectAPI, specimenAPI } from '../../services/api';

const ProjectMetadataUpload = ({ open, onClose, project, onSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // File upload state
  const [file, setFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  
  // Specimen matching state
  const [specimens, setSpecimens] = useState([]);
  const [specimenMatchColumn, setSpecimenMatchColumn] = useState('');
  const [matchResults, setMatchResults] = useState([]);
  
  // Validation state
  const [validationResults, setValidationResults] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const steps = [
    'Upload CSV File',
    'Configure Specimen Matching',
    'Review & Validate',
    'Apply Metadata'
  ];

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    console.log('🔍 Dialog state changed:', { open, project: project?.id });
    if (open) {
      console.log('🔍 Opening metadata upload dialog for project:', project?.id);
      setActiveStep(0);
      setFile(null);
      setCsvData([]);
      setCsvHeaders([]);
      setSpecimens([]);
      setSpecimenMatchColumn('');
      setMatchResults([]);
      setValidationResults(null);
      setUploadProgress(0);
      setError('');
      
      // Fetch project specimens
      fetchProjectSpecimens();
    }
  }, [open]);

  const fetchProjectSpecimens = async () => {
    if (!project) return;
    
    try {
      setLoading(true);
      const response = await projectAPI.getSpecimens(project.id);
      const specimens = response.data || response.data.specimens || [];
      console.log('🔍 Fetched specimens for project:', project.id, specimens.length, specimens.slice(0, 3));
      setSpecimens(specimens);
    } catch (err) {
      console.error('Error fetching project specimens:', err);
      setError('Failed to load project specimens');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = useCallback((event) => {
    const selectedFile = event.target.files[0];
    console.log('🔍 File selected:', selectedFile?.name);
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

  const handleSpecimenMatching = async () => {
    if (!specimenMatchColumn) {
      setError('Please select a specimen matching column');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔍 Starting specimen matching:', {
        specimenMatchColumn,
        csvDataCount: csvData.length,
        specimensCount: specimens.length,
        firstCsvRow: csvData[0],
        firstSpecimen: specimens[0]
      });

      const results = csvData.map(row => {
        const csvSpecimenId = row[specimenMatchColumn];
        
        // Enhanced matching with multiple strategies
        let matchedSpecimen = null;
        let matchType = 'none';
        
        // Strategy 1: Exact match (fastest, most reliable)
        matchedSpecimen = specimens.find(specimen => 
          specimen.tube_id === csvSpecimenId ||
          specimen.specimen_number === csvSpecimenId ||
          specimen.id === csvSpecimenId
        );
        if (matchedSpecimen) {
          matchType = 'exact';
        }
        
        // Strategy 2: Partial matching if no exact match found
        if (!matchedSpecimen && csvSpecimenId) {
          // Try: CSV value contained in specimen tube_id (e.g., "GEMM_001_12M" in "01_GEMM_001_12M")
          matchedSpecimen = specimens.find(specimen => 
            specimen.tube_id && specimen.tube_id.includes(csvSpecimenId)
          );
          if (matchedSpecimen) {
            matchType = 'partial_csv_in_specimen';
          }
          
          // Try: Specimen tube_id contained in CSV value (e.g., "GEMM_001" in "GEMM_001_12M")
          if (!matchedSpecimen) {
            matchedSpecimen = specimens.find(specimen => 
              specimen.tube_id && csvSpecimenId.includes(specimen.tube_id)
            );
            if (matchedSpecimen) {
              matchType = 'partial_specimen_in_csv';
            }
          }
          
          // Try: Remove common prefixes and match (e.g., "01_GEMM_001_12M" → "GEMM_001_12M")
          if (!matchedSpecimen) {
            const normalizedCsvId = csvSpecimenId.replace(/^\d+_/, ''); // Remove number + underscore prefix
            matchedSpecimen = specimens.find(specimen => {
              if (!specimen.tube_id) return false;
              const normalizedSpecimenId = specimen.tube_id.replace(/^\d+_/, '');
              return normalizedSpecimenId === normalizedCsvId || 
                     normalizedSpecimenId === csvSpecimenId ||
                     specimen.tube_id === normalizedCsvId;
            });
            if (matchedSpecimen) {
              matchType = 'partial_normalized';
            }
          }
        }

        console.log('🔍 Matching row:', csvSpecimenId, '→', matchedSpecimen ? `FOUND (${matchType})` : 'NOT FOUND');

        return {
          csvRow: row,
          csvSpecimenId,
          matchedSpecimen,
          isMatched: !!matchedSpecimen,
          matchType,
          matchConfidence: matchType === 'exact' ? 'high' : matchType !== 'none' ? 'medium' : 'none',
          metadata: Object.keys(row).reduce((acc, key) => {
            if (key !== specimenMatchColumn) {
              acc[key] = row[key];
            }
            return acc;
          }, {})
        };
      });

      console.log('🔍 Match results:', results.filter(r => r.isMatched).length, 'matched out of', results.length);
      setMatchResults(results);
      
      // Generate validation results immediately after matching
      const matchedResults = results.filter(result => result.isMatched);
      const unmatchedResults = results.filter(result => !result.isMatched);

      // Calculate match confidence statistics
      const exactMatches = matchedResults.filter(r => r.matchType === 'exact').length;
      const partialMatches = matchedResults.filter(r => r.matchType !== 'exact').length;
      
      const validationSummary = {
        totalRows: results.length,
        matchedCount: matchedResults.length,
        unmatchedCount: unmatchedResults.length,
        exactMatches,
        partialMatches,
        metadataFields: [...new Set(csvHeaders.filter(h => h !== specimenMatchColumn))],
        unmatchedSpecimens: unmatchedResults.map(r => r.csvSpecimenId),
        sampleMetadata: matchedResults.slice(0, 3).map(r => r.metadata), // Show first 3 as sample
        matchDetails: results.map(r => ({
          csvId: r.csvSpecimenId,
          matched: r.isMatched,
          matchType: r.matchType,
          confidence: r.matchConfidence,
          specimenId: r.matchedSpecimen?.tube_id || null
        }))
      };

      console.log('🔍 Generated validation summary immediately:', validationSummary);
      setValidationResults(validationSummary);
      setActiveStep(2);
    } catch (err) {
      console.error('Error matching specimens:', err);
      setError('Failed to match specimens');
    } finally {
      setLoading(false);
    }
  };


  const handleApplyMetadata = async () => {
    setLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      const matchedResults = matchResults.filter(result => result.isMatched);
      
      if (matchedResults.length === 0) {
        setError('No specimens matched. Cannot apply metadata.');
        return;
      }

      // Apply metadata in batches to show progress
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < matchedResults.length; i += batchSize) {
        batches.push(matchedResults.slice(i, i + batchSize));
      }

      let processedCount = 0;
      const totalCount = matchedResults.length;

      const errors = [];
      let successCount = 0;

      for (const batch of batches) {
        // Process batch with individual error handling
        const batchResults = await Promise.allSettled(
          batch.map(result => 
            specimenAPI.updateMetadata(result.matchedSpecimen.id, result.metadata)
              .then(() => ({ success: true, specimen: result.matchedSpecimen }))
              .catch(error => ({ 
                success: false, 
                specimen: result.matchedSpecimen, 
                error: error.response?.data || error.message 
              }))
          )
        );
        
        // Process results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              successCount++;
            } else {
              errors.push({
                specimen: result.value.specimen,
                error: result.value.error
              });
            }
          } else {
            errors.push({
              specimen: batch[index].matchedSpecimen,
              error: result.reason?.response?.data || result.reason?.message || 'Unknown error'
            });
          }
        });
        
        processedCount += batch.length;
        setUploadProgress((processedCount / totalCount) * 100);
      }

      // Provide detailed success/failure feedback
      if (errors.length === 0) {
        toast.success(`Successfully updated ${successCount} specimens with metadata`);
        onSuccess && onSuccess();
      } else {
        // Helper function to analyze error patterns
        const getTopErrorReasons = (errors) => {
          const reasonCounts = {};
          errors.forEach(({ error }) => {
            let reason = 'Unknown error';
            if (typeof error === 'string') {
              reason = error;
            } else if (error?.message) {
              reason = error.message;
            } else if (error?.msg) {
              reason = error.msg;
            }
            
            // Categorize common errors
            if (reason.includes('foreign key') || reason.includes('constraint')) {
              reason = 'Database constraint violation';
            } else if (reason.includes('metadata') && reason.includes('valid')) {
              reason = 'Invalid metadata format';
            } else if (reason.includes('not found')) {
              reason = 'Specimen not found';
            } else if (reason.includes('authorization') || reason.includes('denied')) {
              reason = 'Permission denied';
            }
            
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
          });
          
          return Object.entries(reasonCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([reason, count]) => `${reason} (${count})`);
        };

        const errorMessage = `Updated ${successCount} specimens successfully, but ${errors.length} failed. ` +
          `Common issues: ${getTopErrorReasons(errors).slice(0, 2).join(', ')}. ` +
          `Check console for detailed error information.`;
        
        console.error('Metadata update errors:', errors);
        setError(errorMessage);
        
        // Still call onSuccess if some succeeded
        if (successCount > 0) {
          onSuccess && onSuccess();
        }
      }
    } catch (err) {
      console.error('Error applying metadata:', err);
      setError(`Failed to apply metadata: ${err.response?.data?.message || err.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    console.log('🔍 handleNext called for step:', activeStep);
    switch (activeStep) {
      case 1:
        console.log('🔍 Calling handleSpecimenMatching...');
        handleSpecimenMatching();
        break;
      case 2:
        console.log('🔍 Moving from Review step to Apply step');
        setActiveStep(3);
        break;
      case 3:
        console.log('🔍 Calling handleApplyMetadata...');
        handleApplyMetadata();
        break;
      default:
        console.log('🔍 Default: incrementing step from', activeStep, 'to', activeStep + 1);
        setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError('');
  };

  const canProceed = () => {
    const result = (() => {
      switch (activeStep) {
        case 0:
          return csvData.length > 0 && csvHeaders.length > 0;
        case 1:
          return specimenMatchColumn !== '';
        case 2:
          // Allow proceeding if we have validation results
          return validationResults && validationResults.matchedCount > 0;
        case 3:
          return false; // Final step
        default:
          return false;
      }
    })();
    
    console.log('🔍 canProceed check:', {
      activeStep,
      result,
      validationResults,
      validationResultsExists: !!validationResults,
      matchedCount: validationResults?.matchedCount,
      matchResultsLength: matchResults.length
    });
    
    return result;
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Upload a CSV or TSV file containing specimen metadata. The file should include a column 
              that can be used to match specimens (tube_id, WUID, etc.).
            </Typography>
            
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
              Select which column in your CSV contains the specimen identifiers to match 
              against specimens in this project.
            </Typography>

            <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
              <InputLabel>Specimen Matching Column</InputLabel>
              <Select
                value={specimenMatchColumn}
                onChange={(e) => setSpecimenMatchColumn(e.target.value)}
                label="Specimen Matching Column"
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
                <strong>Project:</strong> {project?.project_id || project?.project_number}<br />
                <strong>Available Specimens:</strong> {specimens.length}<br />
                <strong>Sample Specimen IDs:</strong> {specimens.slice(0, 3).map(s => s.tube_id || s.specimen_number).join(', ')}
                {specimens.length > 3 && '...'}
              </Typography>
            </Alert>

            {specimenMatchColumn && csvData.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Sample Values from {specimenMatchColumn}:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {[...new Set(csvData.slice(0, 5).map(row => row[specimenMatchColumn]))].map((value, index) => (
                    <Chip key={index} label={value} size="small" />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        );

      case 2:
        console.log('🔍 Rendering step 2. State:', { 
          loading, 
          validationResults: !!validationResults,
          validationResultsKeys: validationResults ? Object.keys(validationResults) : 'none'
        });
        
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Review the matching results and metadata that will be applied to specimens.
            </Typography>

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Processing specimen matching...</Typography>
              </Box>
            )}

            {!loading && !validationResults && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography>
                  No validation results available. Please go back and configure specimen matching.
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Debug: loading={loading.toString()}, validationResults={validationResults ? 'exists' : 'null'}
                </Typography>
              </Alert>
            )}

            {!loading && validationResults && (
              <Box sx={{ mt: 2 }}>
                <Alert severity={validationResults.unmatchedCount > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Matching Summary:</strong><br />
                    • Total CSV rows: {validationResults.totalRows}<br />
                    • Matched specimens: {validationResults.matchedCount}<br />
                    • Unmatched rows: {validationResults.unmatchedCount}<br />
                    • Metadata fields: {validationResults.metadataFields.length}<br />
                    {validationResults.exactMatches > 0 && (
                      <>• Exact matches: {validationResults.exactMatches}<br /></>
                    )}
                    {validationResults.partialMatches > 0 && (
                      <>• Partial matches: {validationResults.partialMatches}<br /></>
                    )}
                  </Typography>
                </Alert>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">
                      Metadata Fields ({validationResults.metadataFields.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {validationResults.metadataFields.map((field, index) => (
                        <Chip key={index} label={field} size="small" />
                      ))}
                    </Box>
                  </AccordionDetails>
                </Accordion>

                {validationResults.unmatchedCount > 0 && (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2" color="warning.main">
                        Unmatched Specimens ({validationResults.unmatchedCount})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {validationResults.unmatchedSpecimens.slice(0, 10).map((id, index) => (
                          <Chip key={index} label={id} size="small" color="warning" />
                        ))}
                        {validationResults.unmatchedSpecimens.length > 10 && (
                          <Chip label={`+${validationResults.unmatchedSpecimens.length - 10} more`} size="small" />
                        )}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                )}

                {validationResults.matchedCount > 0 && (
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">
                        Match Details ({validationResults.matchedCount} matches)
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>CSV Identifier</TableCell>
                              <TableCell>Matched Specimen</TableCell>
                              <TableCell>Match Type</TableCell>
                              <TableCell>Confidence</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {validationResults.matchDetails
                              .filter(detail => detail.matched)
                              .slice(0, 10)
                              .map((detail, index) => (
                                <TableRow key={index}>
                                  <TableCell>{detail.csvId}</TableCell>
                                  <TableCell>{detail.specimenId}</TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={detail.matchType.replace(/_/g, ' ')} 
                                      size="small"
                                      color={detail.confidence === 'high' ? 'success' : 'warning'}
                                      variant="outlined"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={detail.confidence} 
                                      size="small"
                                      color={detail.confidence === 'high' ? 'success' : 'warning'}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            {validationResults.matchedCount > 10 && (
                              <TableRow>
                                <TableCell colSpan={4} sx={{ textAlign: 'center', fontStyle: 'italic' }}>
                                  ... and {validationResults.matchedCount - 10} more matches
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </AccordionDetails>
                  </Accordion>
                )}

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">
                      Sample Metadata Preview
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            {validationResults.metadataFields.map((field) => (
                              <TableCell key={field}>{field}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {validationResults.sampleMetadata.map((metadata, index) => (
                            <TableRow key={index}>
                              {validationResults.metadataFields.map((field) => (
                                <TableCell key={field}>
                                  {metadata[field] || '—'}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              </Box>
            )}
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Apply metadata to matched specimens. This will update the specimen records 
              with the metadata from your CSV file.
            </Typography>

            {loading && (
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Applying metadata... {Math.round(uploadProgress)}% complete
                </Typography>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}

            {validationResults && !loading && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Ready to update <strong>{validationResults.matchedCount}</strong> specimens 
                  with <strong>{validationResults.metadataFields.length}</strong> metadata fields.
                  {validationResults.unmatchedCount > 0 && (
                    <><br /><strong>Note:</strong> {validationResults.unmatchedCount} rows will be skipped (no matching specimens).</>
                  )}
                </Typography>
              </Alert>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Upload Metadata - {project?.project_id || project?.project_number}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
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
        
        {activeStep === steps.length - 1 && (
          <Button
            onClick={handleApplyMetadata}
            variant="contained"
            color="primary"
            disabled={loading || !validationResults || validationResults.matchedCount === 0}
            startIcon={loading ? <CircularProgress size={20} /> : <CheckIcon />}
          >
            {loading ? 'Applying...' : 'Apply Metadata'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ProjectMetadataUpload;