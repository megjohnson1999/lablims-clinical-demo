import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout Components
import Layout from './components/layout/Layout';

// Auth Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ForcedPasswordChangeDialog from './components/auth/ForcedPasswordChangeDialog';

// Dashboard
import Dashboard from './components/dashboard/Dashboard';

// Collaborator Components
import CollaboratorList from './components/collaborators/CollaboratorList';
import CollaboratorDetail from './components/collaborators/CollaboratorDetail';
import CollaboratorForm from './components/collaborators/CollaboratorForm';

// Project Components
import ProjectList from './components/projects/ProjectList';
import ProjectDetail from './components/projects/ProjectDetail';
import ProjectForm from './components/projects/ProjectForm';

// Patient Components
import PatientList from './components/patients/PatientList';
import PatientDetail from './components/patients/PatientDetail';
import PatientForm from './components/patients/PatientForm';
import PatientBulkImport from './components/patients/PatientBulkImport';

// Specimen Components
import SpecimenList from './components/specimens/SpecimenList';
import SpecimenDetail from './components/specimens/SpecimenDetail';
import SpecimenForm from './components/specimens/SpecimenForm';
import BulkImport from './components/specimens/BulkImport';

// Inventory Components
import InventoryList from './components/inventory/InventoryList';
import InventoryForm from './components/inventory/InventoryForm';

// Protocol Components
import ProtocolList from './components/protocols/ProtocolList';
import ProtocolDetail from './components/protocols/ProtocolDetail';
import ProtocolForm from './components/protocols/ProtocolForm';
import DocumentLibrary from './components/protocols/DocumentLibrary';

// Experiment Components
import ExperimentList from './components/experiments/ExperimentList';
import ExperimentForm from './components/experiments/ExperimentForm';
import ExperimentView from './components/experiments/ExperimentView';

// Import Components
import ComprehensiveImport from './components/import/ComprehensiveImport';
import MigrationImport from './components/import/MigrationImport';

// Label Components
import LabelGenerator from './components/labels/LabelGenerator';

// Metadata Components
import MetadataList from './components/metadata/MetadataList';
import ProjectMetadataView from './components/metadata/ProjectMetadataView';
import MetadataSearch from './components/metadata/MetadataSearch';

// Settings
import UserSettings from './components/settings/UserSettings';

// Admin Components
import UserManagement from './components/admin/UserManagement';

// Sequencing Components
import SequencingImport from './components/sequencing/SequencingImport';
import SequencingDashboard from './components/sequencing/SequencingDashboard';
import SequencingRunDetail from './components/sequencing/SequencingRunDetail';

// Analytics Components
import Analytics from './components/Analytics/Analytics';

// Context
import { useAuth } from './context/AuthContext';
import { LoadingProvider } from './context/LoadingContext';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0077b6',
    },
    secondary: {
      main: '#48cae4',
    },
    background: {
      default: '#f8f9fa',
    },
  },
  typography: {
    fontFamily: [
      'Roboto',
      'Arial',
      'sans-serif',
    ].join(','),
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

function App() {
  const { 
    isAuthenticated, 
    loading, 
    currentUser, 
    showPasswordChangeDialog, 
    handlePasswordChanged 
  } = useAuth();

  // Debug: Rendering App component

  if (loading) {
    // Debug: App loading
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '20px',
        backgroundColor: '#f5f5f5'
      }}>
        <h2>Loading Pathogen Discovery Database...</h2>
        <div style={{ 
          border: '4px solid #0077b6', 
          borderRadius: '50%', 
          borderTopColor: 'transparent',
          width: '40px', 
          height: '40px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Debug: App loaded
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LoadingProvider>
        <ToastContainer position="top-right" autoClose={5000} />
        <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          
          {/* Collaborator Routes */}
          <Route path="collaborators">
            <Route index element={<CollaboratorList />} />
            <Route path=":id" element={<CollaboratorDetail />} />
            <Route path="new" element={<CollaboratorForm />} />
            <Route path="edit/:id" element={<CollaboratorForm />} />
          </Route>
          
          {/* Project Routes */}
          <Route path="projects">
            <Route index element={<ProjectList />} />
            <Route path=":id" element={<ProjectDetail />} />
            <Route path="new" element={<ProjectForm />} />
            <Route path="edit/:id" element={<ProjectForm />} />
          </Route>
          
          {/* Patient Routes */}
          <Route path="patients">
            <Route index element={<PatientList />} />
            <Route path=":id" element={<PatientDetail />} />
            <Route path="new" element={<PatientForm />} />
            <Route path="edit/:id" element={<PatientForm />} />
            <Route path="import" element={<PatientBulkImport />} />
          </Route>
          
          {/* Specimen Routes */}
          <Route path="specimens">
            <Route index element={<SpecimenList />} />
            <Route path="new" element={<SpecimenForm />} />
            <Route path="import" element={<BulkImport />} />
            <Route path="comprehensive-import" element={<ComprehensiveImport />} />
            <Route path="migration-import" element={<MigrationImport />} />
            <Route path="edit/:id" element={<SpecimenForm />} />
            <Route path=":id" element={<SpecimenDetail />} />
          </Route>
          
          {/* Metadata Routes */}
          <Route path="metadata">
            <Route index element={<MetadataList />} />
            <Route path="search" element={<MetadataSearch />} />
            <Route path=":projectId" element={<ProjectMetadataView />} />
          </Route>
          
          {/* Inventory Routes */}
          <Route path="inventory">
            <Route index element={<InventoryList />} />
            <Route path="new" element={<InventoryForm />} />
            <Route path="edit/:id" element={<InventoryForm />} />
          </Route>
          
          {/* Protocol Routes */}
          <Route path="protocols">
            <Route index element={<ProtocolList />} />
            <Route path=":id" element={<ProtocolDetail />} />
            <Route path="new" element={<ProtocolForm />} />
            <Route path=":id/edit" element={<ProtocolForm />} />
          </Route>
          
          {/* Document Routes */}
          <Route path="documents">
            <Route index element={<DocumentLibrary />} />
          </Route>
          
          {/* Experiment Routes */}
          <Route path="experiments">
            <Route index element={<ExperimentList />} />
            <Route path="new" element={<ExperimentForm />} />
            <Route path=":id" element={<ExperimentView />} />
            <Route path=":id/edit" element={<ExperimentForm />} />
          </Route>
          
          {/* Label Routes */}
          <Route path="labels" element={<LabelGenerator />} />

          {/* Sequencing Routes */}
          <Route path="sequencing">
            <Route index element={<SequencingDashboard />} />
            <Route path="import" element={<SequencingImport />} />
            <Route path="runs/:id" element={<SequencingRunDetail />} />
          </Route>

          {/* Analytics Routes */}
          <Route path="analytics" element={<Analytics />} />

          {/* Settings Routes */}
          <Route path="settings" element={<UserSettings />} />
          
          {/* Admin Routes */}
          <Route path="admin">
            <Route path="users" element={<UserManagement />} />
          </Route>
        </Route>
        </Routes>
        
        {/* Forced Password Change Dialog */}
        <ForcedPasswordChangeDialog 
          open={showPasswordChangeDialog}
          onSuccess={(message) => {
            handlePasswordChanged();
            console.log(message);
          }}
          onError={(error) => {
            console.error('Password change failed:', error);
          }}
        />
      </LoadingProvider>
    </ThemeProvider>
  );
}

export default App;