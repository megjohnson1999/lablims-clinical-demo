import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import {
  DatePicker,
} from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { exportAPI, collaboratorAPI, projectAPI } from '../../services/api';
import { toast } from 'react-toastify';

// Column configuration for export
const COLUMN_GROUPS = {
  sample: {
    label: 'Sample Information',
    description: 'Basic specimen data and status',
    columns: [
      { key: 'specimen_id', label: 'Specimen ID' },
      { key: 'tube_id', label: 'Tube ID' },
      { key: 'date_collected', label: 'Date Collected' },
      { key: 'activity_status', label: 'Activity Status' },
      { key: 'specimen_site', label: 'Specimen Site' },
      { key: 'extracted', label: 'Extracted' },
      { key: 'used_up', label: 'Used Up' },
      { key: 'initial_quantity', label: 'Initial Quantity' },
      { key: 'specimen_comments', label: 'Specimen Comments' }
    ]
  },
  storage: {
    label: 'Storage & Location',
    description: 'Physical storage location details',
    columns: [
      { key: 'position_freezer', label: 'Freezer' },
      { key: 'position_rack', label: 'Rack' },
      { key: 'position_box', label: 'Box' },
      { key: 'position_dimension_one', label: 'Position 1' },
      { key: 'position_dimension_two', label: 'Position 2' },
      { key: 'location', label: 'Location (Combined)' }
    ]
  },
  sequencing: {
    label: 'Sequencing & Analysis',
    description: 'Sequencing run and analysis information',
    columns: [
      { key: 'sequencing_run_id', label: 'Sequencing Run ID' },
      { key: 'fastq_location', label: 'FASTQ Location' },
      { key: 'analysis_status', label: 'Analysis Status' },
      { key: 'results_location', label: 'Results Location' },
      { key: 'sequencing_notes', label: 'Sequencing Notes' }
    ]
  },
  patient: {
    label: 'Patient Information',
    description: 'Patient demographics and clinical data',
    columns: [
      { key: 'patient_external_id', label: 'Patient ID' },
      { key: 'patient_first_name', label: 'Patient First Name' },
      { key: 'patient_last_name', label: 'Patient Last Name' },
      { key: 'patient_name', label: 'Patient Name (Combined)' },
      { key: 'date_of_birth', label: 'Date of Birth' },
      { key: 'diagnosis', label: 'Diagnosis' }
    ]
  },
  project: {
    label: 'Project Information',
    description: 'Research project and study details',
    columns: [
      { key: 'project_id', label: 'Project ID' },
      { key: 'disease', label: 'Disease' },
      { key: 'specimen_type', label: 'Specimen Type' },
      { key: 'project_source', label: 'Project Source' },
      { key: 'date_received', label: 'Date Received' },
      { key: 'feedback_date', label: 'Feedback Date' },
      { key: 'project_comments', label: 'Project Comments' }
    ]
  },
  collaborator: {
    label: 'Collaborator Information',
    description: 'PI and institution details',
    columns: [
      { key: 'collaborator_id', label: 'Collaborator ID' },
      { key: 'pi_name', label: 'PI Name' },
      { key: 'pi_institute', label: 'PI Institute' },
      { key: 'pi_email', label: 'PI Email' },
      { key: 'pi_phone', label: 'PI Phone' },
      { key: 'irb_id', label: 'IRB ID' },
      { key: 'internal_contact', label: 'Internal Contact' }
    ]
  }
};

// Get default selected columns (commonly used ones)
const getDefaultSelectedColumns = () => {
  return [
    'specimen_id', 'tube_id', 'pi_name', 'pi_institute', 'disease', 'specimen_type',
    'patient_external_id', 'patient_name', 'date_collected', 'location',
    'activity_status', 'extracted', 'used_up', 'sequencing_run_id', 'analysis_status'
  ];
};

// Get all available columns
const getAllColumns = () => {
  return Object.values(COLUMN_GROUPS).flatMap(group => group.columns.map(col => col.key));
};

const ExportDialog = ({ 
  open, 
  onClose, 
  initialFilters = {}, 
  selectedSpecimens = [],
  bulkSearchResults = null,
  exportMode = 'normal', // 'normal' or 'quick'
  searchTerm = '', // Current search term from parent component
  bulkIdText = '' // Bulk ID text for bulk search exports
}) => {
  // Quick mode simplifies the interface for bulk search exports
  const isQuickMode = exportMode === 'quick';
  
  const [filters, setFilters] = useState({
    format: 'csv',
    limit: 10000,
    ...initialFilters
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedColumns, setSelectedColumns] = useState(() => {
    // Try to load from localStorage, fallback to defaults
    const saved = localStorage.getItem('export_column_preferences');
    return saved ? JSON.parse(saved) : getDefaultSelectedColumns();
  });

  // Save column preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('export_column_preferences', JSON.stringify(selectedColumns));
  }, [selectedColumns]);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleColumnChange = (columnKey, checked) => {
    setSelectedColumns(prev => {
      if (checked) {
        return [...prev, columnKey];
      } else {
        return prev.filter(col => col !== columnKey);
      }
    });
  };

  const handleGroupToggle = (groupKey, checked) => {
    const groupColumns = COLUMN_GROUPS[groupKey].columns.map(col => col.key);
    setSelectedColumns(prev => {
      if (checked) {
        // Add all group columns that aren't already selected
        const newColumns = groupColumns.filter(col => !prev.includes(col));
        return [...prev, ...newColumns];
      } else {
        // Remove all group columns
        return prev.filter(col => !groupColumns.includes(col));
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedColumns(getAllColumns());
  };

  const handleDeselectAll = () => {
    setSelectedColumns([]);
  };

  const isGroupSelected = (groupKey) => {
    const groupColumns = COLUMN_GROUPS[groupKey].columns.map(col => col.key);
    return groupColumns.every(col => selectedColumns.includes(col));
  };

  const isGroupPartiallySelected = (groupKey) => {
    const groupColumns = COLUMN_GROUPS[groupKey].columns.map(col => col.key);
    const selectedInGroup = groupColumns.filter(col => selectedColumns.includes(col));
    return selectedInGroup.length > 0 && selectedInGroup.length < groupColumns.length;
  };

  const handleExport = async () => {
    setLoading(true);
    setError('');

    // Validate that at least one column is selected
    if (selectedColumns.length === 0) {
      setError('Please select at least one column to export.');
      setLoading(false);
      return;
    }

    try {
      // Export parameters including search term and bulk IDs
      const exportParams = {
        selectedColumns: selectedColumns.join(','),
        selectedSpecimens: selectedSpecimens.length > 0 ? selectedSpecimens.join(',') : null,
        searchTerm: searchTerm && searchTerm.trim() ? searchTerm.trim() : null,
        bulkIdText: bulkIdText && bulkIdText.trim() ? bulkIdText.trim() : null,
        format: filters.format,
        limit: filters.limit
      };

      // Choose export function based on format
      const response = filters.format === 'excel' 
        ? await exportAPI.exportSpecimensExcel(exportParams)
        : await exportAPI.exportSpecimensCSV(exportParams);
      
      // Create blob URL and trigger download
      const mimeType = filters.format === 'excel' 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv';
      const fileExtension = filters.format === 'excel' ? 'xlsx' : 'csv';
      
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `specimens_export_${timestamp}.${fileExtension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${filters.format.toUpperCase()} export completed successfully!`);
      onClose();
    } catch (err) {
      console.error('Export error:', err);
      setError('Export failed. Please try again.');
      toast.error('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFilters({
      format: 'csv',
      limit: 10000
    });
    setSelectedColumns(getDefaultSelectedColumns());
  };

  // In quick mode, force default columns and CSV format
  React.useEffect(() => {
    if (isQuickMode) {
      setSelectedColumns(getDefaultSelectedColumns());
      setFilters(prev => ({ ...prev, format: 'csv' }));
    }
  }, [isQuickMode, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isQuickMode ? 'Quick Export' : 'Export Specimens'}
      </DialogTitle>
      
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {searchTerm && searchTerm.trim() && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Search filter applied: "{searchTerm.trim()}"</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Only specimens matching your search will be exported.
            </Typography>
          </Alert>
        )}

        {bulkIdText && bulkIdText.trim() && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Bulk search active: {bulkIdText.split(/[,;\n\r]+/).filter(Boolean).length} specimen IDs</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Only the specific specimens from your bulk search will be exported.
            </Typography>
          </Alert>
        )}

        {selectedSpecimens.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Exporting {selectedSpecimens.length} selected specimens</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Only your selected specimens will be exported. Clear your selection in the specimen list to export all visible results.
            </Typography>
          </Alert>
        )}
        
        <Grid container spacing={2}>
          {/* Export Information */}
          <Grid item xs={12}>
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Exporting current view:</strong> This will export the specimens currently shown in the table with all active filters applied.
              </Typography>
            </Alert>
          </Grid>

          {/* Export Settings */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Export Settings
            </Typography>
          </Grid>
          
          {/* Export Settings */}
          {isQuickMode ? (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Quick export will generate a CSV file using default column selection.
              </Typography>
            </Grid>
          ) : (
            <>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Export Format</InputLabel>
                  <Select
                    value={filters.format}
                    label="Export Format"
                    onChange={(e) => handleFilterChange('format', e.target.value)}
                  >
                    <MenuItem value="csv">CSV (Comma Separated Values)</MenuItem>
                    <MenuItem value="excel">Excel (XLSX with formatting)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Record Limit"
                  type="number"
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 10000 }}
                  helperText="Maximum 10,000 records"
                  size="small"
                />
              </Grid>
            </>
          )}

          {/* Column Selection - Simplified in quick mode */}
          {isQuickMode ? (
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Column Selection
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Using default column selection ({getDefaultSelectedColumns().length} columns). 
                For custom column selection, use the main Export button instead.
              </Typography>
            </Grid>
          ) : (
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Column Selection
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip 
                  label={`${selectedColumns.length} of ${getAllColumns().length} columns selected`}
                  color="primary"
                  size="small"
                />
                <Button 
                  size="small" 
                  onClick={handleSelectAll}
                  disabled={selectedColumns.length === getAllColumns().length}
                >
                  Select All
                </Button>
                <Button 
                  size="small" 
                  onClick={handleDeselectAll}
                  disabled={selectedColumns.length === 0}
                >
                  Deselect All
                </Button>
              </Box>
            </Grid>
          )}
            
            {!isQuickMode && (
              <Grid item xs={12}>
                {Object.entries(COLUMN_GROUPS).map(([groupKey, group]) => (
              <Accordion key={groupKey} defaultExpanded={groupKey === 'sample'}>
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ 
                    '& .MuiAccordionSummary-content': {
                      alignItems: 'center',
                      gap: 1
                    }
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isGroupSelected(groupKey)}
                        indeterminate={isGroupPartiallySelected(groupKey)}
                        onChange={(e) => handleGroupToggle(groupKey, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    }
                    label={group.label}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ margin: 0 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {group.description}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormGroup>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 1 }}>
                      {group.columns.map((column) => (
                        <FormControlLabel
                          key={column.key}
                          control={
                            <Checkbox
                              checked={selectedColumns.includes(column.key)}
                              onChange={(e) => handleColumnChange(column.key, e.target.checked)}
                              size="small"
                            />
                          }
                          label={column.label}
                          sx={{ margin: 0 }}
                        />
                      ))}
                    </Box>
                  </FormGroup>
                </AccordionDetails>
              </Accordion>
                ))}
              </Grid>
            )}
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleReset} disabled={loading}>
          Reset Columns
        </Button>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleExport} 
          variant="contained" 
          disabled={loading || selectedColumns.length === 0}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Exporting...' : `Export ${filters.format.toUpperCase()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog;