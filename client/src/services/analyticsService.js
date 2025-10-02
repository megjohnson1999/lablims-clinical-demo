import axios from 'axios';

const analyticsService = {
  getOverview: async () => {
    const response = await axios.get('/api/analytics/overview');
    return response.data;
  },

  getSpecimensBySite: async () => {
    const response = await axios.get('/api/analytics/specimens-by-site');
    return response.data;
  },

  getSpecimensByDisease: async () => {
    const response = await axios.get('/api/analytics/specimens-by-disease');
    return response.data;
  },

  getSpecimensByInstitution: async () => {
    const response = await axios.get('/api/analytics/specimens-by-institution');
    return response.data;
  },

  getSpecimensByStatus: async () => {
    const response = await axios.get('/api/analytics/specimens-by-status');
    return response.data;
  },

  getSpecimensTimeline: async () => {
    const response = await axios.get('/api/analytics/specimens-timeline');
    return response.data;
  },

  getStorageDistribution: async () => {
    const response = await axios.get('/api/analytics/storage-distribution');
    return response.data;
  },

  getProjectVolumes: async () => {
    const response = await axios.get('/api/analytics/project-volumes');
    return response.data;
  },

  getExtractionStatus: async () => {
    const response = await axios.get('/api/analytics/extraction-status');
    return response.data;
  },

  getAvailabilityStatus: async () => {
    const response = await axios.get('/api/analytics/availability-status');
    return response.data;
  }
};

export default analyticsService;
