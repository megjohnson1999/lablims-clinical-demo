/**
 * Utility functions for project handling and display
 */

/**
 * Format project display name consistently across the application
 * @param {Object} project - Project object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted project display name
 */
export const formatProjectDisplay = (project, options = {}) => {
  const {
    includeNumber = true,
    includeDisease = true,
    includePI = true,
    includeInstitute = false,
    includeSpecimenType = false,
    separator = ' - ',
    compact = false
  } = options;

  const parts = [];

  // Project number with consistent formatting
  if (includeNumber && (project.project_id || project.project_number)) {
    const projectNum = project.project_id || project.project_number;
    parts.push(`Project ${projectNum}`);
  } else if (includeNumber) {
    parts.push('No Project #');
  }

  // Disease/condition
  if (includeDisease && project.disease) {
    // Filter out demo/example diseases for cleaner display
    const demoPatterns = ['Demo', 'Example', 'Test', 'Sample'];
    const isDemoDisease = demoPatterns.some(pattern => 
      project.disease.includes(pattern)
    );
    
    if (!isDemoDisease || project.disease.length < 50) {
      parts.push(project.disease);
    } else {
      parts.push('Research Project');
    }
  } else if (includeDisease && !project.disease) {
    parts.push('Unnamed Project');
  }

  // Specimen type
  if (includeSpecimenType && project.specimen_type) {
    parts.push(`(${project.specimen_type})`);
  }

  // PI name
  if (includePI && project.pi_name) {
    parts.push(project.pi_name);
  }

  // Institute
  if (includeInstitute && project.pi_institute) {
    parts.push(project.pi_institute);
  }

  return parts.join(separator);
};

/**
 * Sort projects in a consistent order
 * @param {Array} projects - Array of project objects
 * @param {Object} options - Sorting options
 * @returns {Array} Sorted projects array
 */
export const sortProjects = (projects, options = {}) => {
  const {
    sortBy = 'number_then_disease',
    direction = 'asc',
    prioritizeRecent = false
  } = options;

  return [...projects].sort((a, b) => {
    // First, handle recent projects if prioritized
    if (prioritizeRecent) {
      const aRecent = isRecentProject(a);
      const bRecent = isRecentProject(b);
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;
    }

    let comparison = 0;

    switch (sortBy) {
      case 'number_then_disease':
        comparison = sortByNumberThenDisease(a, b);
        break;
      case 'disease_then_number':
        comparison = sortByDiseaseThenNumber(a, b);
        break;
      case 'pi_name':
        comparison = sortByPIName(a, b);
        break;
      case 'date_created':
        comparison = sortByDateCreated(a, b);
        break;
      case 'date_received':
        comparison = sortByDateReceived(a, b);
        break;
      default:
        comparison = sortByNumberThenDisease(a, b);
    }

    return direction === 'desc' ? -comparison : comparison;
  });
};

/**
 * Check if a project is considered recent (created/updated within last 30 days)
 */
const isRecentProject = (project) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const createdDate = new Date(project.created_at);
  const updatedDate = new Date(project.updated_at);
  
  return createdDate > thirtyDaysAgo || updatedDate > thirtyDaysAgo;
};

/**
 * Sort by project number first, then by disease
 */
const sortByNumberThenDisease = (a, b) => {
  // Projects with numbers come first - handle both numeric and string values
  const aHasNumber = a.project_number !== null && a.project_number !== undefined && String(a.project_number).trim() !== '';
  const bHasNumber = b.project_number !== null && b.project_number !== undefined && String(b.project_number).trim() !== '';
  
  if (aHasNumber && !bHasNumber) return -1;
  if (!aHasNumber && bHasNumber) return 1;
  
  // If both have numbers, sort by project number
  if (aHasNumber && bHasNumber) {
    const aNum = extractNumber(a.project_number);
    const bNum = extractNumber(b.project_number);
    
    if (aNum !== null && bNum !== null) {
      return aNum - bNum;
    }
    
    // Fallback to string comparison
    return String(a.project_number).localeCompare(String(b.project_number));
  }
  
  // If neither has numbers, sort by disease name
  const aDisease = a.disease || 'Unnamed Project';
  const bDisease = b.disease || 'Unnamed Project';
  return aDisease.localeCompare(bDisease);
};

/**
 * Sort by disease first, then by project number
 */
const sortByDiseaseThenNumber = (a, b) => {
  const aDisease = a.disease || 'Unnamed Project';
  const bDisease = b.disease || 'Unnamed Project';
  
  const diseaseComparison = aDisease.localeCompare(bDisease);
  if (diseaseComparison !== 0) return diseaseComparison;
  
  // If diseases are the same, sort by project number
  const aNum = extractNumber(a.project_number);
  const bNum = extractNumber(b.project_number);
  
  if (aNum !== null && bNum !== null) {
    return aNum - bNum;
  }
  
  return String(a.project_number || '').localeCompare(String(b.project_number || ''));
};

/**
 * Sort by PI name
 */
const sortByPIName = (a, b) => {
  const aPI = a.pi_name || '';
  const bPI = b.pi_name || '';
  return aPI.localeCompare(bPI);
};

/**
 * Sort by date created
 */
const sortByDateCreated = (a, b) => {
  const aDate = new Date(a.created_at);
  const bDate = new Date(b.created_at);
  return bDate - aDate; // Most recent first
};

/**
 * Sort by date received
 */
const sortByDateReceived = (a, b) => {
  const aDate = new Date(a.date_received);
  const bDate = new Date(b.date_received);
  return bDate - aDate; // Most recent first
};

/**
 * Extract numeric value from project number (handles both numeric and string values)
 */
const extractNumber = (projectNumber) => {
  if (projectNumber === null || projectNumber === undefined) return null;
  
  // If it's already a number, return it
  if (typeof projectNumber === 'number') {
    return projectNumber;
  }
  
  // If it's a string, extract the first number
  const match = String(projectNumber).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
};

/**
 * Filter projects based on search term
 */
export const filterProjects = (projects, searchTerm) => {
  if (!searchTerm) return projects;
  
  const term = searchTerm.toLowerCase();
  
  return projects.filter(project => {
    return (
      project.disease?.toLowerCase().includes(term) ||
      project.pi_name?.toLowerCase().includes(term) ||
      project.pi_institute?.toLowerCase().includes(term) ||
      String(project.project_number || '').toLowerCase().includes(term) ||
      project.project_id?.toString().includes(term) ||
      project.specimen_type?.toLowerCase().includes(term) ||
      project.source?.toLowerCase().includes(term)
    );
  });
};

/**
 * Get project status based on various criteria
 */
export const getProjectStatus = (project) => {
  const now = new Date();
  const createdDate = new Date(project.created_at);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  if (createdDate > thirtyDaysAgo) {
    return 'new';
  }
  
  // Could add more status logic here based on other criteria
  return 'active';
};

/**
 * Validate project data for display
 */
export const validateProjectForDisplay = (project) => {
  const issues = [];
  
  if (!project.disease || project.disease.trim() === '') {
    issues.push('Missing disease/condition');
  }
  
  if (!project.pi_name || project.pi_name.trim() === '') {
    issues.push('Missing PI name');
  }
  
  if (!project.pi_institute || project.pi_institute.trim() === '') {
    issues.push('Missing PI institute');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
};