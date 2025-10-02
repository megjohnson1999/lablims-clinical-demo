import React from 'react';
import BulkImport from '../common/BulkImport';
import { projectAPI } from '../../services/api';

const ProjectBulkImport = () => {
  return (
    <BulkImport
      title="Bulk Import Projects"
      apiImport={projectAPI.bulkImport}
      entityName="projects"
      returnPath="/projects"
      requiredFields={['collaborator_id (or pi_name and pi_institute)']}
      optionalFields={['disease', 'specimen_type', 'source', 'date_received', 'feedback_date', 'comments']}
    />
  );
};

export default ProjectBulkImport;