import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { specimenAPI } from '../../services/api';
import { toast } from 'react-toastify';

const MetadataAnalytics = ({ projectId, project }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedField, setExpandedField] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchAnalytics();
    }
  }, [projectId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await specimenAPI.getMetadataAnalytics(projectId);
      setAnalytics(response.data);
    } catch (err) {
      console.error('Failed to fetch metadata analytics:', err);
      toast.error('Failed to load metadata analytics');
    } finally {
      setLoading(false);
    }
  };

  const getFieldTypeIcon = (fieldType) => {
    const iconProps = { fontSize: 'small', sx: { mr: 1 } };
    
    switch (fieldType) {
      case 'categorical': return <Chip label="Cat" size="small" color="primary" />;
      case 'numeric': return <Chip label="Num" size="small" color="success" />;
      case 'boolean': return <Chip label="Bool" size="small" color="secondary" />;
      case 'temporal': return <Chip label="Date" size="small" color="info" />;
      case 'text': return <Chip label="Text" size="small" color="default" />;
      default: return <Chip label="?" size="small" />;
    }
  };

  const getQualityIcon = (quality) => {
    switch (quality.status) {
      case 'good': return <CheckCircleIcon color="success" fontSize="small" />;
      case 'fair': return <WarningIcon color="warning" fontSize="small" />;
      case 'poor': return <ErrorIcon color="error" fontSize="small" />;
      default: return <InfoIcon color="info" fontSize="small" />;
    }
  };

  const renderDistribution = (field) => {
    if (!field.distribution || !Array.isArray(field.distribution) || field.distribution.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Value Distribution
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Value</TableCell>
                <TableCell align="right">Count</TableCell>
                <TableCell align="right">Percentage</TableCell>
                <TableCell>Distribution</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {field.distribution.slice(0, 10).map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {item.value || item.range || item.period}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{item.count}</TableCell>
                  <TableCell align="right">{item.percentage}%</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 100 }}>
                      <LinearProgress
                        variant="determinate"
                        value={item.percentage}
                        sx={{ flexGrow: 1, mr: 1 }}
                      />
                      <Typography variant="caption" sx={{ minWidth: 35 }}>
                        {item.percentage}%
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {field.distribution.length > 10 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Showing top 10 values out of {field.uniqueCount} unique values
          </Alert>
        )}
      </Box>
    );
  };

  const renderStatistics = (field) => {
    if (!field.statistics) return null;

    const { statistics } = field;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Statistical Summary
        </Typography>
        <Grid container spacing={2}>
          {field.fieldType === 'numeric' && (
            <>
              <Grid item xs={6} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 1 }}>
                    <Typography variant="caption" color="text.secondary">Min</Typography>
                    <Typography variant="h6">{statistics.min}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 1 }}>
                    <Typography variant="caption" color="text.secondary">Max</Typography>
                    <Typography variant="h6">{statistics.max}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 1 }}>
                    <Typography variant="caption" color="text.secondary">Mean</Typography>
                    <Typography variant="h6">{statistics.mean}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 1 }}>
                    <Typography variant="caption" color="text.secondary">Std Dev</Typography>
                    <Typography variant="h6">{statistics.stdDev}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              {statistics.outlierCount > 0 && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    {statistics.outlierCount} potential outliers detected ({statistics.outliersPercentage}%)
                  </Alert>
                </Grid>
              )}
            </>
          )}
          {field.fieldType === 'temporal' && (
            <>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Date Range:</strong> {statistics.earliest} to {statistics.latest}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Span:</strong> {statistics.rangeDays} days ({statistics.rangeYears} years)
                </Typography>
              </Grid>
            </>
          )}
        </Grid>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Analyzing metadata...</Typography>
      </Box>
    );
  }

  if (!analytics || !analytics.summary || analytics.fieldsCount === 0) {
    return (
      <Alert severity="info">
        No metadata found for this project. Upload a CSV file to add metadata to specimens.
      </Alert>
    );
  }

  const { summary, fields } = analytics;

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AnalyticsIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="primary">
                {analytics.fieldsCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Metadata Fields
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUpIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="success.main">
                {summary.avgCompleteness || 0}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Completeness
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h4" color="info.main">
                {summary.highQualityFields || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                High Quality Fields
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Chip 
                label={summary.dataReadiness ? summary.dataReadiness.toUpperCase() : 'UNKNOWN'} 
                color={
                  summary.dataReadiness === 'ready' ? 'success' : 
                  summary.dataReadiness === 'needs-review' ? 'warning' : 'error'
                }
                sx={{ fontSize: '1rem', height: '40px', mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                Data Readiness
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Field Type Summary */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Field Type Distribution
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {summary.fieldTypes && Object.entries(summary.fieldTypes).map(([type, count]) => (
            <Chip
              key={type}
              label={`${type}: ${count}`}
              variant="outlined"
              size="small"
            />
          ))}
          {!summary.fieldTypes && (
            <Typography variant="body2" color="text.secondary">
              No field type data available
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Individual Field Analysis */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Field-by-Field Analysis
      </Typography>
      
      {fields && fields.length > 0 ? fields.map((field, index) => (
        <Accordion
          key={field.fieldName}
          expanded={expandedField === field.fieldName}
          onChange={(event, isExpanded) => setExpandedField(isExpanded ? field.fieldName : false)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {getFieldTypeIcon(field.fieldType)}
              <Typography sx={{ flexGrow: 1, ml: 1 }}>
                <strong>{field.fieldName}</strong>
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                <Typography variant="body2" sx={{ mr: 1 }}>
                  {field.completeness}% complete
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={field.completeness}
                  sx={{ width: 60, mr: 2 }}
                />
                <Tooltip title={`Quality: ${field.dataQuality.status} (${field.dataQuality.score}/100)`}>
                  {getQualityIcon(field.dataQuality)}
                </Tooltip>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Field Information
                </Typography>
                <Typography variant="body2">
                  <strong>Type:</strong> {field.fieldType}
                </Typography>
                <Typography variant="body2">
                  <strong>Unique Values:</strong> {field.uniqueCount}
                </Typography>
                <Typography variant="body2">
                  <strong>Non-Empty:</strong> {field.nonEmptyCount}/{field.totalCount}
                </Typography>
                <Typography variant="body2">
                  <strong>Data Quality:</strong> {field.dataQuality.status} ({field.dataQuality.score}/100)
                </Typography>
                {field.dataQuality.issues.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Issues: {field.dataQuality.issues.join(', ')}
                  </Alert>
                )}
              </Grid>
              <Grid item xs={12} md={8}>
                {renderDistribution(field)}
                {renderStatistics(field)}
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      )) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          No field analysis available. This project may not have metadata or the analysis hasn't been generated yet.
        </Alert>
      )}
    </Box>
  );
};

export default MetadataAnalytics;