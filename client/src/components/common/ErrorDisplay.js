import React from 'react';
import { 
  Alert, 
  AlertTitle, 
  Box, 
  Typography, 
  Button, 
  Collapse, 
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useState } from 'react';

const ErrorDisplay = ({ 
  error, 
  title, 
  onRetry, 
  showDetails = true,
  severity = 'error',
  sx = {} 
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!error) return null;

  // Parse error object if it's a string
  const errorObj = typeof error === 'string' ? { message: error } : error;
  
  const {
    message = 'An error occurred',
    details = null,
    statusCode = null,
    timestamp = null,
    context = null,
    suggestions = []
  } = errorObj;

  const getSeverityIcon = () => {
    switch (severity) {
      case 'warning':
        return <WarningIcon />;
      case 'info':
        return <InfoIcon />;
      default:
        return <ErrorIcon />;
    }
  };

  const getSeverityColor = () => {
    switch (severity) {
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'error';
    }
  };

  return (
    <Alert 
      severity={getSeverityColor()} 
      sx={{ mb: 2, ...sx }}
      icon={getSeverityIcon()}
      action={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {onRetry && (
            <Button
              color="inherit"
              size="small"
              onClick={onRetry}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          )}
          {showDetails && (details || statusCode || timestamp) && (
            <IconButton
              color="inherit"
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      }
    >
      <AlertTitle>{title || 'Error'}</AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {message}
      </Typography>

      {/* Display suggestions if available */}
      {details?.suggestion && (
        <Typography 
          variant="body2" 
          sx={{ 
            mt: 1, 
            p: 1, 
            bgcolor: 'rgba(255, 255, 255, 0.1)', 
            borderRadius: 1,
            fontStyle: 'italic'
          }}
        >
          💡 {details.suggestion}
        </Typography>
      )}

      {/* Additional suggestions */}
      {suggestions.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
            Suggestions:
          </Typography>
          <List dense sx={{ py: 0 }}>
            {suggestions.map((suggestion, index) => (
              <ListItem key={index} sx={{ py: 0, px: 1 }}>
                <ListItemIcon sx={{ minWidth: 20 }}>
                  <InfoIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary={suggestion}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Expandable details */}
      <Collapse in={expanded}>
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
          {statusCode && (
            <Box sx={{ mb: 1 }}>
              <Chip 
                label={`Status: ${statusCode}`} 
                size="small" 
                color={getSeverityColor()} 
                variant="outlined"
              />
            </Box>
          )}
          
          {timestamp && (
            <Typography variant="caption" display="block" sx={{ mb: 1 }}>
              Time: {new Date(timestamp).toLocaleString()}
            </Typography>
          )}
          
          {context && (
            <Typography variant="caption" display="block" sx={{ mb: 1 }}>
              Context: {context}
            </Typography>
          )}

          {details && typeof details === 'object' && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Details:
              </Typography>
              <Box sx={{ 
                p: 1, 
                bgcolor: 'rgba(0, 0, 0, 0.1)', 
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.8rem'
              }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(details, null, 2)}
                </pre>
              </Box>
            </Box>
          )}
        </Box>
      </Collapse>
    </Alert>
  );
};

export default ErrorDisplay;