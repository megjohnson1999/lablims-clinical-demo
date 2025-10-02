import React from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import useSystemOptions from '../../hooks/useSystemOptions';

const SystemOptionAutocomplete = ({
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
  ...otherProps
}) => {
  const { options, loading, error: optionsError, getOptions } = useSystemOptions(category);

  const categoryOptions = getOptions(category);

  // Extract just the display values for the autocomplete
  const optionValues = categoryOptions.map(opt => opt.value);

  const handleAutocompleteChange = (event, newValue) => {
    // Create a synthetic event that matches TextField onChange signature
    const syntheticEvent = {
      target: {
        name: name,
        value: newValue || ''
      }
    };
    onChange(syntheticEvent);
  };

  if (loading) {
    return (
      <TextField
        name={name}
        label={label}
        value={value || ''}
        variant={variant}
        fullWidth={fullWidth}
        size={size}
        disabled={true}
        helperText="Loading options..."
        InputProps={{
          endAdornment: <CircularProgress size={20} />
        }}
        {...otherProps}
      />
    );
  }

  if (optionsError) {
    return (
      <TextField
        name={name}
        label={label}
        value={value || ''}
        onChange={onChange}
        variant={variant}
        fullWidth={fullWidth}
        size={size}
        error={true}
        helperText={`Error loading options: ${optionsError}`}
        {...otherProps}
      />
    );
  }

  return (
    <Autocomplete
      freeSolo
      value={value || ''}
      onChange={handleAutocompleteChange}
      onInputChange={handleAutocompleteChange}
      options={optionValues}
      disabled={disabled}
      renderInput={(params) => (
        <TextField
          {...params}
          name={name}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          variant={variant}
          size={size}
        />
      )}
      fullWidth={fullWidth}
      {...otherProps}
    />
  );
};

export default SystemOptionAutocomplete;
