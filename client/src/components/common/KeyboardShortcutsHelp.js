import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  Keyboard as KeyboardIcon
} from '@mui/icons-material';
import useKeyboardShortcuts, { setGlobalHelpFunction } from '../../hooks/useKeyboardShortcuts';

const KeyboardShortcutsHelp = ({ open, onClose }) => {
  const { shortcuts } = useKeyboardShortcuts();

  const formatKey = (keyCombo) => {
    return keyCombo.split(' + ').map((key, index, array) => (
      <Box key={key} component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <Chip 
          label={key} 
          size="small" 
          sx={{ 
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            height: '24px',
            '& .MuiChip-label': { px: 1 }
          }} 
        />
        {index < array.length - 1 && (
          <Typography component="span" sx={{ mx: 0.5, fontSize: '0.875rem' }}>
            +
          </Typography>
        )}
      </Box>
    ));
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyboardIcon />
          <Typography variant="h6">Keyboard Shortcuts</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Use these keyboard shortcuts to navigate and interact with the application more efficiently.
        </Typography>
        
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Shortcut</strong></TableCell>
                <TableCell><strong>Action</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shortcuts.map((shortcut, index) => (
                <TableRow key={index} hover>
                  <TableCell sx={{ fontFamily: 'monospace', width: '40%' }}>
                    {formatKey(shortcut.key)}
                  </TableCell>
                  <TableCell>
                    {shortcut.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box sx={{ mt: 3, p: 2, bgcolor: 'info.50', borderRadius: 1, border: '1px solid', borderColor: 'info.200' }}>
          <Typography variant="body2" color="info.main">
            <strong>Tips:</strong>
            <br />
            • Shortcuts work when you're not typing in input fields
            <br />
            • Context-aware shortcuts (like Ctrl+N) adapt to the current page
            <br />
            • Use "/" to quickly focus search fields without modifier keys
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Hook to provide keyboard shortcuts help functionality
export const useKeyboardShortcutsHelp = () => {
  const [helpOpen, setHelpOpen] = useState(false);

  const showHelp = () => setHelpOpen(true);
  const hideHelp = () => setHelpOpen(false);

  // Register the global help function
  useEffect(() => {
    setGlobalHelpFunction(showHelp);
    return () => setGlobalHelpFunction(null);
  }, []);

  const HelpComponent = () => (
    <KeyboardShortcutsHelp 
      open={helpOpen} 
      onClose={hideHelp} 
    />
  );

  return {
    showHelp,
    hideHelp,
    HelpComponent
  };
};

export default KeyboardShortcutsHelp;