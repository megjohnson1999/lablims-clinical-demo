import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  Collapse,
  IconButton,
  Divider,
  Stack
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  BugReport as BugReportIcon,
  Home as HomeIcon
} from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Generate unique error ID for tracking
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      errorInfo
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Error info:', errorInfo);
    }

    // Log error to external service in production
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService = async (error, errorInfo) => {
    try {
      // In a real application, you would send this to your error tracking service
      // like Sentry, LogRocket, or a custom error API
      const errorReport = {
        id: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        userId: localStorage.getItem('userId'), // if available
        buildVersion: process.env.REACT_APP_VERSION || 'unknown'
      };

      // For now, just log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error report:', errorReport);
      }
      
      // Send to error tracking service
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      });
      
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      errorId: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }));
  };

  copyErrorToClipboard = async () => {
    const errorText = `
Error ID: ${this.state.errorId}
Timestamp: ${new Date().toISOString()}
Message: ${this.state.error?.message || 'Unknown error'}
URL: ${window.location.href}

Stack Trace:
${this.state.error?.stack || 'No stack trace available'}

Component Stack:
${this.state.errorInfo?.componentStack || 'No component stack available'}
`;

    try {
      await navigator.clipboard.writeText(errorText);
      // Show success message (you could use a toast here)
      alert('Error details copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback: select text
      const textArea = document.createElement('textarea');
      textArea.value = errorText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Error details copied to clipboard');
    }
  };

  getErrorCategory() {
    const error = this.state.error;
    if (!error) return 'unknown';

    const message = error.message?.toLowerCase() || '';
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }
    
    if (message.includes('chunk') || message.includes('loading')) {
      return 'loading';
    }
    
    if (stack.includes('react') || stack.includes('component')) {
      return 'component';
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'permission';
    }
    
    return 'application';
  }

  getUserFriendlyMessage() {
    const category = this.getErrorCategory();
    const messages = {
      network: 'There was a problem connecting to the server. Please check your internet connection and try again.',
      loading: 'Failed to load part of the application. This might be a temporary issue.',
      component: 'A component failed to render properly. This might be due to invalid data or a temporary glitch.',
      permission: 'You may not have permission to access this feature. Please try logging in again.',
      application: 'An unexpected error occurred in the application.'
    };

    return messages[category] || messages.application;
  }

  getSuggestedActions() {
    const category = this.getErrorCategory();
    
    const actions = {
      network: [
        'Check your internet connection',
        'Try refreshing the page',
        'If the problem persists, contact support'
      ],
      loading: [
        'Refresh the page to reload the application',
        'Clear your browser cache and cookies',
        'Try using a different browser'
      ],
      component: [
        'Try refreshing the page',
        'Go back to the previous page and try again',
        'If this happens repeatedly, contact support'
      ],
      permission: [
        'Log out and log back in',
        'Contact your administrator if you believe you should have access',
        'Try accessing from a different account if available'
      ],
      application: [
        'Refresh the page',
        'Try the action again',
        'Contact support if the problem continues'
      ]
    };

    return actions[category] || actions.application;
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            bgcolor: 'background.default'
          }}
        >
          <Paper
            elevation={3}
            sx={{
              maxWidth: 600,
              width: '100%',
              p: 4,
              textAlign: 'center'
            }}
          >
            <ErrorIcon
              sx={{
                fontSize: 64,
                color: 'error.main',
                mb: 2
              }}
            />

            <Typography variant="h4" gutterBottom color="error">
              Oops! Something went wrong
            </Typography>

            <Typography variant="body1" color="text.secondary" paragraph>
              {this.getUserFriendlyMessage()}
            </Typography>

            <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="subtitle2" gutterBottom>
                What you can try:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {this.getSuggestedActions().map((action, index) => (
                  <li key={index}>
                    <Typography variant="body2">{action}</Typography>
                  </li>
                ))}
              </ul>
            </Alert>

            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2 }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleRetry}
                color="primary"
              >
                Try Again
              </Button>

              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={this.handleReload}
              >
                Reload Page
              </Button>

              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
              >
                Go Home
              </Button>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Error Details Section */}
            <Box>
              <Button
                variant="text"
                startIcon={this.state.showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={this.toggleDetails}
                color="inherit"
                size="small"
              >
                {this.state.showDetails ? 'Hide' : 'Show'} Technical Details
              </Button>

              <Collapse in={this.state.showDetails}>
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 2,
                    p: 2,
                    bgcolor: 'grey.50',
                    textAlign: 'left'
                  }}
                >
                  <Typography variant="caption" color="text.secondary" gutterBottom>
                    Error ID: {this.state.errorId}
                  </Typography>

                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Error:</strong> {this.state.error?.message || 'Unknown error'}
                  </Typography>

                  {process.env.NODE_ENV === 'development' && (
                    <>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Stack Trace:</strong>
                      </Typography>
                      <pre
                        style={{
                          fontSize: '10px',
                          overflow: 'auto',
                          maxHeight: '200px',
                          backgroundColor: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          marginBottom: '8px'
                        }}
                      >
                        {this.state.error?.stack || 'No stack trace available'}
                      </pre>

                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Component Stack:</strong>
                      </Typography>
                      <pre
                        style={{
                          fontSize: '10px',
                          overflow: 'auto',
                          maxHeight: '150px',
                          backgroundColor: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          marginBottom: '16px'
                        }}
                      >
                        {this.state.errorInfo?.componentStack || 'No component stack available'}
                      </pre>
                    </>
                  )}

                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<BugReportIcon />}
                      onClick={this.copyErrorToClipboard}
                    >
                      Copy Error Details
                    </Button>
                  </Stack>
                </Paper>
              </Collapse>
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
              If this problem persists, please contact support with Error ID: {this.state.errorId}
            </Typography>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;