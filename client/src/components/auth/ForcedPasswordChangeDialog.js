import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  FormHelperText
} from '@mui/material';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';

const validationSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/\d/, 'Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your new password')
});

const ForcedPasswordChangeDialog = ({ open, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values, { setSubmitting, setFieldError }) => {
    try {
      setLoading(true);
      
      await axios.post('/api/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });
      
      onSuccess('Password changed successfully! You can now access the system.');
      
    } catch (err) {
      const errorMsg = err.response?.data?.msg || err.message;
      
      if (err.response?.data?.errors) {
        // Handle validation errors
        err.response.data.errors.forEach(error => {
          if (error.param) {
            setFieldError(error.param, error.msg);
          }
        });
      } else if (errorMsg.includes('Current password is incorrect')) {
        setFieldError('currentPassword', 'Current password is incorrect');
      } else {
        onError('Failed to change password: ' + errorMsg);
      }
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      disableEscapeKeyDown 
      disableBackdropClick 
      maxWidth="sm" 
      fullWidth
    >
      <DialogTitle>Password Change Required</DialogTitle>
      
      <Formik
        initialValues={{
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form>
            <DialogContent>
              <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  You must change your temporary password before accessing the system.
                  This is required for security purposes.
                </Typography>
              </Alert>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Field
                  as={TextField}
                  name="currentPassword"
                  label="Current Password"
                  type="password"
                  fullWidth
                  required
                  error={touched.currentPassword && !!errors.currentPassword}
                  helperText={touched.currentPassword && errors.currentPassword}
                  disabled={loading}
                />
                
                <Field
                  as={TextField}
                  name="newPassword"
                  label="New Password"
                  type="password"
                  fullWidth
                  required
                  error={touched.newPassword && !!errors.newPassword}
                  helperText={touched.newPassword && errors.newPassword}
                  disabled={loading}
                />
                
                <Field
                  as={TextField}
                  name="confirmPassword"
                  label="Confirm New Password"
                  type="password"
                  fullWidth
                  required
                  error={touched.confirmPassword && !!errors.confirmPassword}
                  helperText={touched.confirmPassword && errors.confirmPassword}
                  disabled={loading}
                />
              </Box>

              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Password Requirements:
                </Typography>
                <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2 }}>
                  <li>At least 8 characters long</li>
                  <li>One uppercase letter (A-Z)</li>
                  <li>One lowercase letter (a-z)</li>
                  <li>One number (0-9)</li>
                  <li>One special character (!@#$%^&*)</li>
                </Typography>
              </Box>
            </DialogContent>

            <DialogActions>
              <Button 
                type="submit" 
                variant="contained" 
                fullWidth
                disabled={loading || isSubmitting}
                size="large"
              >
                {loading ? 'Changing Password...' : 'Change Password'}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default ForcedPasswordChangeDialog;