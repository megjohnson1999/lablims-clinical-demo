import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

// Global help function - will be set by the help component
let showGlobalHelp = null;

export const setGlobalHelpFunction = (helpFunction) => {
  showGlobalHelp = helpFunction;
};

const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleKeyDown = useCallback((event) => {
    // Only trigger shortcuts when not typing in input fields
    if (event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' || 
        event.target.contentEditable === 'true') {
      return;
    }

    const { ctrlKey, metaKey, shiftKey, altKey, key } = event;
    const isModifierPressed = ctrlKey || metaKey;

    // Handle different keyboard shortcuts
    if (isModifierPressed && !shiftKey && !altKey) {
      switch (key.toLowerCase()) {
        case 'n':
          event.preventDefault();
          handleNewRecord();
          break;
        case 'f':
          event.preventDefault();
          focusSearchField();
          break;
        case 'h':
          event.preventDefault();
          navigate('/');
          toast.info('Navigated to Dashboard');
          break;
        case 's':
          event.preventDefault();
          handleSave();
          break;
        default:
          break;
      }
    }

    // Handle shortcuts with modifiers
    if (isModifierPressed && shiftKey && !altKey) {
      switch (key.toLowerCase()) {
        case 'c':
          event.preventDefault();
          navigate('/collaborators');
          toast.info('Navigated to Collaborators');
          break;
        case 'p':
          event.preventDefault();
          navigate('/projects');
          toast.info('Navigated to Projects');
          break;
        case 's':
          event.preventDefault();
          navigate('/specimens');
          toast.info('Navigated to Specimens');
          break;
        case 'l':
          event.preventDefault();
          navigate('/labels');
          toast.info('Navigated to Labels');
          break;
        default:
          break;
      }
    }

    // Handle single key shortcuts
    if (!isModifierPressed && !shiftKey && !altKey) {
      switch (key.toLowerCase()) {
        case 'escape':
          event.preventDefault();
          handleEscape();
          break;
        case '/':
          event.preventDefault();
          focusSearchField();
          break;
        case '?':
          event.preventDefault();
          if (showGlobalHelp) {
            showGlobalHelp();
          } else {
            toast.info('Press Ctrl/Cmd+? for help, or check user menu');
          }
          break;
        default:
          break;
      }
    }
  }, [navigate, location]);

  const handleNewRecord = () => {
    const currentPath = location.pathname;
    
    if (currentPath.includes('/collaborators')) {
      navigate('/collaborators/new');
      toast.success('Creating new collaborator');
    } else if (currentPath.includes('/projects')) {
      navigate('/projects/new');
      toast.success('Creating new project');
    } else if (currentPath.includes('/patients')) {
      navigate('/patients/new');
      toast.success('Creating new patient');
    } else if (currentPath.includes('/specimens')) {
      navigate('/specimens/new');
      toast.success('Creating new specimen');
    } else {
      toast.info('New record shortcut not available on this page');
    }
  };

  const focusSearchField = () => {
    // Look for common search field selectors
    const searchSelectors = [
      'input[placeholder*="Search"]',
      'input[placeholder*="search"]',
      'input[label*="Search"]',
      'input[label*="search"]',
      '.search-input',
      '#search',
      '[data-testid="search-input"]'
    ];

    for (const selector of searchSelectors) {
      const searchField = document.querySelector(selector);
      if (searchField) {
        searchField.focus();
        toast.info('Search field focused');
        return;
      }
    }

    toast.info('No search field found on this page');
  };

  const handleSave = () => {
    // Look for save buttons
    const saveSelectors = [
      'button[type="submit"]',
      'button:contains("Save")',
      'button:contains("Create")',
      'button:contains("Update")',
      '.save-button',
      '[data-testid="save-button"]'
    ];

    for (const selector of saveSelectors) {
      const saveButton = document.querySelector(selector);
      if (saveButton && !saveButton.disabled) {
        saveButton.click();
        toast.success('Save triggered');
        return;
      }
    }

    toast.info('No save action available on this page');
  };

  const handleEscape = () => {
    // Look for close buttons or cancel actions
    const cancelSelectors = [
      '[data-testid="close-button"]',
      '[data-testid="cancel-button"]',
      'button:contains("Cancel")',
      'button:contains("Close")',
      '.close-button',
      '.cancel-button'
    ];

    for (const selector of cancelSelectors) {
      const cancelButton = document.querySelector(selector);
      if (cancelButton) {
        cancelButton.click();
        return;
      }
    }

    // If no cancel button, try to navigate back
    if (window.history.length > 1) {
      window.history.back();
      toast.info('Navigated back');
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Return shortcuts info for help display
  const shortcuts = [
    { key: 'Ctrl/Cmd + N', description: 'Create new record (context-aware)' },
    { key: 'Ctrl/Cmd + F', description: 'Focus search field' },
    { key: 'Ctrl/Cmd + H', description: 'Go to Dashboard' },
    { key: 'Ctrl/Cmd + S', description: 'Save current form' },
    { key: 'Ctrl/Cmd + Shift + C', description: 'Go to Collaborators' },
    { key: 'Ctrl/Cmd + Shift + P', description: 'Go to Projects' },
    { key: 'Ctrl/Cmd + Shift + S', description: 'Go to Specimens' },
    { key: 'Ctrl/Cmd + Shift + L', description: 'Go to Labels' },
    { key: 'Escape', description: 'Close dialog or navigate back' },
    { key: '/', description: 'Focus search field' },
    { key: '?', description: 'Show keyboard shortcuts help' }
  ];

  return { shortcuts };
};

export default useKeyboardShortcuts;