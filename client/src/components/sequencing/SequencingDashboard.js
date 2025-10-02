import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const SequencingDashboard = () => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/sequencing/runs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRuns(response.data);
    } catch (err) {
      console.error('Error fetching runs:', err);
      setError('Failed to load sequencing runs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getLinkageRate = (run) => {
    const total = parseInt(run.sample_count) || 0;
    const linked = parseInt(run.linked_count) || 0;
    if (total === 0) return 0;
    return Math.round((linked / total) * 100);
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4">
            Sequencing Runs
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/sequencing/import')}
          >
            Import Sequencing Data
          </Button>
        </Box>

        {runs.length === 0 ? (
          <Alert severity="info">
            No sequencing runs found. Import sequencing data to get started.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Run Identifier</TableCell>
                  <TableCell>Sequencer</TableCell>
                  <TableCell>Completion Date</TableCell>
                  <TableCell align="right">Samples</TableCell>
                  <TableCell align="right">Linked</TableCell>
                  <TableCell align="right">No Match</TableCell>
                  <TableCell align="right">Failed</TableCell>
                  <TableCell align="right">Link Rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {runs.map((run) => {
                  const linkRate = getLinkageRate(run);
                  const runIdentifier = run.service_request_number || run.flowcell_id || 'Unknown';
                  return (
                    <TableRow
                      key={run.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/sequencing/runs/${run.id}`)}
                    >
                      <TableCell>
                        <strong>{runIdentifier}</strong>
                      </TableCell>
                      <TableCell>{run.sequencer_type}</TableCell>
                      <TableCell>{formatDate(run.completion_date)}</TableCell>
                      <TableCell align="right">{run.sample_count || 0}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={run.linked_count || 0}
                          color="success"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={run.no_match_count || 0}
                          color="warning"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={run.failed_count || 0}
                          color="error"
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${linkRate}%`}
                          color={linkRate >= 80 ? 'success' : linkRate >= 50 ? 'warning' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
};

export default SequencingDashboard;