# User Guide: Import/Export Workflows

## Overview

This guide covers the enhanced import/export functionality with auto-generated ID support, improved progress tracking, and comprehensive error handling.

## Key Features

### ✨ Auto-Generated IDs
- **Specimen IDs**: Sequential integers starting from 1
- **Project IDs**: Sequential integers starting from 1  
- **Collaborator IDs**: Sequential integers starting from 1
- **Thread-Safe**: Multiple users can create records simultaneously without ID conflicts
- **Persistent**: IDs are preserved across exports and imports

### 📊 Enhanced Progress Tracking
- Real-time progress indicators during long operations
- Step-by-step progress for export operations
- Estimated record counts before processing
- Clear success/error feedback with actionable next steps

### 🛡️ Comprehensive Error Handling
- User-friendly error messages instead of technical jargon
- Automatic retry for temporary failures
- Clear guidance on how to fix common issues
- Detailed error logging for troubleshooting

## Export Workflows

### Basic Export Process

1. **Access Export Dialog**
   - Navigate to the Specimens page
   - Click the "Export" button in the toolbar
   - The Enhanced Export Dialog will open

2. **Configure Export Settings**
   - **Search Filters**: Filter data before export
   - **Date Range**: Limit by collection/received dates
   - **Entity Filters**: Filter by collaborator, project, disease, etc.
   - **Format**: Choose CSV or Excel output
   - **Record Limit**: Set maximum records (up to 10,000)

3. **Select Columns**
   - **Smart Defaults**: Pre-selected commonly used columns including auto-generated IDs
   - **Priority Groups**: High/Medium/Low priority column groups
   - **Organized Categories**: Columns grouped by function (ID, Sample, Storage, etc.)
   - **Preview**: See what your export will look like before downloading

4. **Execute Export**
   - Click "Preview" to verify data and column selection
   - Review warnings and recommendations
   - Click "Export" to begin the process
   - Monitor real-time progress with step-by-step updates
   - File automatically downloads when complete

### Column Selection Guide

#### High Priority Columns (Recommended for all exports)
- **Specimen ID**: Auto-generated unique identifier
- **Tube ID**: Physical sample identifier  
- **Project ID**: Auto-generated project identifier
- **Collaborator ID**: Auto-generated collaborator identifier
- **PI Name & Institute**: Principal investigator information
- **Patient ID**: External patient identifier

#### Medium Priority Columns (Common use cases)
- **Storage Location**: Freezer, rack, box positions
- **Sample Status**: Extracted, used up, activity status
- **Sequencing Data**: Run IDs, analysis status, file locations
- **Project Details**: Disease, specimen type, dates

#### Low Priority Columns (Detailed reports)
- **Patient Demographics**: Names, dates of birth (use carefully for privacy)
- **Technical Details**: Cell counts, CSF values, extraction methods
- **Administrative**: Comments, internal contacts, IRB IDs

### Export Formats

#### CSV Format
- **Best for**: Data analysis, database imports, simple spreadsheet work
- **Advantages**: Universal compatibility, smaller file size
- **Use when**: Importing into other systems, doing statistical analysis

#### Excel Format  
- **Best for**: Formatted reports, sharing with non-technical users
- **Advantages**: Formatting preserved, multiple sheets, better for viewing
- **Use when**: Creating reports for stakeholders, archival purposes

## Import Workflows

### Preparing Import Files

#### CSV Requirements
- First row must contain column headers
- Headers should match expected field names (case-insensitive)
- Use UTF-8 encoding for special characters
- Maximum file size: 10MB
- Required columns must have values for all rows

#### Excel Requirements
- Data should be in the first worksheet
- First row must contain column headers
- Empty rows will be skipped
- Formulas will be converted to values
- Maximum file size: 10MB

### Import Process

1. **File Upload**
   - Click "Import" button on any data management page
   - Select your CSV or Excel file
   - System validates file format and size

2. **Data Validation**
   - System checks for required columns
   - Validates data types and formats
   - Identifies potential duplicates
   - Shows preview of data to be imported

3. **Conflict Resolution**
   - **Auto-Generated IDs**: System will assign new IDs to imported records
   - **Existing Records**: System will identify potential duplicates
   - **Missing Data**: You can choose to skip records or provide default values
   - **Format Issues**: System will highlight and explain formatting problems

4. **Import Execution**
   - Review summary of records to be imported
   - Choose how to handle conflicts (skip, update, or create new)
   - Monitor import progress with real-time updates
   - Receive detailed report of successful and failed imports

### Handling Auto-Generated IDs During Import

#### New Records
- System automatically assigns next available ID
- IDs are guaranteed to be unique across concurrent imports
- Original file IDs are preserved in comments if desired

#### Existing Records (Re-import scenario)
- System detects existing records by matching key fields
- You can choose to update existing records or create duplicates
- Auto-generated IDs remain unchanged for existing records

## Error Handling & Troubleshooting

### Common Export Errors

#### "No records match the current filters"
- **Cause**: Your search filters are too restrictive
- **Solution**: Broaden your search criteria or remove some filters
- **Prevention**: Use the record count estimate to verify filters before export

#### "Export file too large"
- **Cause**: Too many records selected
- **Solution**: Use date ranges or other filters to reduce record count
- **Alternative**: Export in smaller batches

#### "Network timeout during export"
- **Cause**: Large export taking too long
- **Solution**: System will automatically retry; wait for completion
- **Alternative**: Export smaller batches or try during off-peak hours

### Common Import Errors

#### "File format not supported"
- **Cause**: File is not CSV or Excel, or file is corrupted
- **Solution**: Save file as .csv or .xlsx format from your application
- **Check**: Verify file opens correctly in Excel or text editor

#### "Missing required columns"
- **Cause**: Import file doesn't contain necessary data fields
- **Solution**: Add required columns to your file or use a different import template
- **Required fields**: Vary by data type (specimen, project, collaborator)

#### "Duplicate records found"
- **Cause**: File contains identical records or conflicts with existing data
- **Solution**: Remove duplicates from file or choose "Update" option during import
- **Prevention**: Use export templates to ensure correct format

#### "Data validation errors"
- **Cause**: Data doesn't meet format requirements (invalid dates, numbers, etc.)
- **Solution**: Fix data in source file and re-import
- **Examples**: 
  - Dates must be in MM/DD/YYYY or YYYY-MM-DD format
  - Numbers cannot contain letters or special characters
  - Email addresses must be valid format

## Performance Tips

### For Large Exports (>1,000 records)
- Export during off-peak hours when possible
- Select only necessary columns to reduce processing time
- Consider breaking large exports into smaller batches by date range
- Use CSV format for faster processing

### For Large Imports (>500 records)
- Split large files into smaller batches (recommended: 200-500 records per file)
- Import during off-peak hours to avoid conflicts with other users
- Validate data in small test batches before importing full dataset
- Remove unnecessary columns to speed up processing

### Network Optimization
- Use stable, high-speed internet connection for large operations
- Avoid running multiple exports/imports simultaneously
- Close unnecessary browser tabs to free up memory
- Clear browser cache if experiencing slow performance

## Data Privacy & Security

### Patient Information
- **Review Carefully**: Always check what patient data is included in exports
- **Compliance**: Ensure exports comply with your institution's privacy policies
- **Access Control**: Only export patient data if you have proper authorization
- **Secure Handling**: Treat exported files as confidential medical records

### Best Practices
- **Minimum Necessary**: Only export data fields you actually need
- **Secure Storage**: Store export files in secure, encrypted locations
- **Access Logging**: System logs all export activities for audit purposes
- **Regular Cleanup**: Delete old export files when no longer needed

## Advanced Features

### Automated Exports (Future Feature)
- Schedule recurring exports with saved filter settings
- Automatic delivery to specified email addresses or secure folders
- Export only records modified since last export

### Bulk Operations (Current)
- Export multiple projects or collaborators at once
- Batch update records via import
- Mass assignment of storage locations or status updates

## Getting Help

### Built-in Help
- Hover over field labels for quick help tooltips
- Error messages include specific guidance for resolution
- Preview feature helps verify exports before processing

### Support Resources
- **System Administrators**: For technical issues or access problems
- **Lab Managers**: For workflow questions or data interpretation
- **User Manual**: Complete documentation available in system help section

### Reporting Issues
When reporting problems, please include:
- Error message (copy exact text)
- Steps you took before error occurred
- File you were trying to import/export (if applicable)
- Your user ID and timestamp of the issue
- Browser type and version you're using

## Changelog

### Version 2.0 (Current)
- ✅ Auto-generated ID support
- ✅ Enhanced progress tracking
- ✅ Improved error handling
- ✅ Column selection by priority
- ✅ Real-time record count estimation
- ✅ Comprehensive data validation

### Version 1.0 (Previous)
- Basic CSV export functionality
- Simple import with minimal validation
- Limited error messaging
- Manual column selection only

---

*Last updated: [Current Date]*  
*For technical support: Contact your system administrator*