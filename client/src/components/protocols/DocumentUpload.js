import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Alert,
  CircularProgress,
  Grid,
  LinearProgress,
  Chip,
  IconButton,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Description as DocumentIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { toast } from 'react-toastify';

const DocumentUpload = ({ 
  open, 
  onClose, 
  onSuccess, 
  protocolId = null,
  categories = []
}) => {
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Predefined categories
  const predefinedCategories = [
    'Standard Protocols',
    'SOPs',
    'Reference Materials',
    'Safety Documents',
    'Equipment Manuals',
    'Validation Documents',
    'Training Materials',
    'Quality Control',
    'Research Protocols',
    'Troubleshooting Guides'
  ];

  const resetForm = () => {
    setFile(null);
    setCategory('');
    setCustomCategory('');
    setDescription('');
    setError('');
    setUploadProgress(0);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  const handleFileSelect = useCallback((selectedFile) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown',
      'text/x-markdown',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // Excel .xlsx
      'application/vnd.ms-excel', // Excel .xls
      'application/octet-stream' // Some PDFs are detected as this
    ];

    if (!selectedFile) return;

    console.log('File selected:', {
      name: selectedFile.name,
      type: selectedFile.type,
      size: selectedFile.size
    });

    if (selectedFile.size > maxSize) {
      setError('File size must be less than 10MB');
      return;
    }

    // More permissive file type checking - handle file names with spaces
    const fileName = selectedFile.name.toLowerCase().trim();
    const isValidExtension =
      fileName.endsWith('.pdf') ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.doc') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md') ||
      fileName.endsWith('.markdown') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls');

    const isValidMimeType = allowedTypes.includes(selectedFile.type);

    // Accept if either extension OR mime type is valid
    if (!isValidExtension && !isValidMimeType) {
      setError('Invalid file type. Only PDF, Word documents, Excel files, text files, and markdown files are allowed.');
      return;
    }

    // Additional validation: Check for problematic file name patterns
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      setError('File name contains invalid characters. Please rename the file and try again.');
      return;
    }

    setFile(selectedFile);
    setError('');
  }, []);

  const handleFileUpload = useCallback((event) => {
    const selectedFile = event.target.files[0];
    handleFileSelect(selectedFile);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setDragOver(false);
    const droppedFile = event.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleSubmit = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('document', file);
      
      if (protocolId) {
        formData.append('protocol_id', protocolId);
      }
      
      const finalCategory = category === 'custom' ? customCategory : category;
      if (finalCategory) {
        formData.append('category', finalCategory);
      }
      
      if (description) {
        formData.append('description', description);
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 100);

      const response = await fetch('/api/protocols/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.msg || 'Failed to upload document');
      }

      const result = await response.json();
      
      setTimeout(() => {
        toast.success('Document uploaded successfully');
        onSuccess(result.document);
        handleClose();
      }, 500);

    } catch (err) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Failed to upload document');
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.toLowerCase().split('.').pop();
    return <DocumentIcon color="primary" />;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Upload Document</Typography>
          <IconButton onClick={handleClose} disabled={loading}>
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

        {/* File Upload Area */}
        <Box sx={{ mb: 3 }}>
          {!file ? (
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                textAlign: 'center',
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : 'grey.300',
                bgcolor: dragOver ? 'primary.50' : 'grey.50',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'primary.50',
                },
              }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('document-upload').click()}
            >
              <input
                id="document-upload"
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md,.markdown,.xlsx,.xls,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/plain,text/markdown"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={loading}
              />
              <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Drop your document here
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                or click to browse files
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Supported formats: PDF, Word (.docx, .doc), Excel (.xlsx, .xls), Text (.txt), Markdown (.md)
                <br />
                Maximum file size: 10MB
              </Typography>
            </Paper>
          ) : (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {getFileIcon(file.name)}
                  <Box sx={{ ml: 2 }}>
                    <Typography variant="body1" fontWeight="medium">
                      {file.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatFileSize(file.size)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {loading ? (
                    <CircularProgress size={24} sx={{ mr: 1 }} />
                  ) : (
                    <CheckIcon color="success" sx={{ mr: 1 }} />
                  )}
                  <Button
                    size="small"
                    onClick={() => setFile(null)}
                    disabled={loading}
                  >
                    Remove
                  </Button>
                </Box>
              </Box>
              
              {loading && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={uploadProgress} 
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Uploading... {uploadProgress}%
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </Box>

        {/* Metadata Fields */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                label="Category"
                disabled={loading}
              >
                <MenuItem value="">None</MenuItem>
                {predefinedCategories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
                <MenuItem value="custom">Custom Category...</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {category === 'custom' && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Custom Category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter custom category"
                disabled={loading}
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description or notes about this document"
              multiline
              rows={3}
              disabled={loading}
            />
          </Grid>

          {protocolId && (
            <Grid item xs={12}>
              <Alert severity="info">
                This document will be associated with the current protocol.
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!file || loading}
          startIcon={loading ? <CircularProgress size={20} /> : <UploadIcon />}
        >
          {loading ? 'Uploading...' : 'Upload Document'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentUpload;