import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Pagination,
  Skeleton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Menu,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Science as ScienceIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  QrCode as BarcodeIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { inventoryAPI } from '../../services/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { generateBarcodeDataURL } from '../../utils/barcode';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { canEditLabData } from '../../utils/roleUtils';

// Custom hook for debouncing values
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const InventoryList = () => {
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    lowStock: false,
    expiring: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const canEdit = canEditLabData(currentUser);
  
  // Debounce search term to avoid too many API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchInventory = useCallback(async (page = 1, search = '', appliedFilters = filters) => {
    try {
      const loadingState = search !== debouncedSearchTerm ? 'search' : 'page';
      if (loadingState === 'search') {
        setSearchLoading(true);
      } else {
        setLoading(true);
      }
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (search?.trim()) {
        params.append('search', search.trim());
      }
      
      if (appliedFilters.category) {
        params.append('category', appliedFilters.category);
      }
      
      if (appliedFilters.lowStock) {
        params.append('lowStock', 'true');
      }
      
      if (appliedFilters.expiring) {
        params.append('expiring', appliedFilters.expiring);
      }
      
      const response = await inventoryAPI.getAll(`?${params.toString()}`);
      
      // Handle response format
      if (response.data.inventory) {
        setInventory(response.data.inventory);
        setPagination(response.data.pagination);
      } else {
        setInventory(response.data);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching inventory', err);
      setError('Failed to load inventory');
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  }, [pagination.limit, debouncedSearchTerm, filters]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await inventoryAPI.getCategories();
      setCategories(response.data);
    } catch (err) {
      console.error('Error fetching categories', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchInventory(1, '');
    fetchCategories();
  }, []);

  // Fetch when debounced search term changes
  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) return;
    fetchInventory(1, debouncedSearchTerm);
  }, [debouncedSearchTerm, fetchInventory]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (filterKey, value) => {
    const newFilters = { ...filters, [filterKey]: value };
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchInventory(1, debouncedSearchTerm, newFilters);
  };

  const handleDeleteInventory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this inventory item?')) {
      return;
    }

    try {
      await inventoryAPI.delete(id);
      toast.success('Inventory item deleted successfully');
      setInventory(inventory.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Error deleting inventory item', err);
      toast.error('Failed to delete inventory item');
    }
  };

  const handlePrintBarcode = (item) => {
    try {
      const barcodeText = item.barcode || (item.inventory_id ? `LAB-${item.inventory_id.toString().padStart(3, '0')}` : 'NO-BARCODE');
      const barcodeDataURL = generateBarcodeDataURL(barcodeText, {
        width: 2,
        height: 80,
        fontSize: 12,
        margin: 10
      });

      if (!barcodeDataURL) {
        toast.error('Failed to generate barcode');
        return;
      }

      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=400,height=300');
      
      if (!printWindow) {
        toast.error('Please allow popups to print barcodes');
        return;
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Print Barcode - ${item.name}</title>
          <style>
            @page {
              size: 4in 2in;
              margin: 0.25in;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 10px;
              margin: 0;
              padding: 10px;
              text-align: center;
            }
            .barcode-container {
              border: 1px solid #000;
              padding: 10px;
              background: white;
            }
            .item-name {
              font-weight: bold;
              margin-bottom: 5px;
              font-size: 11px;
            }
            .item-details {
              font-size: 9px;
              color: #666;
              margin-bottom: 10px;
            }
            .barcode-image {
              margin: 10px 0;
            }
            .barcode-text {
              font-family: monospace;
              font-size: 10px;
              font-weight: bold;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            <div class="item-name">${item.name}</div>
            <div class="item-details">
              Category: ${item.category} | Qty: ${item.current_quantity} ${item.unit_of_measure || ''}
              ${item.expiration_date ? `<br>Expires: ${formatDate(item.expiration_date)}` : ''}
            </div>
            <div class="barcode-image">
              <img src="${barcodeDataURL}" alt="${barcodeText}" />
            </div>
            <div class="barcode-text">${barcodeText}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 100);
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      toast.success('Barcode sent to printer');
    } catch (error) {
      console.error('Error printing barcode:', error);
      toast.error('Failed to print barcode');
    }
  };

  const getStatusChip = (item) => {
    if (item.is_expired) {
      return <Chip icon={<ErrorIcon />} label="Expired" color="error" size="small" />;
    }
    if (item.is_expiring_soon) {
      return <Chip icon={<WarningIcon />} label="Expiring Soon" color="warning" size="small" />;
    }
    if (item.is_low_stock) {
      return <Chip icon={<WarningIcon />} label="Low Stock" color="warning" size="small" />;
    }
    return null;
  };

  const getCategoryColor = (category) => {
    const colors = {
      reagents: '#1976d2',
      enzymes: '#d32f2f', 
      kits: '#388e3c',
      consumables: '#f57c00',
      antibodies: '#7b1fa2',
      primers: '#303f9f',
      media: '#689f38',
      other: '#616161'
    };
    return colors[category] || '#616161';
  };

  return (
    <Box className="inventory-list page-container">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Inventory
        </Typography>
        {canEdit && (
          <Button
            component={Link}
            to="/inventory/new"
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
          >
            New Inventory Item
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <TextField
            fullWidth
            label="Search Inventory"
            variant="outlined"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Search by name, catalog number, supplier, or lot number"
            InputProps={{
              endAdornment: searchLoading ? <CircularProgress size={20} /> : <SearchIcon color="action" />,
            }}
          />
          
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
          >
            Filters
          </Button>
          
          <Menu
            anchorEl={filterMenuAnchor}
            open={Boolean(filterMenuAnchor)}
            onClose={() => setFilterMenuAnchor(null)}
            PaperProps={{ sx: { p: 2, minWidth: 250 } }}
          >
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                label="Category"
              >
                <MenuItem value="">All Categories</MenuItem>
                {categories.map(cat => (
                  <MenuItem key={cat.category_name} value={cat.category_name}>
                    {cat.category_name.charAt(0).toUpperCase() + cat.category_name.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Expiring Items</InputLabel>
              <Select
                value={filters.expiring}
                onChange={(e) => handleFilterChange('expiring', e.target.value)}
                label="Expiring Items"
              >
                <MenuItem value="">No Filter</MenuItem>
                <MenuItem value="7">Next 7 days</MenuItem>
                <MenuItem value="30">Next 30 days</MenuItem>
                <MenuItem value="90">Next 90 days</MenuItem>
              </Select>
            </FormControl>

            <Button
              fullWidth
              variant={filters.lowStock ? "contained" : "outlined"}
              color="warning"
              onClick={() => handleFilterChange('lowStock', !filters.lowStock)}
              startIcon={<WarningIcon />}
            >
              Low Stock Only
            </Button>
          </Menu>
        </Box>
        
        {searchLoading && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              Searching...
            </Typography>
          </Box>
        )}
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Storage</TableCell>
              <TableCell>Expiration</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton animation="wave" width="60%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="80%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="70%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="50%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="90%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="60%" /></TableCell>
                  <TableCell><Skeleton animation="wave" width="40%" /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="circular" width={32} height={32} />
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : inventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  {searchTerm || Object.values(filters).some(f => f) ? 'No inventory items match your search/filters' : 'No inventory items found'}
                </TableCell>
              </TableRow>
            ) : (
              inventory.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Chip 
                      label={item.barcode || (item.inventory_id ? `LAB-${item.inventory_id.toString().padStart(3, '0')}` : 'No ID')}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.name}
                      </Typography>
                      {item.catalog_number && (
                        <Typography variant="caption" color="text.secondary">
                          Cat# {item.catalog_number}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.category}
                      size="small"
                      sx={{ 
                        backgroundColor: getCategoryColor(item.category) + '20',
                        color: getCategoryColor(item.category),
                        fontWeight: 500
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {item.current_quantity} {item.unit_of_measure || ''}
                    </Typography>
                    {item.minimum_stock_level > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Min: {item.minimum_stock_level}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {item.storage_location || '—'}
                    </Typography>
                    {item.storage_conditions && (
                      <Typography variant="caption" color="text.secondary">
                        {item.storage_conditions}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.expiration_date ? formatDate(item.expiration_date) : '—'}
                  </TableCell>
                  <TableCell>
                    {getStatusChip(item)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          component={Link}
                          to={`/inventory/${item.id}`}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      {canEdit && (
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            component={Link}
                            to={`/inventory/edit/${item.id}`}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      <Tooltip title="Print Barcode">
                        <IconButton
                          size="small"
                          onClick={() => handlePrintBarcode(item)}
                        >
                          <BarcodeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      {isAdmin && (
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteInventory(item.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 3, gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total items)
          </Typography>
          <Pagination
            count={pagination.totalPages}
            page={pagination.page}
            onChange={(event, page) => fetchInventory(page, debouncedSearchTerm)}
            disabled={loading || searchLoading}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default InventoryList;