import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Link,
  Alert
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const { username, password } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Debug: Attempting login
      await login(username, password);
      // Debug: Login successful
    } catch (err) {
      console.error('Login error:', err);
      setError(typeof err === 'string' ? err : (err.message || 'Login failed. Please check your credentials.'));
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
            Login
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
              label="Password"
              variant="outlined"
              fullWidth
              name="password"
              type="password"
              value={password}
              onChange={onChange}
              margin="normal"
              required
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
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
          
          <Box className="auth-link">
            <Typography variant="body2" color="text.secondary">
              Need an account? Contact your lab manager.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;