import React from 'react';
import { 
  Box, 
  Typography, 
  Paper,
  Grid,
  Divider
} from '@mui/material';
import Barcode from '../common/Barcode';
import { formatSpecimenIdForBarcode } from '../../utils/barcode';

const PrintableLabel = ({ 
  specimen, 
  showDetails = true,
  labelSize = 'standard', // 'standard', 'small', 'large'
  ...props 
}) => {
  const barcodeText = formatSpecimenIdForBarcode(specimen?.tube_id || specimen?.id);
  
  const labelSizes = {
    small: {
      width: '2.5in',
      height: '1in',
      barcodeHeight: 60,
      fontSize: '0.7rem',
      padding: 1
    },
    standard: {
      width: '4in',
      height: '2in', 
      barcodeHeight: 80,
      fontSize: '0.8rem',
      padding: 2
    },
    large: {
      width: '4in',
      height: '3in',
      barcodeHeight: 100,
      fontSize: '0.9rem',
      padding: 2
    }
  };

  const size = labelSizes[labelSize] || labelSizes.standard;

  if (!specimen) {
    return (
      <Paper 
        sx={{ 
          width: size.width,
          height: size.height,
          p: size.padding,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed #ccc'
        }}
      >
        <Typography variant="caption" color="text.secondary">
          No specimen data
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper 
      sx={{ 
        width: size.width,
        height: size.height,
        p: size.padding,
        border: '1px solid #000',
        borderRadius: 0,
        backgroundColor: '#fff',
        '@media print': {
          border: '1px solid #000',
          boxShadow: 'none',
          margin: 0
        }
      }}
      {...props}
    >
      <Grid container spacing={1} sx={{ height: '100%' }}>
        {/* Header with Tube ID */}
        <Grid item xs={12}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontSize: size.fontSize,
              fontWeight: 'bold',
              textAlign: 'center',
              mb: 0.5
            }}
          >
            {specimen.tube_id || specimen.id}
          </Typography>
          {labelSize !== 'small' && <Divider />}
        </Grid>

        {/* Barcode */}
        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Barcode 
            value={barcodeText}
            height={size.barcodeHeight}
            width={size.width}
            showValue={labelSize !== 'small'}
            options={{
              width: 1.5,
              margin: 2,
              fontSize: labelSize === 'small' ? 10 : 12
            }}
          />
        </Grid>

        {/* Additional Details */}
        {showDetails && labelSize !== 'small' && (
          <>
            <Grid item xs={12}>
              <Divider sx={{ my: 0.5 }} />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ fontSize: size.fontSize }}>
                <strong>Disease:</strong><br />
                {specimen.disease || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ fontSize: size.fontSize }}>
                <strong>Type:</strong><br />
                {specimen.specimen_type || 'N/A'}
              </Typography>
            </Grid>
            {labelSize === 'large' && (
              <>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ fontSize: size.fontSize }}>
                    <strong>PI:</strong><br />
                    {specimen.pi_name || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ fontSize: size.fontSize }}>
                    <strong>Date:</strong><br />
                    {specimen.date_collected ? 
                      new Date(specimen.date_collected).toLocaleDateString() : 'N/A'
                    }
                  </Typography>
                </Grid>
              </>
            )}
          </>
        )}
      </Grid>
    </Paper>
  );
};

export default PrintableLabel;