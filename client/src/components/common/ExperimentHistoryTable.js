import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
  Link as MuiLink,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Science as ScienceIcon,
  Description as ProtocolIcon,
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/helpers';

/**
 * Reusable component for displaying experiment history
 * Used in both specimen detail and protocol detail pages
 */
const ExperimentHistoryTable = ({ 
  experiments = [], 
  loading = false, 
  showProtocolColumn = true,
  showSpecimenColumn = true,
  emptyMessage = "No experiments found"
}) => {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'success';
      case 'planned': return 'info';
      case 'in_progress': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const handleExperimentClick = (experimentId) => {
    navigate(`/experiments/${experimentId}`);
  };

  const handleProtocolClick = (protocolId) => {
    navigate(`/protocols/${protocolId}`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <Typography variant="body2" color="textSecondary">
          Loading experiments...
        </Typography>
      </Box>
    );
  }

  if (!experiments || experiments.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <Typography variant="body2" color="textSecondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Experiment</TableCell>
            {showProtocolColumn && <TableCell>Protocol</TableCell>}
            {showSpecimenColumn && <TableCell>Specimens</TableCell>}
            <TableCell>Date Performed</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Performed By</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {experiments.map((experiment) => (
            <TableRow key={experiment.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  #{experiment.experiment_id}
                </Typography>
                {experiment.notes && (
                  <Typography variant="caption" color="textSecondary" display="block">
                    {experiment.notes.substring(0, 50)}
                    {experiment.notes.length > 50 ? '...' : ''}
                  </Typography>
                )}
              </TableCell>
              
              {showProtocolColumn && (
                <TableCell>
                  <MuiLink 
                    component="button"
                    onClick={() => handleProtocolClick(experiment.protocol_id)}
                    variant="body2"
                    underline="hover"
                  >
                    {experiment.protocol_name || 'Unknown Protocol'}
                  </MuiLink>
                  {experiment.protocol_version && (
                    <Typography variant="caption" color="textSecondary" display="block">
                      v{experiment.protocol_version}
                    </Typography>
                  )}
                </TableCell>
              )}
              
              {showSpecimenColumn && (
                <TableCell>
                  {experiment.specimens && experiment.specimens.length > 0 ? (
                    <Box>
                      {experiment.specimens.slice(0, 3).map((specimen, index) => (
                        <Chip
                          key={specimen.id || index}
                          label={`#${specimen.specimen_number || specimen.tube_id}`}
                          size="small"
                          variant="outlined"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                      {experiment.specimens.length > 3 && (
                        <Typography variant="caption" color="textSecondary">
                          +{experiment.specimens.length - 3} more
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="caption" color="textSecondary">
                      No specimens
                    </Typography>
                  )}
                </TableCell>
              )}
              
              <TableCell>
                {experiment.date_performed ? (
                  formatDate(experiment.date_performed)
                ) : (
                  <Typography variant="caption" color="textSecondary">
                    Not scheduled
                  </Typography>
                )}
              </TableCell>
              
              <TableCell>
                <Chip
                  label={experiment.status || 'Unknown'}
                  color={getStatusColor(experiment.status)}
                  size="small"
                  variant="outlined"
                />
              </TableCell>
              
              <TableCell>
                {experiment.performed_by_name || experiment.performed_by || (
                  <Typography variant="caption" color="textSecondary">
                    Unknown
                  </Typography>
                )}
              </TableCell>
              
              <TableCell>
                <Tooltip title="View Experiment Details">
                  <IconButton 
                    size="small" 
                    onClick={() => handleExperimentClick(experiment.id)}
                  >
                    <ViewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                {showProtocolColumn && (
                  <Tooltip title="View Protocol">
                    <IconButton 
                      size="small" 
                      onClick={() => handleProtocolClick(experiment.protocol_id)}
                    >
                      <ProtocolIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ExperimentHistoryTable;