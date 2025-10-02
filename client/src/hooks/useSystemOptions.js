import { useState, useEffect } from 'react';
import axios from 'axios';

const useSystemOptions = (category = null) => {
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const url = category 
          ? `/api/system-options/${category}`
          : '/api/system-options';
        
        const response = await axios.get(url);
        
        if (category) {
          // Single category response
          setOptions({ [category]: response.data.options });
        } else {
          // All categories response
          setOptions(response.data.options);
        }
      } catch (err) {
        console.error('Error fetching system options:', err);
        setError(err.response?.data?.msg || 'Failed to fetch system options');
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [category]);

  const getOptions = (categoryName) => {
    return options[categoryName] || [];
  };

  const getOptionValue = (categoryName, optionKey) => {
    const categoryOptions = options[categoryName] || [];
    const option = categoryOptions.find(opt => opt.key === optionKey);
    return option ? option.value : optionKey;
  };

  const refreshOptions = async (categoryName = null) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = categoryName 
        ? `/api/system-options/${categoryName}`
        : '/api/system-options';
      
      const response = await axios.get(url);
      
      if (categoryName) {
        setOptions(prev => ({ ...prev, [categoryName]: response.data.options }));
      } else {
        setOptions(response.data.options);
      }
    } catch (err) {
      console.error('Error refreshing system options:', err);
      setError(err.response?.data?.msg || 'Failed to refresh system options');
    } finally {
      setLoading(false);
    }
  };

  return {
    options,
    loading,
    error,
    getOptions,
    getOptionValue,
    refreshOptions
  };
};

export default useSystemOptions;