/**
 * Universal Metadata Analytics System
 * 
 * This module provides intelligent analysis of any metadata structure,
 * automatically detecting field types and generating useful statistics
 * for researchers across any domain.
 */

// Universal metadata analysis function
function analyzeMetadataFields(specimens) {
  const fieldAnalysis = {};
  const totalSpecimens = specimens.length;
  
  // First pass: collect all values for each field
  specimens.forEach(specimen => {
    const metadata = specimen.metadata;
    Object.keys(metadata).forEach(fieldName => {
      if (!fieldAnalysis[fieldName]) {
        fieldAnalysis[fieldName] = {
          fieldName,
          values: [],
          nonEmptyCount: 0,
          emptyCount: 0
        };
      }
      
      const value = metadata[fieldName];
      if (value !== null && value !== undefined && value !== '') {
        fieldAnalysis[fieldName].values.push(value);
        fieldAnalysis[fieldName].nonEmptyCount++;
      } else {
        fieldAnalysis[fieldName].emptyCount++;
      }
    });
  });
  
  // Second pass: analyze each field
  const analyzedFields = Object.values(fieldAnalysis).map(field => {
    const analysis = analyzeFieldValues(field, totalSpecimens);
    return analysis;
  });
  
  // Sort by usage frequency (most complete fields first)
  analyzedFields.sort((a, b) => b.completeness - a.completeness);
  
  // Generate summary statistics
  const summary = generateSummaryStats(analyzedFields, totalSpecimens);
  
  return {
    totalSpecimens,
    specimensWithMetadata: totalSpecimens,
    fieldsCount: analyzedFields.length,
    fields: analyzedFields,
    summary
  };
}

// Analyze individual field values and determine type/distribution
function analyzeFieldValues(field, totalSpecimens) {
  const { fieldName, values, nonEmptyCount, emptyCount } = field;
  const completeness = ((nonEmptyCount / totalSpecimens) * 100);
  
  // Handle empty values array
  if (!values || values.length === 0) {
    return {
      fieldName,
      fieldType: 'empty',
      totalCount: totalSpecimens,
      nonEmptyCount: 0,
      emptyCount: totalSpecimens,
      completeness: 0,
      uniqueCount: 0,
      uniqueValues: [],
      distribution: [],
      statistics: null,
      dataQuality: { score: 0, issues: ['No data available'], status: 'poor' }
    };
  }
  
  // Determine field type and characteristics
  const fieldType = detectFieldType(values);
  const uniqueValues = [...new Set(values)];
  const uniqueCount = uniqueValues.length;
  
  let distribution = [];
  let statistics = null;
  
  if (fieldType === 'categorical') {
    distribution = getCategoricalDistribution(values);
  } else if (fieldType === 'numeric') {
    statistics = getNumericStatistics(values);
    distribution = getNumericDistribution(values);
  } else if (fieldType === 'boolean') {
    distribution = getBooleanDistribution(values);
  } else if (fieldType === 'temporal') {
    statistics = getTemporalStatistics(values);
    distribution = getTemporalDistribution(values);
  }
  
  return {
    fieldName,
    fieldType,
    totalCount: totalSpecimens,
    nonEmptyCount,
    emptyCount,
    completeness: Math.round(completeness * 100) / 100,
    uniqueCount,
    uniqueValues: uniqueCount <= 20 ? uniqueValues : uniqueValues.slice(0, 20),
    distribution,
    statistics,
    dataQuality: assessFieldQuality(values, fieldType)
  };
}

// Smart field type detection
function detectFieldType(values) {
  if (values.length === 0) return 'empty';
  
  const sampleSize = Math.min(values.length, 100); // Sample for performance
  const sample = values.slice(0, sampleSize);
  
  // Check for boolean
  const booleanValues = sample.filter(v => 
    ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(String(v).toLowerCase())
  );
  if (booleanValues.length / sample.length > 0.8) return 'boolean';
  
  // Check for numeric
  const numericValues = sample.filter(v => !isNaN(parseFloat(v)) && isFinite(parseFloat(v)));
  if (numericValues.length / sample.length > 0.8) return 'numeric';
  
  // Check for dates
  const dateValues = sample.filter(v => {
    const date = new Date(v);
    return !isNaN(date.getTime()) && String(v).match(/\d{4}|\d{2}\/\d{2}|\d{2}-\d{2}/);
  });
  if (dateValues.length / sample.length > 0.5) return 'temporal';
  
  // Check if categorical (reasonable number of unique values)
  const uniqueCount = new Set(sample).size;
  if (uniqueCount <= Math.min(20, sample.length * 0.5)) return 'categorical';
  
  // Default to text
  return 'text';
}

// Get categorical distribution
function getCategoricalDistribution(values) {
  if (!values || values.length === 0) {
    return [];
  }
  
  const counts = {};
  values.forEach(value => {
    const key = String(value);
    counts[key] = (counts[key] || 0) + 1;
  });
  
  return Object.entries(counts)
    .map(([value, count]) => ({
      value,
      count,
      percentage: Math.round((count / values.length) * 100 * 100) / 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // Top 20 values
}

// Get numeric statistics
function getNumericStatistics(values) {
  const numbers = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
  if (numbers.length === 0) return null;
  
  numbers.sort((a, b) => a - b);
  
  const min = numbers[0];
  const max = numbers[numbers.length - 1];
  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const median = numbers[Math.floor(numbers.length / 2)];
  
  // Calculate standard deviation
  const variance = numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);
  
  // Calculate quartiles
  const q1 = numbers[Math.floor(numbers.length * 0.25)];
  const q3 = numbers[Math.floor(numbers.length * 0.75)];
  
  // Detect outliers (simple IQR method)
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const outliers = numbers.filter(n => n < lowerBound || n > upperBound);
  
  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    q1: Math.round(q1 * 100) / 100,
    q3: Math.round(q3 * 100) / 100,
    outlierCount: outliers.length,
    outliersPercentage: Math.round((outliers.length / numbers.length) * 100 * 100) / 100
  };
}

// Get numeric distribution (histogram)
function getNumericDistribution(values) {
  if (!values || values.length === 0) {
    return [];
  }
  
  const numbers = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
  if (numbers.length === 0) return [];
  
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  
  // Handle case where all values are the same
  if (min === max) {
    return [{
      range: `${min}`,
      count: numbers.length,
      percentage: 100
    }];
  }
  
  const binCount = Math.min(10, Math.ceil(Math.sqrt(numbers.length))); // Adaptive bin count
  const binSize = (max - min) / binCount;
  
  const bins = Array(binCount).fill(0).map((_, i) => ({
    range: `${Math.round((min + i * binSize) * 100) / 100} - ${Math.round((min + (i + 1) * binSize) * 100) / 100}`,
    count: 0,
    percentage: 0
  }));
  
  numbers.forEach(num => {
    let binIndex = Math.floor((num - min) / binSize);
    if (binIndex >= binCount) binIndex = binCount - 1; // Handle edge case
    bins[binIndex].count++;
  });
  
  bins.forEach(bin => {
    bin.percentage = Math.round((bin.count / numbers.length) * 100 * 100) / 100;
  });
  
  return bins;
}

// Get boolean distribution
function getBooleanDistribution(values) {
  if (!values || values.length === 0) {
    return [];
  }
  
  const counts = { true: 0, false: 0 };
  
  values.forEach(value => {
    const normalized = String(value).toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      counts.true++;
    } else {
      counts.false++;
    }
  });
  
  const total = counts.true + counts.false;
  if (total === 0) return [];
  
  return [
    {
      value: 'True',
      count: counts.true,
      percentage: Math.round((counts.true / total) * 100 * 100) / 100
    },
    {
      value: 'False',
      count: counts.false,
      percentage: Math.round((counts.false / total) * 100 * 100) / 100
    }
  ];
}

// Get temporal statistics
function getTemporalStatistics(values) {
  const dates = values.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
  if (dates.length === 0) return null;
  
  dates.sort((a, b) => a - b);
  
  const earliest = dates[0];
  const latest = dates[dates.length - 1];
  const range = latest - earliest;
  const rangeDays = Math.floor(range / (1000 * 60 * 60 * 24));
  
  return {
    earliest: earliest.toISOString().split('T')[0],
    latest: latest.toISOString().split('T')[0],
    rangeDays,
    rangeYears: Math.round((rangeDays / 365.25) * 100) / 100
  };
}

// Get temporal distribution
function getTemporalDistribution(values) {
  if (!values || values.length === 0) {
    return [];
  }
  
  const dates = values.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
  if (dates.length === 0) return [];
  
  // Group by year or month depending on date range
  const earliest = Math.min(...dates);
  const latest = Math.max(...dates);
  const rangeYears = (latest - earliest) / (1000 * 60 * 60 * 24 * 365.25);
  
  const groups = {};
  
  dates.forEach(date => {
    let key;
    if (rangeYears > 2) {
      // Group by year
      key = date.getFullYear().toString();
    } else {
      // Group by month
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    
    groups[key] = (groups[key] || 0) + 1;
  });
  
  return Object.entries(groups)
    .map(([period, count]) => ({
      period,
      count,
      percentage: Math.round((count / dates.length) * 100 * 100) / 100
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// Assess field data quality
function assessFieldQuality(values, fieldType) {
  const issues = [];
  const totalValues = values.length;
  
  // Check for consistency issues
  if (fieldType === 'categorical') {
    // Look for potential duplicates (case sensitivity, whitespace)
    const normalized = values.map(v => String(v).toLowerCase().trim());
    const normalizedUnique = new Set(normalized);
    const originalUnique = new Set(values.map(v => String(v)));
    
    if (normalizedUnique.size < originalUnique.size) {
      issues.push('Potential case/whitespace inconsistencies');
    }
  }
  
  // Check for outliers in numeric data
  if (fieldType === 'numeric') {
    const numbers = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const stdDev = Math.sqrt(numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length);
    const outliers = numbers.filter(n => Math.abs(n - mean) > 3 * stdDev);
    
    if (outliers.length > 0) {
      issues.push(`${outliers.length} potential outliers detected`);
    }
  }
  
  // Check for mixed formats in text data
  if (fieldType === 'text') {
    const formats = new Set();
    values.forEach(v => {
      const str = String(v);
      if (str.match(/^\d+$/)) formats.add('numeric');
      else if (str.match(/^[A-Z]+$/)) formats.add('uppercase');
      else if (str.match(/^[a-z]+$/)) formats.add('lowercase');
      else if (str.match(/^[A-Z][a-z]+$/)) formats.add('titlecase');
      else formats.add('mixed');
    });
    
    if (formats.size > 2) {
      issues.push('Mixed formatting detected');
    }
  }
  
  return {
    score: Math.max(0, 100 - (issues.length * 20)), // Quality score out of 100
    issues,
    status: issues.length === 0 ? 'good' : issues.length <= 2 ? 'fair' : 'poor'
  };
}

// Generate overall summary statistics
function generateSummaryStats(fields, totalSpecimens) {
  const completenessScores = fields.map(f => f.completeness);
  const avgCompleteness = completenessScores.reduce((sum, score) => sum + score, 0) / fields.length;
  
  const qualityScores = fields.map(f => f.dataQuality.score);
  const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / fields.length;
  
  const fieldTypes = fields.reduce((acc, field) => {
    acc[field.fieldType] = (acc[field.fieldType] || 0) + 1;
    return acc;
  }, {});
  
  const highQualityFields = fields.filter(f => f.dataQuality.status === 'good').length;
  const completeFields = fields.filter(f => f.completeness >= 90).length;
  
  return {
    avgCompleteness: Math.round(avgCompleteness * 100) / 100,
    avgQuality: Math.round(avgQuality * 100) / 100,
    fieldTypes,
    highQualityFields,
    completeFields,
    dataReadiness: avgCompleteness >= 80 && avgQuality >= 70 ? 'ready' : 
                   avgCompleteness >= 60 && avgQuality >= 50 ? 'needs-review' : 'poor'
  };
}

module.exports = {
  analyzeMetadataFields,
  analyzeFieldValues,
  detectFieldType,
  getCategoricalDistribution,
  getNumericStatistics,
  getNumericDistribution,
  getBooleanDistribution,
  getTemporalStatistics,
  getTemporalDistribution,
  assessFieldQuality,
  generateSummaryStats
};