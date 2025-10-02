import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Container,
  Menu,
  MenuItem,
  Avatar,
  ListSubheader
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Folder as FolderIcon,
  Person as PersonIcon,
  Science as ScienceIcon,
  Label as LabelIcon,
  Settings as SettingsIcon,
  ExitToApp as LogoutIcon,
  Help as HelpIcon,
  Inventory as InventoryIcon,
  Assignment as ProtocolIcon,
  Biotech as ExperimentIcon,
  Storage as MetadataIcon,
  Description as DocumentIcon,
  AdminPanelSettings as AdminIcon,
  Dns as SequencingIcon,
  BarChart as AnalyticsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import { useKeyboardShortcutsHelp } from '../common/KeyboardShortcutsHelp';

const drawerWidth = 240;

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  // Initialize keyboard shortcuts
  const { shortcuts } = useKeyboardShortcuts();
  const { showHelp, HelpComponent } = useKeyboardShortcutsHelp();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  const handleSettings = () => {
    handleMenuClose();
    navigate('/settings');
  };

  const handleShowHelp = () => {
    handleMenuClose();
    showHelp();
  };

  // Check if user can manage users
  const canManageUsers = currentUser?.role === 'admin' || currentUser?.role === 'lab_manager';

  const menuSections = [
    {
      title: 'Overview',
      items: [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
        { text: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' }
      ]
    },
    {
      title: 'Sample Management',
      items: [
        { text: 'Collaborators', icon: <PeopleIcon />, path: '/collaborators' },
        { text: 'Projects', icon: <FolderIcon />, path: '/projects' },
        { text: 'Patients', icon: <PersonIcon />, path: '/patients' },
        { text: 'Specimens', icon: <ScienceIcon />, path: '/specimens' },
        { text: 'Metadata', icon: <MetadataIcon />, path: '/metadata' },
        { text: 'Labels', icon: <LabelIcon />, path: '/labels' }
      ]
    },
    {
      title: 'Lab Operations',
      items: [
        { text: 'Protocols', icon: <ProtocolIcon />, path: '/protocols' },
        { text: 'Documents', icon: <DocumentIcon />, path: '/documents' },
        { text: 'Experiments', icon: <ExperimentIcon />, path: '/experiments' },
        { text: 'Inventory', icon: <InventoryIcon />, path: '/inventory' }
      ]
    },
    {
      title: 'Analysis',
      items: [
        { text: 'Sequencing', icon: <SequencingIcon />, path: '/sequencing' }
      ]
    },
    ...(canManageUsers ? [{
      title: 'Administration',
      items: [
        { text: 'User Management', icon: <AdminIcon />, path: '/admin/users' }
      ]
    }] : [])
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Pathogen DB
        </Typography>
      </Toolbar>
      <Divider />
      {menuSections.map((section, sectionIndex) => (
        <List
          key={section.title}
          subheader={
            <ListSubheader component="div" sx={{ bgcolor: 'transparent', fontWeight: 600 }}>
              {section.title}
            </ListSubheader>
          }
        >
          {section.items.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton onClick={() => {
                navigate(item.path);
                if (mobileOpen) setMobileOpen(false);
              }}>
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
          {sectionIndex < menuSections.length - 1 && <Divider sx={{ my: 1 }} />}
        </List>
      ))}
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Pathogen Discovery Database
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 2 }}>
              {currentUser?.username}
            </Typography>
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                {currentUser?.first_name?.[0] || currentUser?.username?.[0] || 'U'}
              </Avatar>
            </IconButton>
          </Box>
          
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleSettings}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Settings</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleShowHelp}>
              <ListItemIcon>
                <HelpIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Keyboard Shortcuts</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}
      >
        <Toolbar />
        <Container maxWidth="xl">
          <Outlet />
        </Container>
      </Box>
      
      {/* Keyboard Shortcuts Help Dialog */}
      <HelpComponent />
    </Box>
  );
};

export default Layout;