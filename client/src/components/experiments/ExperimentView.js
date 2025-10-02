import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Science as ScienceIcon,
  Description as DescriptionIcon,
  Inventory as InventoryIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { formatDate } from '../../utils/helpers';

const ExperimentView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [experiment, setExperiment] = useState(null);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExperiment();
  }, [id]);

  const fetchExperiment = async () => {
    try {
      const response = await fetch(`/api/experiments/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch experiment');
      }

      const data = await response.json();
      setExperiment(data);
      setInventoryTransactions(data.inventory_transactions || []);
    } catch (error) {
      console.error('Error fetching experiment:', error);
      setError(error.message || 'Failed to fetch experiment details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'planned':
        return 'default';
      case 'in_progress':
        return 'primary';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  // Helper function to display appropriate units for reagents
  const getDisplayQuantityAndUnit = (transaction) => {
    const quantity = Math.abs(transaction.quantity_change);
    
    // Use the original transaction unit if available, otherwise fall back to inventory unit
    const unit = transaction.transaction_unit || transaction.unit_of_measure;
    
    return { 
      quantity: quantity.toString(), 
      unit: unit 
    };
  };

  if (loading) return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
      <CircularProgress />
    </Box>
  );

  if (error) return (
    <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
  );

  if (!experiment) return (
    <Alert severity="info" sx={{ m: 2 }}>Experiment not found</Alert>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/experiments')}
            variant="outlined"
          >
            Back to Experiments
          </Button>
          <Typography variant="h4" component="h1">
            Experiment #{experiment.experiment_id}
          </Typography>
          <Chip 
            label={experiment.status.replace('_', ' ').toUpperCase()} 
            color={getStatusColor(experiment.status)}
            size="medium"
          />
        </Box>
        <Button
          component={Link}
          to={`/experiments/${id}/edit`}
          variant="contained"
          startIcon={<EditIcon />}
        >
          Edit
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <ScienceIcon color="primary" />
                <Typography variant="h6">Basic Information</Typography>
              </Box>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Experiment ID"
                    secondary={experiment.experiment_id}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Status"
                    secondary={experiment.status?.replace('_', ' ').toUpperCase() || 'N/A'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Sample Count"
                    secondary={experiment.sample_count || '0'}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Protocol & User Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <DescriptionIcon color="primary" />
                <Typography variant="h6">Protocol & User</Typography>
              </Box>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Protocol"
                    secondary={experiment.protocol_name || 'N/A'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Performed By"
                    secondary={experiment.performed_by_username ? `${experiment.performed_by_first_name} ${experiment.performed_by_last_name} (${experiment.performed_by_username})` : 'N/A'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Protocol Version"
                    secondary={experiment.protocol_version || 'N/A'}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Dates */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <CalendarIcon color="primary" />
                <Typography variant="h6">Important Dates</Typography>
              </Box>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Date Performed"
                    secondary={formatDate(experiment.date_performed)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Created At"
                    secondary={formatDate(experiment.created_at)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Last Updated"
                    secondary={formatDate(experiment.updated_at)}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Results & Notes */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Notes & Sample Information</Typography>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Notes:
                </Typography>
                <Typography variant="body1" paragraph>
                  {experiment.notes || 'No notes added'}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Specimen Numbers:
                </Typography>
                <Typography variant="body1">
                  {experiment.specimen_numbers && experiment.specimen_numbers.length > 0 
                    ? experiment.specimen_numbers.map(num => `#${num}`).join(', ') 
                    : 'No specimens associated'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Inventory Transactions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <InventoryIcon color="primary" />
                <Typography variant="h6">Inventory Usage</Typography>
              </Box>
              {inventoryTransactions.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {inventoryTransactions.map((transaction) => {
                        const displayInfo = getDisplayQuantityAndUnit(transaction);
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>{transaction.inventory_name}</TableCell>
                            <TableCell align="right">{displayInfo.quantity}</TableCell>
                            <TableCell>{displayInfo.unit}</TableCell>
                            <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No inventory items used in this experiment
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ExperimentView;