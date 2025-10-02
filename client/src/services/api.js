import axios from 'axios';

// Set default base URL
axios.defaults.baseURL = process.env.REACT_APP_API_URL || '';

// Initialize token from localStorage on import
const storedToken = localStorage.getItem('token');
if (storedToken) {
  axios.defaults.headers.common['x-auth-token'] = storedToken;
}

// Add token to requests if available
const setAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common['x-auth-token'] = token;
  } else {
    delete axios.defaults.headers.common['x-auth-token'];
  }
};

// Response interceptor to handle authentication errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear stored token and redirect
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['x-auth-token'];
      
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Collaborators API
const collaboratorAPI = {
  getAll: (params = '') => axios.get(`/api/collaborators${params}`),
  getById: (id) => axios.get(`/api/collaborators/${id}`),
  create: (collaboratorData) => axios.post('/api/collaborators', collaboratorData),
  update: (id, collaboratorData) => axios.put(`/api/collaborators/${id}`, collaboratorData),
  delete: (id) => axios.delete(`/api/collaborators/${id}`),
  getProjects: (id) => axios.get(`/api/collaborators/${id}/projects`),
  bulkImport: (data) => axios.post('/api/collaborators/bulk-import', data),
};

// Projects API
const projectAPI = {
  getAll: (params = '') => axios.get(`/api/projects${params}`),
  getWithMetadata: () => axios.get('/api/projects/with-metadata'),
  getById: (id) => axios.get(`/api/projects/${id}`),
  create: (projectData) => axios.post('/api/projects', projectData),
  update: (id, projectData) => axios.put(`/api/projects/${id}`, projectData),
  delete: (id) => axios.delete(`/api/projects/${id}`),
  getSpecimens: (id) => axios.get(`/api/projects/${id}/specimens`),
  bulkImport: (data) => axios.post('/api/projects/bulk-import', data),
};

// Patients API
const patientAPI = {
  getAll: (queryString = '') => axios.get(`/api/patients${queryString}`),
  search: (term) => axios.get(`/api/patients/search?term=${term}`),
  getById: (id) => axios.get(`/api/patients/${id}`),
  create: (patientData) => axios.post('/api/patients', patientData),
  update: (id, patientData) => axios.put(`/api/patients/${id}`, patientData),
  delete: (id) => axios.delete(`/api/patients/${id}`),
  getSpecimens: (id) => axios.get(`/api/patients/${id}/specimens`),
  bulkImport: (data) => axios.post('/api/patients/bulk-import', data),
};

// Specimens API
const specimenAPI = {
  getAll: (params) => {
    if (typeof params === 'string') {
      return axios.get(`/api/specimens${params}`);
    }
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    return axios.get(`/api/specimens?page=${page}&limit=${limit}`);
  },
  search: (term, field) => {
    let url = `/api/specimens/search?term=${term}`;
    if (field) url += `&field=${field}`;
    return axios.get(url);
  },
  bulkSearch: (data) => axios.post('/api/specimens/bulk-search', data),
  getById: (id) => axios.get(`/api/specimens/${id}`),
  create: (specimenData) => axios.post('/api/specimens', specimenData),
  update: (id, specimenData) => axios.put(`/api/specimens/${id}`, specimenData),
  delete: (id) => axios.delete(`/api/specimens/${id}`),
  bulkImport: (data) => axios.post('/api/specimens/bulk-import', data),
  // Metadata operations
  getMetadataFields: (projectId) => axios.get(`/api/specimens/metadata-fields/${projectId}`),
  getMetadataSummary: (projectId) => axios.get(`/api/specimens/metadata-summary/${projectId}`),
  getMetadataAnalytics: (projectId) => axios.get(`/api/specimens/metadata-analytics/${projectId}`),
  getMetadataSuggestions: (projectId) => axios.get(`/api/specimens/metadata-suggestions?project_id=${projectId}`),
  searchByMetadata: (criteria) => axios.post('/api/specimens/metadata-search', criteria),
  updateMetadata: (id, metadata) => axios.put(`/api/specimens/${id}/metadata`, { metadata }),
  bulkUpdateMetadata: (data) => axios.post('/api/specimens/bulk-metadata-update', data),
};

// Labels API
const labelAPI = {
  generateLabels: (specimen_ids) => axios.post('/api/labels/generate', { specimen_ids }),
  generateProjectLabels: (project_id) => axios.post(`/api/labels/project/${project_id}`),
  downloadLabel: (filename) => axios.get(`/api/labels/download/${filename}`),
  generatePDF: (specimen_ids) => axios.post('/api/labels/generate-pdf', { specimen_ids }),
  downloadPDF: (filename) => axios.get(`/api/labels/download-pdf/${filename}`, { responseType: 'blob' }),
};

// Auth API
const authAPI = {
  login: (credentials) => axios.post('/api/auth/login', credentials),
  register: (userData) => axios.post('/api/auth/register', userData),
  getUser: () => axios.get('/api/auth/user'),
};

// Audit API
const auditAPI = {
  getRecent: () => axios.get('/api/audit'),
  getByUser: (userId) => axios.get(`/api/audit/user/${userId}`),
  getByRecord: (table, recordId) => axios.get(`/api/audit/${table}/${recordId}`),
};

// Export API
const exportAPI = {
  exportSpecimensCSV: (filters) => {
    const params = new URLSearchParams();
    
    // Add filters to query params
    if (filters.searchTerm) params.append('searchTerm', filters.searchTerm);
    if (filters.searchField) params.append('searchField', filters.searchField);
    if (filters.dateStart) params.append('dateStart', filters.dateStart);
    if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);
    if (filters.collaboratorId) params.append('collaboratorId', filters.collaboratorId);
    if (filters.projectId) params.append('projectId', filters.projectId);
    if (filters.disease) params.append('disease', filters.disease);
    if (filters.specimenType) params.append('specimenType', filters.specimenType);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.selectedColumns) params.append('selectedColumns', filters.selectedColumns);
    if (filters.selectedSpecimens) params.append('selectedSpecimens', filters.selectedSpecimens);
    if (filters.bulkIdText) params.append('bulkIdText', filters.bulkIdText);
    
    return axios.get(`/api/export/specimens/csv?${params.toString()}`, {
      responseType: 'blob'
    });
  },
  exportSpecimensExcel: (filters) => {
    const params = new URLSearchParams();
    
    // Add filters to query params
    if (filters.searchTerm) params.append('searchTerm', filters.searchTerm);
    if (filters.searchField) params.append('searchField', filters.searchField);
    if (filters.dateStart) params.append('dateStart', filters.dateStart);
    if (filters.dateEnd) params.append('dateEnd', filters.dateEnd);
    if (filters.collaboratorId) params.append('collaboratorId', filters.collaboratorId);
    if (filters.projectId) params.append('projectId', filters.projectId);
    if (filters.disease) params.append('disease', filters.disease);
    if (filters.specimenType) params.append('specimenType', filters.specimenType);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.selectedColumns) params.append('selectedColumns', filters.selectedColumns);
    if (filters.selectedSpecimens) params.append('selectedSpecimens', filters.selectedSpecimens);
    if (filters.bulkIdText) params.append('bulkIdText', filters.bulkIdText);
    
    return axios.get(`/api/export/specimens/excel?${params.toString()}`, {
      responseType: 'blob'
    });
  },
};

// Metadata API
const metadataAPI = {
  uploadPreview: (csvData, specimenIdColumn, matchingStrategy = 'tube_id') => 
    axios.post('/api/metadata/upload-preview', { csvData, specimenIdColumn, matchingStrategy }),
  uploadApply: (csvData, specimenIdColumn, matchingStrategy = 'tube_id') => 
    axios.post('/api/metadata/upload-apply', { csvData, specimenIdColumn, matchingStrategy }),
  getTubeIds: (search = '', limit = 100) => 
    axios.get(`/api/metadata/tube-ids?search=${search}&limit=${limit}`),
  getSummary: () => axios.get('/api/metadata/summary'),
};

// Inventory API
const inventoryAPI = {
  getAll: (params = '') => axios.get(`/api/inventory${params}`),
  getById: (id) => axios.get(`/api/inventory/${id}`),
  create: (inventoryData) => axios.post('/api/inventory', inventoryData),
  update: (id, inventoryData) => axios.put(`/api/inventory/${id}`, inventoryData),
  delete: (id) => axios.delete(`/api/inventory/${id}`),
  updateQuantity: (id, quantityData) => axios.put(`/api/inventory/${id}/quantity`, quantityData),
  getCategories: () => axios.get('/api/inventory/categories'),
  getLowStock: () => axios.get('/api/inventory/low-stock'),
  getExpiring: (days = 30) => axios.get(`/api/inventory/expiring?days=${days}`),
  getTransactions: (id) => axios.get(`/api/inventory/${id}/transactions`),
  search: (query) => axios.get(`/api/inventory/search?q=${query}`),
  // Import/Export functionality
  exportCSV: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return axios.get(`/api/export/inventory/csv?${queryString}`, {
      responseType: 'blob'
    });
  },
  exportExcel: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return axios.get(`/api/export/inventory/excel?${queryString}`, {
      responseType: 'blob'
    });
  },
  import: (formData) => {
    return axios.post('/api/import/inventory', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  checkAvailability: (reagents) => axios.post('/api/inventory/check-availability', { reagents }),
  // Barcode lookup functionality
  lookupBarcode: (barcode) => axios.post('/api/inventory/lookup-barcode', { barcode }),
  getBarcodeStats: () => axios.get('/api/inventory/barcode-stats'),
  addProductToDatabase: (productData) => axios.post('/api/inventory/add-product-to-db', productData)
};

// IDs API
const idsAPI = {
  getNextCollaborator: () => axios.get('/api/ids/next-collaborator'),
  getNextProject: () => axios.get('/api/ids/next-project'),
  getNextSpecimen: () => axios.get('/api/ids/next-specimen'),
  getNextInventory: () => axios.get('/api/ids/next-inventory'),
  peekNext: (entityType) => axios.get(`/api/ids/peek/${entityType}`),
  checkAvailability: (entityType, id) => axios.post('/api/ids/check-availability', { entityType, id }),
  getHistory: (entityType, limit = 100) => axios.get(`/api/ids/history/${entityType}?limit=${limit}`),
};

// Protocols API
const protocolAPI = {
  getAll: (params = '') => axios.get(`/api/protocols${params}`),
  getById: (id) => axios.get(`/api/protocols/${id}`),
  create: (protocolData) => axios.post('/api/protocols', protocolData),
  update: (id, protocolData) => axios.put(`/api/protocols/${id}`, protocolData),
  delete: (id) => axios.delete(`/api/protocols/${id}`),
  search: (term) => axios.get(`/api/protocols/search?term=${term}`),
  getUsageStats: () => axios.get('/api/protocols/usage-stats'),
  duplicate: (id, data) => axios.post(`/api/protocols/${id}/duplicate`, data),
  calculateReagents: (id, sampleCount) => axios.post(`/api/protocols/${id}/calculate-reagents`, { sample_count: sampleCount })
};

// Experiments API
const experimentsAPI = {
  getAll: (params = '') => axios.get(`/api/experiments${params}`),
  getById: (id) => axios.get(`/api/experiments/${id}`),
  create: (experimentData) => axios.post('/api/experiments', experimentData),
  update: (id, experimentData) => axios.put(`/api/experiments/${id}`, experimentData),
  delete: (id) => axios.delete(`/api/experiments/${id}`),
  search: (term) => axios.get(`/api/experiments/search?term=${term}`)
};

export {
  setAuthToken,
  collaboratorAPI,
  projectAPI,
  patientAPI,
  specimenAPI,
  labelAPI,
  authAPI,
  auditAPI,
  exportAPI,
  metadataAPI,
  inventoryAPI,
  protocolAPI,
  experimentsAPI,
  idsAPI,
};
