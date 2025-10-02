// Export column configuration for specimen exports
// This file defines all available columns for export with their database mappings and groupings

const EXPORT_COLUMNS = {
  // Auto-Generated ID Group (High Priority)
  specimen_number: {
    label: 'WUID',
    group: 'id',
    dbField: 's.specimen_number',
    csvKey: 'specimen_number',
    excelKey: 'specimen_number',
    width: 15,
    priority: 'high',
    description: 'Auto-generated unique WUID (specimen identifier)'
  },
  collaborator_number: {
    label: 'Collaborator #',
    group: 'id',
    dbField: 'c.collaborator_number',
    csvKey: 'collaborator_number',
    excelKey: 'collaborator_number',
    width: 15,
    priority: 'high',
    description: 'Auto-generated collaborator identifier'
  },
  project_number: {
    label: 'Project #',
    group: 'id',
    dbField: 'p.project_id',
    csvKey: 'project_number',
    excelKey: 'project_number',
    width: 15,
    priority: 'high',
    description: 'Auto-generated project identifier'
  },
  
  // Sample Info Group
  specimen_id: {
    label: 'Specimen ID',
    group: 'sample',
    dbField: 's.specimen_number',
    csvKey: 'specimen_id',
    excelKey: 'specimen_id',
    width: 20
  },
  tube_id: {
    label: 'Tube ID',
    group: 'sample',
    dbField: 's.tube_id',
    csvKey: 'tube_id',
    excelKey: 'tube_id',
    width: 15
  },
  date_collected: {
    label: 'Date Collected',
    group: 'sample',
    dbField: 's.date_collected',
    csvKey: 'date_collected',
    excelKey: 'date_collected',
    width: 15,
    type: 'date'
  },
  activity_status: {
    label: 'Activity Status',
    group: 'sample',
    dbField: 's.activity_status',
    csvKey: 'activity_status',
    excelKey: 'activity_status',
    width: 15
  },
  specimen_site: {
    label: 'Specimen Site',
    group: 'sample',
    dbField: 's.specimen_site',
    csvKey: 'specimen_site',
    excelKey: 'specimen_site',
    width: 15
  },
  extracted: {
    label: 'Extracted',
    group: 'sample',
    dbField: 's.extracted',
    csvKey: 'extracted',
    excelKey: 'extracted',
    width: 10,
    type: 'boolean'
  },
  used_up: {
    label: 'Used Up',
    group: 'sample',
    dbField: 's.used_up',
    csvKey: 'used_up',
    excelKey: 'used_up',
    width: 10,
    type: 'boolean'
  },
  initial_quantity: {
    label: 'Initial Quantity',
    group: 'sample',
    dbField: 's.initial_quantity',
    csvKey: 'initial_quantity',
    excelKey: 'initial_quantity',
    width: 15
  },
  specimen_comments: {
    label: 'Specimen Comments',
    group: 'sample',
    dbField: 's.comments',
    csvKey: 'specimen_comments',
    excelKey: 'specimen_comments',
    width: 30
  },

  // Storage Info Group
  position_freezer: {
    label: 'Freezer',
    group: 'storage',
    dbField: 's.position_freezer',
    csvKey: 'position_freezer',
    excelKey: 'position_freezer',
    width: 15
  },
  position_rack: {
    label: 'Rack',
    group: 'storage',
    dbField: 's.position_rack',
    csvKey: 'position_rack',
    excelKey: 'position_rack',
    width: 15
  },
  position_box: {
    label: 'Box',
    group: 'storage',
    dbField: 's.position_box',
    csvKey: 'position_box',
    excelKey: 'position_box',
    width: 15
  },
  position_dimension_one: {
    label: 'Position 1',
    group: 'storage',
    dbField: 's.position_dimension_one',
    csvKey: 'position_dimension_one',
    excelKey: 'position_dimension_one',
    width: 12
  },
  position_dimension_two: {
    label: 'Position 2',
    group: 'storage',
    dbField: 's.position_dimension_two',
    csvKey: 'position_dimension_two',
    excelKey: 'position_dimension_two',
    width: 12
  },
  location: {
    label: 'Location',
    group: 'storage',
    dbField: null, // Computed field
    csvKey: 'location',
    excelKey: 'location',
    width: 30,
    computed: true
  },

  // Sequencing Info Group
  sequencing_run_id: {
    label: 'Sequencing Run ID',
    group: 'sequencing',
    dbField: 's.sequencing_run_id',
    csvKey: 'sequencing_run_id',
    excelKey: 'sequencing_run_id',
    width: 20
  },
  fastq_location: {
    label: 'FASTQ Location',
    group: 'sequencing',
    dbField: 's.fastq_location',
    csvKey: 'fastq_location',
    excelKey: 'fastq_location',
    width: 40
  },
  analysis_status: {
    label: 'Analysis Status',
    group: 'sequencing',
    dbField: 's.analysis_status',
    csvKey: 'analysis_status',
    excelKey: 'analysis_status',
    width: 15
  },
  results_location: {
    label: 'Results Location',
    group: 'sequencing',
    dbField: 's.results_location',
    csvKey: 'results_location',
    excelKey: 'results_location',
    width: 40
  },
  sequencing_notes: {
    label: 'Sequencing Notes',
    group: 'sequencing',
    dbField: 's.sequencing_notes',
    csvKey: 'sequencing_notes',
    excelKey: 'sequencing_notes',
    width: 30
  },

  // Patient Info Group
  patient_external_id: {
    label: 'Patient ID',
    group: 'patient',
    dbField: 'pat.external_id',
    csvKey: 'patient_external_id',
    excelKey: 'patient_external_id',
    width: 15
  },
  patient_first_name: {
    label: 'Patient First Name',
    group: 'patient',
    dbField: 'pat.first_name',
    csvKey: 'patient_first_name',
    excelKey: 'patient_first_name',
    width: 20
  },
  patient_last_name: {
    label: 'Patient Last Name',
    group: 'patient',
    dbField: 'pat.last_name',
    csvKey: 'patient_last_name',
    excelKey: 'patient_last_name',
    width: 20
  },
  patient_name: {
    label: 'Patient Name',
    group: 'patient',
    dbField: null, // Computed field
    csvKey: 'patient_name',
    excelKey: 'patient_name',
    width: 25,
    computed: true
  },
  date_of_birth: {
    label: 'Date of Birth',
    group: 'patient',
    dbField: 'pat.date_of_birth',
    csvKey: 'date_of_birth',
    excelKey: 'date_of_birth',
    width: 15,
    type: 'date'
  },
  diagnosis: {
    label: 'Diagnosis',
    group: 'patient',
    dbField: 'pat.diagnosis',
    csvKey: 'diagnosis',
    excelKey: 'diagnosis',
    width: 25
  },

  // Project Info Group
  project_id: {
    label: 'Project ID',
    group: 'project',
    dbField: 'p.id',
    csvKey: 'project_id',
    excelKey: 'project_id',
    width: 20
  },
  disease: {
    label: 'Disease',
    group: 'project',
    dbField: 'p.disease',
    csvKey: 'disease',
    excelKey: 'disease',
    width: 20
  },
  specimen_type: {
    label: 'Specimen Type',
    group: 'project',
    dbField: 'p.specimen_type',
    csvKey: 'specimen_type',
    excelKey: 'specimen_type',
    width: 15
  },
  project_source: {
    label: 'Project Source',
    group: 'project',
    dbField: 'p.source',
    csvKey: 'project_source',
    excelKey: 'project_source',
    width: 20
  },
  date_received: {
    label: 'Date Received',
    group: 'project',
    dbField: 'p.date_received',
    csvKey: 'date_received',
    excelKey: 'date_received',
    width: 15,
    type: 'date'
  },
  feedback_date: {
    label: 'Feedback Date',
    group: 'project',
    dbField: 'p.feedback_date',
    csvKey: 'feedback_date',
    excelKey: 'feedback_date',
    width: 15,
    type: 'date'
  },
  project_comments: {
    label: 'Project Comments',
    group: 'project',
    dbField: 'p.comments',
    csvKey: 'project_comments',
    excelKey: 'project_comments',
    width: 30
  },

  // Collaborator Info Group
  collaborator_id: {
    label: 'Collaborator ID',
    group: 'collaborator',
    dbField: 'c.id',
    csvKey: 'collaborator_id',
    excelKey: 'collaborator_id',
    width: 20
  },
  pi_name: {
    label: 'PI Name',
    group: 'collaborator',
    dbField: 'c.pi_name',
    csvKey: 'pi_name',
    excelKey: 'pi_name',
    width: 25
  },
  pi_institute: {
    label: 'PI Institute',
    group: 'collaborator',
    dbField: 'c.pi_institute',
    csvKey: 'pi_institute',
    excelKey: 'pi_institute',
    width: 30
  },
  pi_email: {
    label: 'PI Email',
    group: 'collaborator',
    dbField: 'c.pi_email',
    csvKey: 'pi_email',
    excelKey: 'pi_email',
    width: 25
  },
  pi_phone: {
    label: 'PI Phone',
    group: 'collaborator',
    dbField: 'c.pi_phone',
    csvKey: 'pi_phone',
    excelKey: 'pi_phone',
    width: 15
  },
  irb_id: {
    label: 'IRB ID',
    group: 'collaborator',
    dbField: 'c.irb_id',
    csvKey: 'irb_id',
    excelKey: 'irb_id',
    width: 15
  },
  internal_contact: {
    label: 'Internal Contact',
    group: 'collaborator',
    dbField: 'c.internal_contact',
    csvKey: 'internal_contact',
    excelKey: 'internal_contact',
    width: 20
  }
};

// Group definitions for UI organization
const COLUMN_GROUPS = {
  id: {
    label: 'Auto-Generated IDs',
    description: 'System-generated unique identifiers',
    defaultSelected: true,
    priority: 'high'
  },
  sample: {
    label: 'Sample Information',
    description: 'Basic specimen data and status',
    defaultSelected: true
  },
  storage: {
    label: 'Storage & Location',
    description: 'Physical storage location details',
    defaultSelected: true
  },
  sequencing: {
    label: 'Sequencing & Analysis',
    description: 'Sequencing run and analysis information',
    defaultSelected: true
  },
  patient: {
    label: 'Patient Information',
    description: 'Patient demographics and clinical data',
    defaultSelected: false
  },
  project: {
    label: 'Project Information',
    description: 'Research project and study details',
    defaultSelected: true
  },
  collaborator: {
    label: 'Collaborator Information',
    description: 'PI and institution details',
    defaultSelected: true
  },
  metadata: {
    label: 'Metadata Fields',
    description: 'Project-specific specimen metadata',
    defaultSelected: true,
    dynamic: true
  }
};

// Utility functions
const getColumnsByGroup = (groupName) => {
  return Object.entries(EXPORT_COLUMNS)
    .filter(([key, config]) => config.group === groupName)
    .reduce((acc, [key, config]) => {
      acc[key] = config;
      return acc;
    }, {});
};

const getDefaultSelectedColumns = () => {
  return Object.entries(EXPORT_COLUMNS)
    .filter(([key, config]) => COLUMN_GROUPS[config.group].defaultSelected)
    .map(([key, config]) => key);
};

const getAllColumnKeys = () => {
  return Object.keys(EXPORT_COLUMNS);
};

const getColumnConfig = (columnKey) => {
  return EXPORT_COLUMNS[columnKey];
};

const buildSelectClause = (selectedColumns) => {
  if (!selectedColumns || selectedColumns.length === 0) {
    return getAllColumnKeys();
  }
  
  const selectFields = [];
  const selectedSet = new Set(selectedColumns);
  
  // Always include required fields for joins and computed fields
  const requiredFields = [
    's.id', 's.tube_id', 's.date_collected', 's.position_freezer', 's.position_rack',
    's.position_box', 's.position_dimension_one', 's.position_dimension_two',
    'pat.first_name', 'pat.last_name', 'pat.external_id'
  ];
  
  Object.entries(EXPORT_COLUMNS).forEach(([key, config]) => {
    if (selectedSet.has(key)) {
      if (config.dbField && !config.computed) {
        selectFields.push(`${config.dbField} as ${key}`);
      }
    }
  });
  
  // Add required fields that might not be selected but are needed for computation
  requiredFields.forEach(field => {
    if (!selectFields.find(f => f.includes(field))) {
      const alias = field.split('.')[1];
      selectFields.push(`${field} as ${alias}`);
    }
  });
  
  return selectFields;
};

const buildCsvHeaders = (selectedColumns, metadataFields = []) => {
  if (!selectedColumns || selectedColumns.length === 0) {
    selectedColumns = getAllColumnKeys();
  }
  
  const headers = selectedColumns.map(key => {
    const config = EXPORT_COLUMNS[key];
    if (config) {
      return {
        id: config.csvKey,
        title: config.label
      };
    }
    
    // Check if this is a metadata field
    const metadataField = metadataFields.find(f => f.field_name === key);
    if (metadataField) {
      return {
        id: `metadata_${metadataField.field_name}`,
        title: metadataField.field_name
      };
    }
    
    return null;
  }).filter(Boolean);
  
  return headers;
};

const buildExcelColumns = (selectedColumns, metadataFields = []) => {
  if (!selectedColumns || selectedColumns.length === 0) {
    selectedColumns = getAllColumnKeys();
  }
  
  const columns = selectedColumns.map(key => {
    const config = EXPORT_COLUMNS[key];
    if (config) {
      return {
        header: config.label,
        key: config.excelKey,
        width: config.width
      };
    }
    
    // Check if this is a metadata field
    const metadataField = metadataFields.find(f => f.field_name === key);
    if (metadataField) {
      return {
        header: metadataField.field_name,
        key: `metadata_${metadataField.field_name}`,
        width: 20
      };
    }
    
    return null;
  }).filter(Boolean);
  
  return columns;
};

// Utility functions for metadata fields
const createMetadataColumns = (metadataFields) => {
  const metadataColumns = {};
  
  metadataFields.forEach(field => {
    metadataColumns[field.field_name] = {
      label: field.field_name,
      group: 'metadata',
      dbField: null, // Metadata fields are extracted from JSON
      csvKey: `metadata_${field.field_name}`,
      excelKey: `metadata_${field.field_name}`,
      width: 20,
      metadata: true,
      usage_count: field.usage_count || 0,
      usage_frequency: field.usage_frequency || 0,
      data_type: field.data_type || 'text'
    };
  });
  
  return metadataColumns;
};

const getMetadataFieldsByProject = (projectId, metadataFields) => {
  // Filter metadata fields for a specific project if needed
  // For now, return all fields as they're already project-specific
  return metadataFields || [];
};

const combineColumnsWithMetadata = (staticColumns, metadataFields) => {
  const metadataColumns = createMetadataColumns(metadataFields);
  return { ...staticColumns, ...metadataColumns };
};

const getDefaultSelectedColumnsWithMetadata = (metadataFields = []) => {
  const staticDefaults = getDefaultSelectedColumns();
  
  // Add commonly used metadata fields (used in >70% of specimens)
  const commonMetadataFields = metadataFields
    .filter(field => field.usage_frequency > 70)
    .slice(0, 5) // Limit to top 5 to avoid overwhelming the UI
    .map(field => field.field_name);
  
  return [...staticDefaults, ...commonMetadataFields];
};

module.exports = {
  EXPORT_COLUMNS,
  COLUMN_GROUPS,
  getColumnsByGroup,
  getDefaultSelectedColumns,
  getAllColumnKeys,
  getColumnConfig,
  buildSelectClause,
  buildCsvHeaders,
  buildExcelColumns,
  createMetadataColumns,
  getMetadataFieldsByProject,
  combineColumnsWithMetadata,
  getDefaultSelectedColumnsWithMetadata
};