import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  People as PeopleIcon,
  Folder as FolderIcon,
  Science as ScienceIcon,
  Person as PersonIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import BarcodeSearch from '../common/BarcodeSearch';
import { inventoryAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState({
    collaborators: 0,
    projects: 0,
    specimens: 0,
    patients: 0
  });
  const [inventoryAlerts, setInventoryAlerts] = useState({
    lowStock: [],
    expiring: []
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentSpecimens, setRecentSpecimens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const fetchInventoryAlerts = async () => {
    try {
      const [lowStockRes, expiringRes] = await Promise.all([
        inventoryAPI.getLowStock(),
        inventoryAPI.getExpiring(30)
      ]);
      
      setInventoryAlerts({
        lowStock: lowStockRes.data || [],
        expiring: expiringRes.data || []
      });
    } catch (err) {
      console.error('Error fetching inventory alerts', err);
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Don't fetch data if not authenticated or still loading
      if (!currentUser) {
        return;
      }
      
      try {
        // Get basic statistics (available to all roles)
        const basicRequests = [
          axios.get('/api/collaborators'),
          axios.get('/api/projects'),
          axios.get('/api/specimens?limit=1'),
          axios.get('/api/patients'),
          axios.get('/api/specimens?limit=10&sortBy=created_at&sortOrder=desc')
        ];

        // Add audit data only for admin/lab_manager roles
        if (currentUser.role === 'admin' || currentUser.role === 'lab_manager') {
          basicRequests.push(axios.get('/api/audit'));
        }

        const responses = await Promise.all(basicRequests);
        
        const [
          collaboratorsRes,
          projectsRes,
          specimensRes,
          patientsRes,
          recentSpecimensRes,
          activityRes = null
        ] = responses;

        console.log('API Responses:');
        console.log('- Collaborators:', collaboratorsRes.data);
        console.log('- Projects:', projectsRes.data);
        console.log('- Specimens:', specimensRes.data);

        const newStats = {
          collaborators: collaboratorsRes.data.pagination?.total || 0,
          projects: projectsRes.data.pagination?.total || 0,
          specimens: specimensRes.data.totalCount || 0,
          patients: patientsRes.data.pagination?.total || 0
        };
        
        console.log('Dashboard stats updated:', newStats);
        setStats(newStats);

        setRecentActivity(activityRes?.data?.slice(0, 10) || []); // Get only the 10 most recent activities
        setRecentSpecimens(recentSpecimensRes.data.specimens || []);
        
        // Fetch inventory alerts
        await fetchInventoryAlerts();
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data', err);
        setError('Failed to load dashboard data');
        setLoading(false);
      }
    };

    fetchDashboardData();
    
    // Set up interval to refresh inventory alerts every 30 seconds
    const alertInterval = setInterval(fetchInventoryAlerts, 30000);
    
    return () => clearInterval(alertInterval);
  }, [currentUser]); // Re-run when currentUser changes

  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case 'collaborators':
        return <PeopleIcon color="primary" />;
      case 'projects':
        return <FolderIcon color="secondary" />;
      case 'specimens':
        return <ScienceIcon color="success" />;
      case 'patients':
        return <PersonIcon color="info" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="dashboard">
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      
      <Typography variant="h6" gutterBottom>
        Welcome back, {currentUser?.first_name || currentUser?.username}!
      </Typography>
      
      {/* Quick Barcode Search */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Specimen Search
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Scan a barcode or type a specimen ID to quickly find and view specimens
        </Typography>
        <BarcodeSearch
          onSpecimenFound={(specimen) => {
            navigate(`/specimens/${specimen.id}`);
          }}
          placeholder="Scan barcode or enter specimen ID..."
          autoFocus={false}
          sx={{ mt: 2 }}
        />
      </Paper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Box className="dashboard-stats">
        <Paper className="stat-card" elevation={2}>
          <CardContent>
            <Typography color="primary" gutterBottom>
              <PeopleIcon fontSize="large" />
            </Typography>
            <Typography variant="h4" component="div" className="stat-value">
              {stats.collaborators}
            </Typography>
            <Typography variant="body2" className="stat-label">
              Collaborators
            </Typography>
          </CardContent>
        </Paper>
        
        <Paper className="stat-card" elevation={2}>
          <CardContent>
            <Typography color="secondary" gutterBottom>
              <FolderIcon fontSize="large" />
            </Typography>
            <Typography variant="h4" component="div" className="stat-value">
              {stats.projects}
            </Typography>
            <Typography variant="body2" className="stat-label">
              Projects
            </Typography>
          </CardContent>
        </Paper>
        
        <Paper className="stat-card" elevation={2}>
          <CardContent>
            <Typography color="success" gutterBottom>
              <ScienceIcon fontSize="large" />
            </Typography>
            <Typography variant="h4" component="div" className="stat-value">
              {stats.specimens}
            </Typography>
            <Typography variant="body2" className="stat-label">
              Specimens
            </Typography>
          </CardContent>
        </Paper>
        
        <Paper className="stat-card" elevation={2}>
          <CardContent>
            <Typography color="info" gutterBottom>
              <PersonIcon fontSize="large" />
            </Typography>
            <Typography variant="h4" component="div" className="stat-value">
              {stats.patients}
            </Typography>
            <Typography variant="body2" className="stat-label">
              Patients
            </Typography>
          </CardContent>
        </Paper>
      </Box>
      
      {/* Inventory Alert Widgets */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper 
            sx={{ p: 2, height: '100%', cursor: 'pointer' }} 
            elevation={2}
            onClick={() => navigate('/inventory?lowStock=true')}
          >
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6" color="warning.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon />
                Low Stock Items
              </Typography>
              <Typography variant="h4" color="warning.main">
                {inventoryAlerts.lowStock.length}
              </Typography>
            </Box>
            {inventoryAlerts.lowStock.slice(0, 3).map((item, index) => (
              <Box key={item.inventory_id || index} sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {item.barcode ? `${item.barcode}: ` : item.inventory_id ? `LAB-${item.inventory_id.toString().padStart(3, '0')}: ` : ''}{item.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.current_quantity} {item.unit_of_measure} / {item.minimum_stock_level} min
                </Typography>
              </Box>
            ))}
            {inventoryAlerts.lowStock.length > 3 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                +{inventoryAlerts.lowStock.length - 3} more items
              </Typography>
            )}
            {inventoryAlerts.lowStock.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                All items adequately stocked
              </Typography>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper 
            sx={{ p: 2, height: '100%', cursor: 'pointer' }} 
            elevation={2}
            onClick={() => navigate('/inventory?expiring=30')}
          >
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6" color="error.main" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScheduleIcon />
                Expiring Soon
              </Typography>
              <Typography variant="h4" color="error.main">
                {inventoryAlerts.expiring.length}
              </Typography>
            </Box>
            {inventoryAlerts.expiring.slice(0, 3).map((item, index) => (
              <Box key={item.inventory_id || index} sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {item.barcode ? `${item.barcode}: ` : item.inventory_id ? `LAB-${item.inventory_id.toString().padStart(3, '0')}: ` : ''}{item.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Expires: {format(new Date(item.expiration_date), 'MMM d, yyyy')} ({item.days_until_expiry} days)
                </Typography>
              </Box>
            ))}
            {inventoryAlerts.expiring.length > 3 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                +{inventoryAlerts.expiring.length - 3} more items
              </Typography>
            )}
            {inventoryAlerts.expiring.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No items expiring soon
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, height: '100%' }} elevation={2}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            {recentActivity.length > 0 ? (
              <List className="activity-list">
                {recentActivity.map((activity, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            {getActivityIcon(activity.table_name)}
                            <Typography variant="body1">
                              {activity.action} {activity.table_name} {activity.action === 'DELETE' ? '' : activity.record_id && `#${activity.record_id.substring(0, 8)}`}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" className="activity-time">
                            {format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a')} by {activity.username}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < recentActivity.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="textSecondary">
                No recent activity found
              </Typography>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: '100%' }} elevation={2}>
            <Typography variant="h6" gutterBottom>
              Recent Specimens
            </Typography>
            {recentSpecimens.length > 0 ? (
              <List>
                {recentSpecimens.map((specimen, index) => (
                  <React.Fragment key={specimen.id}>
                    <ListItem 
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                      onClick={() => navigate(`/specimens/${specimen.id}`)}
                    >
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Typography variant="body1" fontWeight="bold">
                              SPEC-{specimen.specimen_number?.toString().padStart(3, '0')}
                            </Typography>
                            <Chip 
                              label={specimen.sample_type || 'Unknown'} 
                              size="small" 
                              color="primary"
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Project: {specimen.project_name || 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(specimen.created_at), 'MMM d, yyyy h:mm a')}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentSpecimens.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No specimens found
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;