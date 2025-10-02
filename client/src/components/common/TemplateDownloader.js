import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Download as DownloadIcon,
  Description as DescriptionIcon,
  TableChart as ExcelIcon,
  Code as CsvIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Help as HelpIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import axios from 'axios';
import { toast } from 'react-toastify';

const TemplateDownloader = ({ open, onClose, defaultTemplate = null }) => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(defaultTemplate);
  const [format, setFormat] = useState('excel');
  const [includeSamples, setIncludeSamples] = useState(true);
  const [loading, setLoading] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  useEffect(() => {
    if (defaultTemplate && templates.length > 0) {
      setSelectedTemplate(defaultTemplate);
    }
  }, [defaultTemplate, templates]);

  const fetchTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const response = await axios.get('/api/templates');
      setTemplates(response.data.templates);
    } catch (error) {
      toast.error('Failed to load templates');
      console.error('Template fetch error:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        format,
        includeSamples: includeSamples.toString()
      });

      const response = await axios.get(`/api/templates/${selectedTemplate}?${params}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Set filename based on format
      const extension = format === 'excel' ? 'xlsx' : 'csv';
      link.setAttribute('download', `${selectedTemplate}_template.${extension}`);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Template downloaded successfully`);
      onClose();
      
    } catch (error) {
      toast.error('Failed to download template');
      console.error('Download error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTemplateIcon = (templateId) => {
    if (templateId.includes('migration')) {
      return <DescriptionIcon color="warning" />;
    }
    return <DescriptionIcon color="primary" />;
  };

  const getTemplateTypeChip = (templateId) => {
    if (templateId.includes('migration')) {
      return <Chip label="Migration" color="warning" size="small" />;
    }
    return <Chip label="Project Import" color="primary" size="small" />;
  };

  const handleTemplateExpand = (templateId) => {
    setExpandedTemplate(expandedTemplate === templateId ? null : templateId);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <DownloadIcon />
          Download Import Templates
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Templates are optional!</strong> You can upload files with your existing column names - the system recognizes 70+ variations automatically. 
            Templates just show one example format and include helpful field descriptions and sample data.
          </Typography>
        </Alert>

        {templatesLoading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <Typography>Loading templates...</Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Template Selection */}
            <Grid item xs={12} md={7}>
              <Typography variant="h6" gutterBottom>
                Select Template
              </Typography>
              
              <Box sx={{ maxHeight: '400px', overflowY: 'auto' }}>
                {templates.map((template) => (
                  <Card 
                    key={template.id}
                    sx={{ 
                      mb: 2, 
                      cursor: 'pointer',
                      border: selectedTemplate === template.id ? '2px solid' : '1px solid',
                      borderColor: selectedTemplate === template.id ? 'primary.main' : 'grey.300',
                      '&:hover': { borderColor: 'primary.main' }
                    }}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box display="flex" alignItems="center" gap={2} flex={1}>
                          {getTemplateIcon(template.id)}
                          <Box>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              <Typography variant="subtitle1" fontWeight="bold">
                                {template.name}
                              </Typography>
                              {getTemplateTypeChip(template.id)}
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {template.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {template.fieldCount} fields
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Box display="flex" alignItems="center" gap={1}>
                          {selectedTemplate === template.id && (
                            <CheckIcon color="primary" />
                          )}
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTemplateExpand(template.id);
                            }}
                          >
                            {expandedTemplate === template.id ? <CollapseIcon /> : <ExpandIcon />}
                          </IconButton>
                        </Box>
                      </Box>

                      <Collapse in={expandedTemplate === template.id}>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom>
                          Template Fields:
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          This template includes fields for {template.name.toLowerCase()} with 
                          appropriate validation and sample data to guide your import process.
                        </Typography>
                      </Collapse>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            </Grid>

            {/* Download Options */}
            <Grid item xs={12} md={5}>
              <Typography variant="h6" gutterBottom>
                Download Options
              </Typography>

              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                <FormControl component="fieldset" fullWidth>
                  <FormLabel component="legend">File Format</FormLabel>
                  <RadioGroup
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    sx={{ mt: 1 }}
                  >
                    <FormControlLabel
                      value="excel"
                      control={<Radio />}
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <ExcelIcon color="success" />
                          <Box>
                            <Typography variant="body2">Excel (.xlsx)</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Recommended - includes formatting and field descriptions
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="csv"
                      control={<Radio />}
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <CsvIcon color="info" />
                          <Box>
                            <Typography variant="body2">CSV (.csv)</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Simple format with header comments
                            </Typography>
                          </Box>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>
              </Box>

              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeSamples}
                      onChange={(e) => setIncludeSamples(e.target.checked)}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">Include Sample Data</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Add example values to help understand the expected format
                      </Typography>
                    </Box>
                  }
                />
              </Box>

              {selectedTemplate && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Ready to download: <strong>{templates.find(t => t.id === selectedTemplate)?.name}</strong>
                  </Typography>
                </Alert>
              )}

              <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <HelpIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  Quick Tips
                </Typography>
                <List dense>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText 
                      primary="You can use your existing column names (like 'Sample ID', 'Patient Code', etc.)"
                      primaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText 
                      primary="Excel format includes field tooltips and formatting"
                      primaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText 
                      primary="Sample data shows expected format, but column names are flexible"
                      primaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText 
                      primary="Remove sample rows before importing your data"
                      primaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                </List>
              </Box>
            </Grid>
          </Grid>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleDownload}
          disabled={!selectedTemplate || loading}
          startIcon={loading ? null : <DownloadIcon />}
        >
          {loading ? 'Downloading...' : 'Download Template'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplateDownloader;