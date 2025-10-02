import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { generateBarcode, isValidBarcodeText } from '../../utils/barcode';

const Barcode = ({ 
  value, 
  options = {}, 
  showValue = true, 
  width = 200, 
  height = 100,
  style = {},
  ...props 
}) => {
  const canvasRef = useRef();

  useEffect(() => {
    if (canvasRef.current && value && isValidBarcodeText(value)) {
      const canvas = canvasRef.current;
      
      const barcodeOptions = {
        width: 2,
        height: height * 0.6, // Leave space for text if needed
        displayValue: showValue,
        fontSize: 12,
        margin: 5,
        background: '#ffffff',
        lineColor: '#000000',
        ...options
      };

      generateBarcode(value, canvas, barcodeOptions);
    }
  }, [value, options, showValue, height]);

  if (!value || !isValidBarcodeText(value)) {
    return (
      <Box 
        sx={{ 
          width, 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          border: '1px dashed #ccc',
          backgroundColor: '#f5f5f5',
          ...style 
        }}
        {...props}
      >
        <Typography variant="caption" color="text.secondary">
          {value ? 'Invalid barcode text' : 'No barcode data'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        width: 'fit-content',
        ...style 
      }}
      {...props}
    >
      <canvas 
        ref={canvasRef}
        style={{ 
          maxWidth: width,
          height: 'auto'
        }}
      />
      {showValue && !options.displayValue && (
        <Typography 
          variant="caption" 
          sx={{ 
            mt: 0.5, 
            fontFamily: 'monospace',
            fontSize: '0.75rem'
          }}
        >
          {value}
        </Typography>
      )}
    </Box>
  );
};

export default Barcode;