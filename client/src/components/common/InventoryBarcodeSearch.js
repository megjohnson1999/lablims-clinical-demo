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
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  QrCodeScanner as ScannerIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Inventory as InventoryIcon
} from '@mui/icons-material';
import { inventoryAPI } from '../../services/api';
import { 
  validateBarcode, 
  isCommercialBarcode, 
  parseCommercialBarcode,
  generateLabBarcode 
} from '../../utils/barcode';
import { debounce } from 'lodash';

const InventoryBarcodeSearch = ({ 
  onItemFound, 
  onItemSelect,
  onCommercialBarcodeScanned,
  placeholder = "Scan product barcode or search inventory...",
  autoFocus = true,
  showResults = true,
  allowCommercialLookup = true,
  ...props 
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [barcodeValidation, setBarcodeValidation] = useState(null);
  const inputRef = useRef();

  // Debounced search function
  const debouncedSearch = useRef(
    debounce(async (searchTerm) => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        setBarcodeValidation(null);
        return;
      }

      setLoading(true);
      setError('');
      
      try {
        // First validate if this looks like a barcode
        const validation = validateBarcode(searchTerm);
        setBarcodeValidation(validation);
        
        // If it's a commercial barcode and we allow commercial lookup
        if (validation.isValid && isCommercialBarcode(searchTerm) && allowCommercialLookup) {
          try {
            // Look up the barcode in the product database
            const lookupResponse = await inventoryAPI.lookupBarcode(searchTerm);
            
            if (lookupResponse.data.found) {
              const commercialData = parseCommercialBarcode(searchTerm, lookupResponse.data.product);
              if (onCommercialBarcodeScanned) {
                onCommercialBarcodeScanned(commercialData);
                setLoading(false);
                return;
              }
            } else {
              // Barcode not found in database, but still pass it through
              const commercialData = parseCommercialBarcode(searchTerm);
              if (onCommercialBarcodeScanned) {
                onCommercialBarcodeScanned(commercialData);
                setLoading(false);
                return;
              }
            }
          } catch (lookupError) {
            console.error('Barcode lookup error:', lookupError);
            // Fall back to basic parsing if lookup fails
            const commercialData = parseCommercialBarcode(searchTerm);
            if (onCommercialBarcodeScanned) {
              onCommercialBarcodeScanned(commercialData);
              setLoading(false);
              return;
            }
          }
        }
        
        // Search existing inventory
        let searchQuery = searchTerm;
        
        // If it looks like a lab-generated barcode, extract the ID
        if (searchTerm.toUpperCase().startsWith('LAB')) {
          const idPart = searchTerm.substring(3).replace(/^0+/, ''); // Remove LAB prefix and leading zeros
          searchQuery = idPart;
        }
        
        // Search by multiple fields
        const response = await inventoryAPI.search(searchQuery);
        setSearchResults(response.data || []);
        
        // If exactly one result, automatically call onItemFound
        if (response.data && response.data.length === 1 && onItemFound) {
          onItemFound(response.data[0]);
        }
        
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search inventory');
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

  const handleItemSelect = (item) => {
    // Use commercial barcode if available, otherwise use lab barcode
    const itemBarcode = item.barcode || generateLabBarcode(item);
    setSearchValue(itemBarcode);
    setSearchResults([]);
    if (onItemSelect) {
      onItemSelect(item);
    }
    if (onItemFound) {
      onItemFound(item);
    }
  };

  const handleClear = () => {
    setSearchValue('');
    setSearchResults([]);
    setError('');
    setBarcodeValidation(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleScannerToggle = () => {
    setScannerActive(!scannerActive);
    if (!scannerActive) {
      alert('Scanner mode activated. You can now scan product barcodes or internal inventory barcodes.');
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
        handleItemSelect(searchResults[0]);
      }
    }
  };

  const formatQuantity = (quantity, unit) => {
    if (!quantity) return 'N/A';
    return `${parseFloat(quantity).toLocaleString()} ${unit || ''}`.trim();
  };

  const formatExpirationDate = (date) => {
    if (!date) return null;
    const expDate = new Date(date);
    const today = new Date();
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: 'Expired', color: 'error' };
    } else if (diffDays < 30) {
      return { text: `${diffDays} days`, color: 'warning' };
    } else {
      return { text: expDate.toLocaleDateString(), color: 'default' };
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
              {loading && <CircularProgress size={20} sx={{ mr: 1 }} />}
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
            Scanner mode active. Scan a commercial barcode or lab-generated inventory code.
          </Typography>
        </Alert>
      )}

      {barcodeValidation && searchValue && (
        <Box sx={{ mt: 1 }}>
          {barcodeValidation.isValid ? (
            <Alert severity="success">
              <Typography variant="body2">
                Valid {barcodeValidation.format} barcode detected
                {isCommercialBarcode(searchValue) && ' (Commercial product)'}
              </Typography>
            </Alert>
          ) : (
            <Alert severity="warning">
              <Typography variant="body2">
                {barcodeValidation.errors.join(', ')}
              </Typography>
            </Alert>
          )}
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {showResults && searchResults.length > 0 && (
        <Paper sx={{ mt: 1, maxHeight: 400, overflow: 'auto' }} elevation={3}>
          <List dense>
            {searchResults.map((item, index) => {
              const expiration = formatExpirationDate(item.expiration_date);
              const isLowStock = parseFloat(item.current_quantity) <= parseFloat(item.minimum_stock_level);
              
              return (
                <React.Fragment key={item.id}>
                  <ListItemButton 
                    onClick={() => handleItemSelect(item)}
                    sx={{ py: 1 }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InventoryIcon fontSize="small" color="action" />
                          <Typography variant="subtitle2">
                            {item.name}
                          </Typography>
                          {isLowStock && (
                            <Chip 
                              label="Low Stock" 
                              size="small" 
                              color="warning"
                            />
                          )}
                          {expiration && expiration.color !== 'default' && (
                            <Chip 
                              label={expiration.text}
                              size="small" 
                              color={expiration.color}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            ID: {item.barcode || generateLabBarcode(item)} • 
                            Qty: {formatQuantity(item.current_quantity, item.unit_of_measure)}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            {item.supplier && `${item.supplier} • `}
                            {item.catalog_number && `Cat# ${item.catalog_number} • `}
                            {item.category}
                          </Typography>
                          {item.storage_location && (
                            <Typography variant="caption" display="block" color="text.secondary">
                              Location: {item.storage_location}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItemButton>
                  {index < searchResults.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </List>
        </Paper>
      )}

      {showResults && searchValue && !loading && searchResults.length === 0 && !error && barcodeValidation?.isValid && !isCommercialBarcode(searchValue) && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          <Typography variant="body2">
            No inventory items found for "{searchValue}". 
            {barcodeValidation.format === 'CODE128' ? 
              ' Try scanning the barcode again or check the item ID.' :
              ' This appears to be a valid barcode but no matching inventory found.'
            }
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default InventoryBarcodeSearch;