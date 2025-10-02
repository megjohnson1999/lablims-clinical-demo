import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Security as SecurityIcon,
  VpnKey as VpnKeyIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import UserCreateDialog from './UserCreateDialog';
import UserEditDialog from './UserEditDialog';
import PasswordResetDialog from './PasswordResetDialog';

const UserManagement = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordResetDialogOpen, setPasswordResetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);

  // Check if current user can manage users
  const canManageUsers = currentUser?.role === 'admin' || currentUser?.role === 'lab_manager';

  useEffect(() => {
    if (!canManageUsers) return;
    loadUsers();
  }, [canManageUsers]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/users');
      setUsers(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load users: ' + (err.response?.data?.msg || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setCreateDialogOpen(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleResetPassword = (user) => {
    setSelectedUser(user);
    setPasswordResetDialogOpen(true);
    setMenuAnchor(null);
  };

  const handleDeactivateUser = async (user) => {
    if (window.confirm(`Are you sure you want to deactivate ${user.username}? They will no longer be able to access the system.`)) {
      try {
        await axios.delete(`/api/users/${user.id}`);
        setSuccess(`User ${user.username} has been deactivated`);
        loadUsers();
      } catch (err) {
        setError('Failed to deactivate user: ' + (err.response?.data?.msg || err.message));
      }
    }
    setMenuAnchor(null);
  };

  const handleToggleActive = async (user) => {
    try {
      await axios.put(`/api/users/${user.id}`, {
        active: !user.active
      });
      setSuccess(`User ${user.username} has been ${user.active ? 'deactivated' : 'activated'}`);
      loadUsers();
    } catch (err) {
      setError('Failed to update user status: ' + (err.response?.data?.msg || err.message));
    }
    setMenuAnchor(null);
  };

  const getRoleChipColor = (role) => {
    const colors = {
      admin: 'error',
      lab_manager: 'warning',
      lab_technician: 'primary',
      bioinformatician: 'secondary',
      researcher: 'default'
    };
    return colors[role] || 'default';
  };

  const getRoleDisplayName = (role) => {
    const names = {
      admin: 'System Admin',
      lab_manager: 'Lab Manager',
      lab_technician: 'Lab Technician',
      bioinformatician: 'Bioinformatician',
      researcher: 'Researcher'
    };
    return names[role] || role;
  };

  const formatLastLogin = (lastLogin) => {
    if (!lastLogin) return 'Never';
    return formatDistanceToNow(new Date(lastLogin), { addSuffix: true });
  };

  const handleMenuOpen = (event, user) => {
    event.stopPropagation();
    setSelectedUser(user);
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedUser(null);
  };

  if (!canManageUsers) {
    return (
      <Box className="page-container">
        <Alert severity="error">
          You don't have permission to manage users. Only Lab Managers and Administrators can access this feature.
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="page-container">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          User Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadUsers}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={handleCreateUser}
          >
            Add User
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                  Loading users...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {user.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.first_name} {user.last_name}
                      </Typography>
                      {user.force_password_change && (
                        <Box sx={{ mt: 0.5 }}>
                          <Chip
                            icon={<VpnKeyIcon />}
                            label="Must Change Password"
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={getRoleDisplayName(user.role)}
                      color={getRoleChipColor(user.role)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.active ? 'Active' : 'Inactive'}
                      color={user.active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatLastLogin(user.last_login)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </Typography>
                    {user.created_by_username && (
                      <Typography variant="caption" color="text.secondary">
                        by {user.created_by_username}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={(e) => handleMenuOpen(e, user)}
                      disabled={user.id === currentUser?.id}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEditUser(selectedUser)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit User</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleResetPassword(selectedUser)}>
          <ListItemIcon>
            <VpnKeyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reset Password</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleToggleActive(selectedUser)}>
          <ListItemIcon>
            {selectedUser?.active ? <LockIcon fontSize="small" /> : <UnlockIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>
            {selectedUser?.active ? 'Deactivate' : 'Activate'} User
          </ListItemText>
        </MenuItem>
        {currentUser?.role === 'admin' && (
          <MenuItem onClick={() => handleDeactivateUser(selectedUser)} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Permanently Deactivate</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Dialogs */}
      <UserCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={(message) => {
          setSuccess(message);
          setCreateDialogOpen(false);
          loadUsers();
        }}
        onError={setError}
      />

      <UserEditDialog
        open={editDialogOpen}
        user={selectedUser}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={(message) => {
          setSuccess(message);
          setEditDialogOpen(false);
          setSelectedUser(null);
          loadUsers();
        }}
        onError={setError}
      />

      <PasswordResetDialog
        open={passwordResetDialogOpen}
        user={selectedUser}
        onClose={() => {
          setPasswordResetDialogOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={(message) => {
          setSuccess(message);
          setPasswordResetDialogOpen(false);
          setSelectedUser(null);
          loadUsers();
        }}
        onError={setError}
      />

      <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Lab Roles:</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          • <strong>Lab Manager:</strong> Full system access and user management<br />
          • <strong>Lab Technician:</strong> Full CRUD on specimens, protocols, experiments, inventory<br />
          • <strong>Bioinformatician:</strong> Full access to sequencing data and experiments<br />
          • <strong>Researcher:</strong> Read-only access to assigned projects
        </Typography>
      </Box>
    </Box>
  );
};

export default UserManagement;