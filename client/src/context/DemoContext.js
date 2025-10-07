import React, { createContext, useContext, useState } from 'react';

const DemoContext = createContext();

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
};

export const DemoProvider = ({ children }) => {
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalAction, setContactModalAction] = useState('');

  // Check if we're in demo mode
  const isDemoMode = process.env.REACT_APP_DEMO_MODE === 'true';

  console.log('🔍 DemoContext - REACT_APP_DEMO_MODE:', process.env.REACT_APP_DEMO_MODE);
  console.log('🔍 DemoContext - isDemoMode:', isDemoMode);

  // Show contact modal when user tries to perform restricted action
  const showContactModal = (action) => {
    setContactModalAction(action);
    setContactModalOpen(true);
  };

  const closeContactModal = () => {
    setContactModalOpen(false);
    setContactModalAction('');
  };

  // Intercept actions in demo mode
  const handleDemoAction = (action, callback) => {
    if (isDemoMode) {
      showContactModal(action);
      return false; // Prevent action
    } else {
      callback();
      return true; // Allow action
    }
  };

  const value = {
    isDemoMode,
    contactModalOpen,
    contactModalAction,
    showContactModal,
    closeContactModal,
    handleDemoAction
  };

  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
};
