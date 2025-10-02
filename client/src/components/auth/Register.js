import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Link,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SystemOptionSelect from '../common/SystemOptionSelect';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    role: 'user' // Default role
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const { username, email, password, confirmPassword, first_name, last_name, role } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate form
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await register({
        username,
        email,
        password,
        first_name,
        last_name,
        role
      });
    } catch (err) {
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="auth-container">
      <Container maxWidth="sm">
        <Paper elevation={3} className="auth-form">
          <Typography variant="h4" component="h1" className="auth-title" gutterBottom>
            Pathogen Discovery Database
          </Typography>
          <Typography variant="h5" component="h2" className="auth-title" gutterBottom>
            Create Account
          </Typography>
          
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          
          <form onSubmit={onSubmit}>
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              name="username"
              value={username}
              onChange={onChange}
              margin="normal"
              required
            />
            <TextField
              label="Email"
              variant="outlined"
              fullWidth
              name="email"
              type="email"
              value={email}
              onChange={onChange}
              margin="normal"
              required
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="First Name"
                variant="outlined"
                fullWidth
                name="first_name"
                value={first_name}
                onChange={onChange}
                margin="normal"
              />
              <TextField
                label="Last Name"
                variant="outlined"
                fullWidth
                name="last_name"
                value={last_name}
                onChange={onChange}
                margin="normal"
              />
            </Box>
            <TextField
              label="Password"
              variant="outlined"
              fullWidth
              name="password"
              type="password"
              value={password}
              onChange={onChange}
              margin="normal"
              required
              helperText="Password must be at least 6 characters"
            />
            <TextField
              label="Confirm Password"
              variant="outlined"
              fullWidth
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={onChange}
              margin="normal"
              required
            />
            <SystemOptionSelect
              category="user_role"
              name="role"
              label="Role"
              value={role}
              onChange={onChange}
              required
              margin="normal"
            />
            
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              className="auth-submit"
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Register'}
            </Button>
          </form>
          
          <Box className="auth-link">
            <Typography variant="body2">
              Already have an account?{' '}
              <Link component={RouterLink} to="/login">
                Login
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Register;