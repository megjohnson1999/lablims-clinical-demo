import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CloudUpload as UploadIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { parseDelimitedData } from '../../utils/helpers';
import { toast } from 'react-toastify';

const BulkImport = ({
  title,
  apiImport,
  entityName,
  returnPath,
  requiredFields = [],
  optionalFields = [],
  additionalSteps = null
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [delimiter, setDelimiter] = useState('\t');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContent(event.target.result);
    };
    reader.readAsText(selectedFile);
  };

  const handleDelimiterChange = (e) => {
    setDelimiter(e.target.value);
  };

  const handleNext = () => {
    if (activeStep === 0) {
      if (!file) {
        setError('Please upload a file');
        return;
      }
      setError('');
    }
    
    if (activeStep === 1) {
      try {
        const parsedData = parseDelimitedData(fileContent, delimiter);
        if (parsedData.length === 0) {
          setError('No data found in the file');
          return;
        }
        setItems(parsedData);
        setError('');
      } catch (err) {
        console.error('Error parsing file', err);
        setError('Failed to parse file. Please check the format.');
        return;
      }
    }
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  
  const handleImport = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('Starting import for', entityName);
      console.log('Items to import:', items.length);
      
      // Transform data for import
      const transformedItems = items.map(item => {
        // Convert keys to lowercase for case-insensitivity
        const normalized = {};
        Object.keys(item).forEach(key => {
          normalized[key.toLowerCase().replace(/[_\s]/g, '_')] = item[key];
        });
        return normalized;
      });
      
      console.log('Transformed items sample:', transformedItems[0]);
      
      const payload = {
        [entityName]: transformedItems
      };
      
      console.log('Sending request to API:', payload);
      const response = await apiImport(payload);
      
      console.log('Import successful:', response.data);
      toast.success(`Successfully imported ${response.data.imported} ${entityName}`);
      navigate(returnPath);
    } catch (err) {
      console.error(`Error importing ${entityName}`, err);
      if (err.response) {
        console.error('Error response:', err.response.data);
      }
      setError(`Failed to import ${entityName}: ` + (err.response?.data?.msg || err.message));
      setLoading(false);
    }
  };

  const steps = ['Upload File', 'Preview & Configure', 'Review & Import'];
  if (additionalSteps) {
    steps.splice(1, 0, ...additionalSteps);
  }

  return (
    <Box className="bulk-import page-container">
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton
          component={Link}
          to={returnPath}
          sx={{ mr: 1 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Upload File
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Upload a tab-delimited or CSV file with {entityName} data.
            </Typography>
            
            <Box sx={{ maxWidth: 500, mb: 3 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                sx={{ mt: 2 }}
              >
                Upload File
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  hidden
                  onChange={handleFileChange}
                />
              </Button>
              
              {file && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  File: {file.name}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Preview Data
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Review the first few rows of your data and select the correct delimiter.
            </Typography>
            
            <Box sx={{ maxWidth: 400, mb: 3 }}>
              <TextField
                select
                fullWidth
                label="Delimiter"
                value={delimiter}
                onChange={handleDelimiterChange}
                margin="normal"
              >
                <MenuItem value="\t">Tab</MenuItem>
                <MenuItem value=",">Comma</MenuItem>
                <MenuItem value=";">Semicolon</MenuItem>
              </TextField>
            </Box>
            
            <Box sx={{ mb: 3, overflow: 'auto' }}>
              <pre style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                {fileContent.split('\n').slice(0, 10).join('\n')}
                {fileContent.split('\n').length > 10 && '\n...'}
              </pre>
            </Box>
          </Box>
        )}

        {activeStep === steps.length - 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review and Import
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Review the parsed data before importing it into the database.
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {items.length > 0 && 
                        Object.keys(items[0]).map((header) => (
                          <TableCell key={header}>{header}</TableCell>
                        ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.slice(0, 100).map((item, index) => (
                      <TableRow key={index}>
                        {Object.values(item).map((value, i) => (
                          <TableCell key={i}>{value}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              {items.length > 100 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Showing first 100 of {items.length} {entityName}
                </Typography>
              )}
            </Box>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Important:</strong> Make sure your column names match the expected fields.
                <ul>
                  <li><strong>Required fields:</strong> {requiredFields.join(', ')}</li>
                  <li><strong>Optional fields:</strong> {optionalFields.join(', ')}</li>
                </ul>
              </Typography>
            </Alert>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            Back
          </Button>
          <Box>
            <Button
              component={Link}
              to={returnPath}
              variant="outlined"
              sx={{ mr: 1 }}
            >
              Cancel
            </Button>
            
            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleImport}
                disabled={loading || items.length === 0}
              >
                {loading ? <CircularProgress size={24} /> : `Import ${entityName}`}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default BulkImport;