import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box,
  IconButton
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import axios from 'axios';

const PasswordResetDialog = ({ open, user, onClose, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleReset = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`/api/users/${user.id}/reset-password`);
      setTempPassword(response.data.temporaryPassword);
      // Don't call onSuccess immediately - let user see the password first
      // onSuccess will be triggered when they click "Done" button
    } catch (err) {
      const errorMsg = err.response?.data?.msg || err.message;
      onError('Failed to reset password: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTempPassword('');
    setShowPassword(false);
    onClose();
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Reset Password for {user.username}
      </DialogTitle>
      
      <DialogContent>
        {!tempPassword ? (
          <>
            <Typography variant="body1" gutterBottom>
              Are you sure you want to reset the password for <strong>{user.username}</strong> ({user.first_name} {user.last_name})?
            </Typography>
            
            <Box sx={{ mt: 2, p: 2, bgcolor: 'warning.50', borderRadius: 1 }}>
              <Typography variant="body2" color="warning.dark">
                <strong>Important:</strong>
              </Typography>
              <Typography variant="body2" color="warning.dark" sx={{ mt: 1 }}>
                • A new secure temporary password will be generated<br />
                • The user will be required to change it on their next login<br />
                • Any existing sessions will remain active<br />
                • You'll need to securely share the new password with the user
              </Typography>
            </Box>
          </>
        ) : (
          <Alert severity="success">
            <Typography variant="h6" gutterBottom>
              Password Reset Successful!
            </Typography>
            <Typography variant="body2" gutterBottom>
              A new temporary password has been generated for <strong>{user.username}</strong>. 
              Please share this securely with the user.
            </Typography>
            
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              bgcolor: 'grey.100', 
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              border: '2px dashed',
              borderColor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                {showPassword ? tempPassword : '••••••••••••••••'}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton 
                  size="small" 
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
                <IconButton 
                  size="small" 
                  onClick={handleCopyPassword}
                  title="Copy to clipboard"
                >
                  <CopyIcon />
                </IconButton>
              </Box>
            </Box>
            
            <Typography variant="body2" sx={{ mt: 2 }} color="warning.main">
              <strong>Next Steps:</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              1. Securely share this password with {user.first_name} {user.last_name}<br />
              2. Inform them they must change it on their next login<br />
              3. Consider using a secure communication method (encrypted email, password manager, etc.)
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        {!tempPassword ? (
          <>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleReset}
              variant="contained"
              color="warning"
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </>
        ) : (
          <Button 
            onClick={() => {
              onSuccess(`Password reset successfully for ${user.username}. Make sure to share the temporary password securely.`);
              handleClose();
            }}
            variant="contained"
          >
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PasswordResetDialog;