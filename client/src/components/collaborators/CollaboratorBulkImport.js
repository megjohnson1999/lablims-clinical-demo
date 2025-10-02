import React from 'react';
import BulkImport from '../common/BulkImport';
import { collaboratorAPI } from '../../services/api';

const CollaboratorBulkImport = () => {
  // Custom import function to handle field mapping
  const customImport = async (data) => {
    console.log('Custom collaborator import with field mapping');
    
    // Transform the collaborators data to map field names correctly
    if (data.collaborators && Array.isArray(data.collaborators)) {
      // Map fields case-insensitively
      const mappedCollaborators = data.collaborators.map(collab => {
        // Helper to find field regardless of case
        const findField = (obj, fieldName) => {
          const key = Object.keys(obj).find(
            k => k.toLowerCase() === fieldName.toLowerCase()
          );
          return key ? obj[key] : '';
        };
        
        return {
          pi_name: findField(collab, 'pi_name') || '',
          pi_institute: findField(collab, 'pi_institute') || '',
          irb_id: findField(collab, 'irb_id') || '',
          pi_email: findField(collab, 'pi_email') || '',
          pi_phone: findField(collab, 'pi_phone') || '',
          pi_fax: findField(collab, 'pi_fax') || '',
          internal_contact: findField(collab, 'internal_contact') || '',
          comments: findField(collab, 'comments') || ''
        };
      });
      
      console.log('Mapped collaborators for import:', mappedCollaborators[0]);
      return collaboratorAPI.bulkImport({ collaborators: mappedCollaborators });
    }
    
    // If no transformation needed, pass through
    return collaboratorAPI.bulkImport(data);
  };
  
  return (
    <BulkImport
      title="Bulk Import Collaborators"
      apiImport={customImport}
      entityName="collaborators"
      returnPath="/collaborators"
      requiredFields={['pi_name', 'pi_institute']}
      optionalFields={['irb_id', 'pi_email', 'pi_phone', 'pi_fax', 'internal_contact', 'comments']}
    />
  );
};

export default CollaboratorBulkImport;