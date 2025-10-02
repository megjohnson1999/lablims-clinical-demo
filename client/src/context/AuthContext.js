import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { setAuthToken } from '../services/api';
import logger from '../utils/logger';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPasswordChangeDialog, setShowPasswordChangeDialog] = useState(false);
  const navigate = useNavigate();

  // Set up axios defaults
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // Load user from token
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get('/api/auth/user');
        setCurrentUser(res.data);
        setIsAuthenticated(true);
        
        // Check if user needs to change password
        if (res.data.force_password_change) {
          setShowPasswordChangeDialog(true);
        }
      } catch (err) {
        logger.error('Failed to load user', { error: err.message });
        if (err.response) {
          logger.error('User load error details', { 
            status: err.response.status, 
            data: err.response.data 
          });
        }
        localStorage.removeItem('token');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [token]);

  // Login function
  const login = async (username, password) => {
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setCurrentUser(res.data.user);
      setIsAuthenticated(true);
      
      // Check if user needs to change password
      if (res.data.user.force_password_change) {
        setShowPasswordChangeDialog(true);
      }
      
      return true;
    } catch (err) {
      logger.error('Login failed', { error: err.message });
      if (err.response) {
        logger.error('Login error details', { status: err.response.status });
      }
      throw err.response?.data?.msg || 'Login failed';
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      const res = await axios.post('/api/auth/register', userData);
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      return true;
    } catch (err) {
      console.error('Registration failed', err);
      throw err.response?.data?.msg || 'Registration failed';
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setAuthToken(null); // Clear axios headers
    setCurrentUser(null);
    setIsAuthenticated(false);
    setShowPasswordChangeDialog(false);
    navigate('/login');
  };

  // Handle successful password change
  const handlePasswordChanged = () => {
    setShowPasswordChangeDialog(false);
    // Refresh user data to get updated force_password_change status
    loadUserData();
  };

  // Refresh user data
  const loadUserData = async () => {
    try {
      const res = await axios.get('/api/auth/user');
      setCurrentUser(res.data);
    } catch (err) {
      console.error('Failed to refresh user data:', err);
    }
  };

  const value = {
    currentUser,
    isAuthenticated,
    loading,
    showPasswordChangeDialog,
    handlePasswordChanged,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}