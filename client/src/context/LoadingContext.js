import React, { createContext, useContext, useState } from 'react';
import { 
  Backdrop, 
  CircularProgress, 
  Typography, 
  Box,
  LinearProgress
} from '@mui/material';

const LoadingContext = createContext();

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export const LoadingProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(null); // For progress bar

  const showLoading = (message = 'Loading...') => {
    setLoadingMessage(message);
    setLoading(true);
  };

  const hideLoading = () => {
    setLoading(false);
    setLoadingMessage('');
    setProgress(null);
  };

  const updateProgress = (value, message) => {
    setProgress(value);
    if (message) setLoadingMessage(message);
  };

  const value = {
    loading,
    loadingMessage,
    progress,
    showLoading,
    hideLoading,
    updateProgress
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
      
      {/* Global Loading Overlay */}
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          flexDirection: 'column',
          gap: 2
        }}
        open={loading}
      >
        <CircularProgress color="inherit" size={60} />
        {loadingMessage && (
          <Typography variant="h6" component="div">
            {loadingMessage}
          </Typography>
        )}
        {progress !== null && (
          <Box sx={{ width: 300 }}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                height: 8, 
                borderRadius: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4
                }
              }} 
            />
            <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
        )}
      </Backdrop>
    </LoadingContext.Provider>
  );
};