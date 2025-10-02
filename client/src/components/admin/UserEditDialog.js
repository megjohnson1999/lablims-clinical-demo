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
  Box,
  Typography,
  Chip,
  Grid,
  FormHelperText,
  FormControlLabel,
  Switch
} from '@mui/material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';

const validationSchema = Yup.object({
  username: Yup.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores')
    .required('Username is required'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  first_name: Yup.string()
    .min(1, 'First name is required')
    .max(100, 'First name must not exceed 100 characters')
    .required('First name is required'),
  last_name: Yup.string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must not exceed 100 characters')
    .required('Last name is required'),
  role: Yup.string()
    .oneOf(['admin', 'lab_manager', 'lab_technician', 'bioinformatician', 'researcher'])
    .required('Role is required'),
  active: Yup.boolean()
});

const UserEditDialog = ({ open, user, onClose, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    if (open) {
      loadRoles();
    }
  }, [open]);

  const loadRoles = async () => {
    try {
      const response = await axios.get('/api/users/roles/available');
      setRoles(response.data);
    } catch (err) {
      console.error('Failed to load roles:', err);
      // Fallback roles
      setRoles([
        { value: 'admin', label: 'System Administrator', description: 'Full system access and user management' },
        { value: 'lab_manager', label: 'Lab Manager', description: 'Full lab access and user management' },
        { value: 'lab_technician', label: 'Lab Technician', description: 'Full CRUD on specimens, protocols, experiments, inventory' },
        { value: 'bioinformatician', label: 'Bioinformatician', description: 'Full access to sequencing data and experiments' },
        { value: 'researcher', label: 'Researcher', description: 'Read-only access to assigned projects' }
      ]);
    }
  };

  const handleSubmit = async (values, { setSubmitting, setFieldError }) => {
    try {
      setLoading(true);
      
      // Only send changed fields
      const updates = {};
      if (values.username !== user.username) updates.username = values.username;
      if (values.email !== user.email) updates.email = values.email;
      if (values.first_name !== user.first_name) updates.first_name = values.first_name;
      if (values.last_name !== user.last_name) updates.last_name = values.last_name;
      if (values.role !== user.role) updates.role = values.role;
      if (values.active !== user.active) updates.active = values.active;

      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      await axios.put(`/api/users/${user.id}`, updates);
      onSuccess(`User ${values.username} updated successfully`);
    } catch (err) {
      const errorMsg = err.response?.data?.msg || err.message;
      if (err.response?.data?.errors) {
        // Handle validation errors
        err.response.data.errors.forEach(error => {
          if (error.param) {
            setFieldError(error.param, error.msg);
          }
        });
      } else {
        onError('Failed to update user: ' + errorMsg);
      }
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'error',
      lab_manager: 'warning',
      lab_technician: 'primary',
      bioinformatician: 'secondary',
      researcher: 'default'
    };
    return colors[role] || 'default';
  };

  if (!user) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit User: {user.username}</DialogTitle>
      
      <Formik
        initialValues={{
          username: user.username || '',
          email: user.email || '',
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          role: user.role || 'researcher',
          active: user.active !== false
        }}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize={true}
      >
        {({ errors, touched, values, setFieldValue, isSubmitting }) => (
          <Form>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    name="username"
                    label="Username"
                    fullWidth
                    required
                    error={touched.username && !!errors.username}
                    helperText={touched.username && errors.username}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    name="email"
                    label="Email Address"
                    type="email"
                    fullWidth
                    required
                    error={touched.email && !!errors.email}
                    helperText={touched.email && errors.email}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    name="first_name"
                    label="First Name"
                    fullWidth
                    required
                    error={touched.first_name && !!errors.first_name}
                    helperText={touched.first_name && errors.first_name}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Field
                    as={TextField}
                    name="last_name"
                    label="Last Name"
                    fullWidth
                    required
                    error={touched.last_name && !!errors.last_name}
                    helperText={touched.last_name && errors.last_name}
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <FormControl fullWidth required error={touched.role && !!errors.role}>
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={values.role}
                      onChange={(e) => setFieldValue('role', e.target.value)}
                      label="Role"
                      disabled={loading}
                    >
                      {roles.map((role) => (
                        <MenuItem key={role.value} value={role.value}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={role.label}
                              color={getRoleColor(role.value)}
                              size="small"
                            />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {touched.role && errors.role && (
                      <FormHelperText>{errors.role}</FormHelperText>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={values.active}
                        onChange={(e) => setFieldValue('active', e.target.checked)}
                        disabled={loading}
                      />
                    }
                    label="Active Account"
                  />
                </Grid>
                
                {values.role && (
                  <Grid item xs={12}>
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight="bold" gutterBottom>
                        {roles.find(r => r.value === values.role)?.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {roles.find(r => r.value === values.role)?.description}
                      </Typography>
                    </Box>
                  </Grid>
                )}

                {/* User Info */}
                <Grid item xs={12}>
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      Account Information
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Created: {new Date(user.created_at).toLocaleDateString()}
                      {user.created_by_username && ` by ${user.created_by_username}`}
                    </Typography>
                    {user.last_login && (
                      <Typography variant="body2" color="text.secondary">
                        Last Login: {new Date(user.last_login).toLocaleDateString()}
                      </Typography>
                    )}
                    {user.force_password_change && (
                      <Typography variant="body2" color="warning.main">
                        ⚠️ User must change password on next login
                      </Typography>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions>
              <Button onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="contained"
                disabled={loading || isSubmitting}
              >
                {loading ? 'Updating...' : 'Update User'}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default UserEditDialog;