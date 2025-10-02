// Application Configuration Constants

module.exports = {
  // File Upload Limits
  FILE_UPLOAD: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB for migration imports
    ALLOWED_TYPES: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    TIMEOUT: 60000 // 60 seconds for larger files
  },

  // Database Configuration
  DATABASE: {
    CLIENT_TIMEOUT_WARNING: 30000, // 30 seconds
    QUERY_TIMEOUT: 60000, // 60 seconds
    MAX_CONNECTIONS: 20
  },

  // Validation Constants
  VALIDATION: {
    USERNAME: { MIN: 3, MAX: 50 },
    PASSWORD: { MIN: 6, MAX: 50 },
    EMAIL: { MAX: 255 },
    NAME: { MIN: 1, MAX: 255 },
    PHONE: { MAX: 50 },
    COMMENTS: { MAX: 1000 },
    IRB_ID: { MAX: 50 }
  },

  // Pagination
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100
  },

  // JWT Configuration
  JWT: {
    EXPIRES_IN: '24h' // 24 hours for development
  },

  // Export/Import Configuration
  EXPORT: {
    MAX_RECORDS: 10000,
    TIMEOUT: 300000 // 5 minutes
  }
};