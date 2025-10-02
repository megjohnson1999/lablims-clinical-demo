import React from 'react';
import BulkImport from '../common/BulkImport';
import { patientAPI } from '../../services/api';

const PatientBulkImport = () => {
  return (
    <BulkImport
      title="Bulk Import Patients"
      apiImport={patientAPI.bulkImport}
      entityName="patients"
      returnPath="/patients"
      requiredFields={['external_id']}
      optionalFields={['first_name', 'last_name', 'date_of_birth', 'diagnosis', 'physician_first_name', 'physician_last_name', 'comments']}
    />
  );
};

export default PatientBulkImport;