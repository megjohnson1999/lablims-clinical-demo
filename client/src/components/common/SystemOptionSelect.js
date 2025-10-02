import React from 'react';
import { TextField, MenuItem, CircularProgress } from '@mui/material';
import useSystemOptions from '../../hooks/useSystemOptions';

const SystemOptionSelect = ({
  category,
  value,
  onChange,
  name,
  label,
  required = false,
  disabled = false,
  helperText = '',
  error = false,
  variant = 'outlined',
  fullWidth = true,
  size = 'medium',
  showEmptyOption = true,
  emptyOptionText = 'Select an option',
  ...otherProps
}) => {
  const { options, loading, error: optionsError, getOptions } = useSystemOptions(category);

  const categoryOptions = getOptions(category);

  if (loading) {
    return (
      <TextField
        select
        name={name}
        label={label}
        value=""
        variant={variant}
        fullWidth={fullWidth}
        size={size}
        disabled={true}
        helperText="Loading options..."
        {...otherProps}
      >
        <MenuItem value="">
          <CircularProgress size={16} sx={{ mr: 1 }} />
          Loading...
        </MenuItem>
      </TextField>
    );
  }

  if (optionsError) {
    return (
      <TextField
        select
        name={name}
        label={label}
        value=""
        variant={variant}
        fullWidth={fullWidth}
        size={size}
        disabled={true}
        error={true}
        helperText={`Error loading options: ${optionsError}`}
        {...otherProps}
      >
        <MenuItem value="">Error loading options</MenuItem>
      </TextField>
    );
  }

  return (
    <TextField
      select
      name={name}
      label={label}
      value={value || ''}
      onChange={onChange}
      variant={variant}
      fullWidth={fullWidth}
      size={size}
      required={required}
      disabled={disabled}
      error={error}
      helperText={helperText}
      {...otherProps}
    >
      {showEmptyOption && (
        <MenuItem value="">
          <em>{emptyOptionText}</em>
        </MenuItem>
      )}
      {categoryOptions.map((option) => (
        <MenuItem key={option.key} value={option.key}>
          {option.value}
        </MenuItem>
      ))}
    </TextField>
  );
};

export default SystemOptionSelect;