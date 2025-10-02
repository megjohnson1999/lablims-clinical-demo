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
  Alert,
  Chip,
  Grid,
  FormHelperText
} from '@mui/material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';

const validationSchema = Yup.object({
  username: Yup.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .matches(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, periods, hyphens, and underscores')
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
    .required('Role is required')
});

const UserCreateDialog = ({ open, onClose, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    if (open) {
      loadRoles();
      setTempPassword('');
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
      const response = await axios.post('/api/users', values);
      
      setTempPassword(response.data.temporaryPassword);
      
      // Don't call onSuccess immediately - let user see the password first
      // onSuccess will be triggered when they click "Done" button
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
        onError('Failed to create user: ' + errorMsg);
      }
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setTempPassword('');
    onClose();
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

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New User</DialogTitle>
      
      {tempPassword && (
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              User Created Successfully!
            </Typography>
            <Typography variant="body2" gutterBottom>
              The user has been created with the following temporary password. Please share this securely with the user.
            </Typography>
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              bgcolor: 'grey.100', 
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              textAlign: 'center',
              border: '2px dashed',
              borderColor: 'success.main'
            }}>
              {tempPassword}
            </Box>
            <Typography variant="body2" sx={{ mt: 2 }} color="warning.main">
              <strong>Important:</strong> The user will be required to change this password on their first login.
            </Typography>
          </Alert>
        </DialogContent>
      )}

      {!tempPassword && (
        <Formik
          initialValues={{
            username: '',
            email: '',
            first_name: '',
            last_name: '',
            role: 'researcher'
          }}
          validationSchema={validationSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, values, setFieldValue, isSubmitting }) => (
            <Form>
              <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  A secure temporary password will be automatically generated. The user will be required to change it on their first login.
                </Typography>

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
                  <Grid item xs={12}>
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
                </Grid>
              </DialogContent>

              <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="contained"
                  disabled={loading || isSubmitting}
                >
                  {loading ? 'Creating...' : 'Create User'}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      )}

      {tempPassword && (
        <DialogActions>
          <Button 
            onClick={() => {
              onSuccess(`User created successfully! Make sure to share the temporary password with the new user.`);
              handleClose();
            }} 
            variant="contained"
          >
            Done
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default UserCreateDialog;