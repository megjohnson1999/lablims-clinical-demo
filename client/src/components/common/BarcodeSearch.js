import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Chip,
  Divider
} from '@mui/material';
import {
  QrCodeScanner as ScannerIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { specimenAPI } from '../../services/api';
import { formatSpecimenIdForBarcode } from '../../utils/barcode';
import { debounce } from 'lodash';

const BarcodeSearch = ({ 
  onSpecimenFound, 
  onSpecimenSelect,
  placeholder = "Scan or enter specimen ID...",
  autoFocus = true,
  showResults = true,
  ...props 
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const inputRef = useRef();

  // Debounced search function
  const debouncedSearch = useRef(
    debounce(async (searchTerm) => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      setError('');
      
      try {
        // Format the search term consistently
        const formattedTerm = formatSpecimenIdForBarcode(searchTerm);
        
        // Search by tube_id first (exact match)
        let response = await specimenAPI.search(formattedTerm, 'tube_id');
        
        // If no exact match, try broader search
        if (response.data.length === 0) {
          response = await specimenAPI.search(formattedTerm);
        }
        
        setSearchResults(response.data);
        
        // If exactly one result, automatically call onSpecimenFound
        if (response.data.length === 1 && onSpecimenFound) {
          onSpecimenFound(response.data[0]);
        }
        
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search specimens');
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 300)
  ).current;

  useEffect(() => {
    debouncedSearch(searchValue);
  }, [searchValue, debouncedSearch]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
  };

  const handleSpecimenSelect = (specimen) => {
    setSearchValue(specimen.tube_id || specimen.id);
    setSearchResults([]);
    if (onSpecimenSelect) {
      onSpecimenSelect(specimen);
    }
    if (onSpecimenFound) {
      onSpecimenFound(specimen);
    }
  };

  const handleClear = () => {
    setSearchValue('');
    setSearchResults([]);
    setError('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleScannerToggle = () => {
    setScannerActive(!scannerActive);
    // In a real implementation, this would activate camera for QR/barcode scanning
    // For now, we'll just focus the input and show a message
    if (!scannerActive) {
      alert('Scanner mode activated. You can now scan barcodes directly into the search field.');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  const handleKeyPress = (e) => {
    // Scanner typically sends Enter after scanning
    if (e.key === 'Enter' && searchValue.trim()) {
      e.preventDefault();
      // If there's exactly one result, select it
      if (searchResults.length === 1) {
        handleSpecimenSelect(searchResults[0]);
      }
    }
  };

  return (
    <Box {...props}>
      <TextField
        ref={inputRef}
        fullWidth
        variant="outlined"
        placeholder={placeholder}
        value={searchValue}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={handleScannerToggle}
                color={scannerActive ? 'primary' : 'default'}
                title="Toggle barcode scanner"
                size="small"
              >
                <ScannerIcon />
              </IconButton>
              {searchValue && (
                <IconButton
                  onClick={handleClear}
                  title="Clear search"
                  size="small"
                >
                  <ClearIcon />
                </IconButton>
              )}
            </InputAdornment>
          )
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: scannerActive ? '#e3f2fd' : 'inherit'
          }
        }}
      />

      {scannerActive && (
        <Alert severity="info" sx={{ mt: 1 }}>
          <Typography variant="body2">
            Scanner mode active. Scan a barcode or type manually.
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {showResults && searchResults.length > 0 && (
        <Paper sx={{ mt: 1, maxHeight: 300, overflow: 'auto' }} elevation={3}>
          <List dense>
            {searchResults.map((specimen, index) => (
              <React.Fragment key={specimen.id}>
                <ListItemButton 
                  onClick={() => handleSpecimenSelect(specimen)}
                  sx={{ py: 1 }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                          {specimen.tube_id || specimen.id.substring(0, 8)}
                        </Typography>
                        {specimen.analysis_status && (
                          <Chip 
                            label={specimen.analysis_status} 
                            size="small" 
                            color={
                              specimen.analysis_status === 'completed' ? 'success' :
                              specimen.analysis_status === 'in_progress' ? 'warning' : 'default'
                            }
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {specimen.disease} • {specimen.specimen_type}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          PI: {specimen.pi_name} • Date: {specimen.date_collected ? new Date(specimen.date_collected).toLocaleDateString() : 'N/A'}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItemButton>
                {index < searchResults.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {showResults && searchValue && !loading && searchResults.length === 0 && !error && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          <Typography variant="body2">
            No specimens found for "{searchValue}". Try scanning the barcode again or check the specimen ID.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default BarcodeSearch;