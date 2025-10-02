# Bioinformatics Analysis Module - Design Document

## Executive Summary

### Business Case
Currently, bioinformatics results are scattered across individual GitHub repositories, personal directories, and various storage locations without standardized organization. This creates significant challenges:

- **Findability Problem**: Researchers cannot easily locate analyses performed on specific specimens or projects
- **No Integration**: Bioinformatics results exist in isolation from lab protocols, specimen metadata, and experimental context
- **Pattern Analysis Impossible**: Cannot identify trends across projects, protocols, or sample types
- **Collaboration Barriers**: Results sharing requires manual file hunting and email exchanges

### Solution Overview
Integrate bioinformatics analysis tracking into the LIMS by **extending the existing lab protocol system** rather than building parallel infrastructure. This approach leverages proven UI patterns and database architecture while solving the organizational challenge.

### Strategic Priority  
**This is future work** - development will begin after core LIMS functionality (import/export, specimen tracking, inventory) is fully stabilized and tested.

### Development Prerequisites
Before beginning bioinformatics module development:

✅ **Core Systems Stable**:
- Migration import system fully tested with production data
- Column mapping issues resolved completely  
- Project import workflow refined and reliable
- Export system handling all current data types correctly

✅ **Performance Optimized**:
- Database queries optimized for large datasets
- UI responsive under typical data loads
- Error handling comprehensive and user-friendly

✅ **User Adoption Established**:
- Lab staff comfortable with current LIMS workflow
- Import/export processes documented and trained
- Basic inventory and experiment tracking in regular use

**Rationale**: The bioinformatics module builds heavily on existing infrastructure. A stable, well-tested foundation is essential for successful extension.

## Overview

This document outlines the design for a bioinformatics analysis tracking module that extends the existing laboratory protocol system. The module will track computational analyses performed on sequenced specimens, maintaining complete sample-to-results traceability while leveraging external HPC infrastructure for actual computation and large file storage.

### Core Principles

1. **Protocol System Extension**: Build on existing lab protocol infrastructure rather than creating parallel systems
2. **Organizational Value First**: Solve the immediate findability and collaboration problems before complex workflow automation
3. **Lightweight Storage**: Store summary data and metadata in LIMS, keep large files on HPC
4. **Reproducibility**: Link to GitHub repositories and track all analysis parameters
5. **Integration**: Seamlessly connect with existing specimen, project, and export systems

## Database Schema Design

### Architecture Decision: Extend Existing Protocol System

Rather than creating entirely separate tables, the bioinformatics module will **extend the existing `protocols` table** to handle both lab and computational protocols. This approach:

- ✅ Reuses proven protocol management UI components
- ✅ Leverages existing parameter handling logic
- ✅ Maintains consistency with current workflow patterns
- ✅ Reduces development complexity significantly

### Protocol System Extensions

#### Option 1: Single Protocol Table (Recommended)
```sql
-- Extend existing protocols table
ALTER TABLE protocols ADD COLUMN protocol_category VARCHAR(50) DEFAULT 'lab'; -- 'lab' or 'bioinformatics'
ALTER TABLE protocols ADD COLUMN template_command TEXT; -- sbatch script template
ALTER TABLE protocols ADD COLUMN compute_requirements JSONB DEFAULT '{}';
ALTER TABLE protocols ADD COLUMN expected_file_inputs JSONB DEFAULT '{}';
ALTER TABLE protocols ADD COLUMN expected_outputs JSONB DEFAULT '{}';
```

#### Option 2: Separate Bioinformatics Protocols (Alternative)
```sql
CREATE TABLE bioinformatics_protocols (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol_id INTEGER UNIQUE NOT NULL DEFAULT nextval('protocol_id_seq'), -- Reuse existing sequence
  name VARCHAR(255) NOT NULL,
  description TEXT,
  pipeline_version VARCHAR(100), -- e.g., "DADA2 v1.28", "STAR v2.7 + DESeq2 v1.34"
  protocol_type VARCHAR(50), -- '16S', 'RNA-seq', 'WGS', 'Metagenomics', etc.
  
  -- Script generation
  template_command TEXT, -- sbatch template: "sbatch dada2_pipeline.sh --input {fastq_dir} --output {output_dir}"
  default_parameters JSONB DEFAULT '{}', -- Default analysis parameters
  compute_requirements JSONB DEFAULT '{}', -- {memory: "32GB", cpus: 8, time: "6:00:00"}
  
  -- File handling
  expected_inputs JSONB DEFAULT '{}', -- {file_types: ["fastq.gz"], paired_end: true}
  expected_outputs JSONB DEFAULT '{}', -- {asv_table: true, taxonomy: true, plots: true}
  
  -- Standard protocol fields (mirror existing)
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. `bioinformatics_experiments`
Track individual analysis runs, linking protocols to samples.

```sql
CREATE TABLE bioinformatics_experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id INTEGER UNIQUE NOT NULL DEFAULT nextval('bioinformatics_experiment_id_seq'),
  protocol_id UUID REFERENCES bioinformatics_protocols(id),
  project_id UUID REFERENCES projects(id),
  name VARCHAR(255), -- User-friendly name for this analysis
  description TEXT,
  sample_ids JSONB DEFAULT '[]', -- Array of specimen UUIDs included
  status VARCHAR(50) DEFAULT 'planning', -- planning, submitted, running, completed, failed
  parameters_used JSONB DEFAULT '{}', -- Actual parameters for this run
  
  -- HPC Integration
  hpc_job_id VARCHAR(255), -- SLURM/PBS job ID
  hpc_project_path VARCHAR(500), -- Base directory on HPC for this analysis
  
  -- GitHub Integration
  github_repo_url VARCHAR(500), -- Link to analysis code repository
  github_commit_hash VARCHAR(40), -- Specific commit used
  
  -- Execution tracking
  submitted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  performed_by UUID REFERENCES users(id),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. `analysis_results`
Store structured results and links to large files.

```sql
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID REFERENCES bioinformatics_experiments(id) ON DELETE CASCADE,
  result_name VARCHAR(255) NOT NULL, -- "OTU Table", "Differential Expression Results"
  result_type VARCHAR(100), -- 'count_table', 'taxonomy', 'statistics', 'visualization'
  
  -- Small data storage
  structured_data JSONB, -- Actual tables/statistics stored in DB
  summary_stats JSONB, -- Quick metrics: {total_reads: 1000000, unique_otus: 234}
  
  -- Large file references
  file_path VARCHAR(500), -- Path on HPC to full result file
  file_size_mb DECIMAL(10,2),
  file_format VARCHAR(50), -- 'csv', 'tsv', 'biom', 'pdf', etc.
  
  -- Sample associations
  specimen_associations JSONB DEFAULT '[]', -- Links to specific specimen results
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_bio_experiments_project ON bioinformatics_experiments(project_id);
CREATE INDEX idx_bio_experiments_status ON bioinformatics_experiments(status);
CREATE INDEX idx_bio_experiments_samples ON bioinformatics_experiments USING gin(sample_ids);
CREATE INDEX idx_analysis_results_experiment ON analysis_results(experiment_id);
CREATE INDEX idx_analysis_results_type ON analysis_results(result_type);
```

### Integration Functions

```sql
-- Function to get all analyses for a specimen
CREATE FUNCTION get_specimen_analyses(specimen_id UUID)
RETURNS TABLE (
  analysis_id INTEGER,
  analysis_name VARCHAR,
  protocol_name VARCHAR,
  status VARCHAR,
  completed_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    be.analysis_id,
    be.name,
    bp.name,
    be.status,
    be.completed_at
  FROM bioinformatics_experiments be
  JOIN bioinformatics_protocols bp ON be.protocol_id = bp.id
  WHERE be.sample_ids::jsonb ? specimen_id::text
  ORDER BY be.created_at DESC;
END;
$$ LANGUAGE plpgsql;
```

## User Interface Design

### 1. Bioinformatics Dashboard
Main entry point showing:
- Recent analyses by project
- Analyses in progress
- Quick access to create new analysis

### 2. Protocol Management
Similar to lab protocols:
- List of available bioinformatics protocols
- Create/edit protocol templates
- Version tracking

### 3. Analysis Planning Workflow

#### Step 1: Select Protocol
- Choose from dropdown of active protocols
- View expected inputs/outputs
- See default parameters

#### Step 2: Select Samples
- **Project-first selection** (reuse existing pattern)
- Filter to show only sequenced specimens
- Batch selection tools
- Option to upload sample manifest

#### Step 3: Configure Analysis
- Review/modify parameters
- Add GitHub repository URL
- Set HPC project path
- Add descriptive notes

#### Step 4: Track Execution
- Update status as analysis progresses
- Log HPC job IDs
- Track start/completion times

#### Step 5: Upload Results
- Upload summary tables (CSV/TSV)
- Add HPC file paths for large results
- Associate results with specific specimens
- Extract key metrics

### 4. Results Viewing
- Summary statistics dashboard
- Downloadable result tables
- Links to HPC files
- Links to GitHub repos

## API Endpoints

### Protocol Management
```
GET    /api/bioinformatics/protocols     - List all protocols
GET    /api/bioinformatics/protocols/:id - Get protocol details
POST   /api/bioinformatics/protocols     - Create new protocol
PUT    /api/bioinformatics/protocols/:id - Update protocol
DELETE /api/bioinformatics/protocols/:id - Deactivate protocol
```

### Analysis Management
```
GET    /api/bioinformatics/analyses      - List analyses (with filtering)
GET    /api/bioinformatics/analyses/:id  - Get analysis details
POST   /api/bioinformatics/analyses      - Create new analysis
PUT    /api/bioinformatics/analyses/:id  - Update analysis
DELETE /api/bioinformatics/analyses/:id  - Cancel/delete analysis

POST   /api/bioinformatics/analyses/:id/status - Update analysis status
POST   /api/bioinformatics/analyses/:id/results - Upload results
```

### Results Access
```
GET    /api/bioinformatics/results/:id   - Get result details
GET    /api/bioinformatics/results/:id/download - Download result data
GET    /api/specimens/:id/analyses        - Get all analyses for a specimen
GET    /api/projects/:id/analyses         - Get all analyses for a project
```

## Data Storage Strategy

### Store in LIMS Database
1. **Summary Statistics**
   - Read counts per sample
   - Quality metrics (Q30, GC content)
   - Diversity indices (Shannon, Simpson)
   - Top taxonomic assignments

2. **Small Result Tables** (<10MB)
   - OTU/ASV tables (filtered)
   - Differential expression results (top genes)
   - Sample metadata mappings

3. **Analysis Metadata**
   - All parameters used
   - Software versions
   - Reference databases
   - Quality thresholds

### Store on HPC Server
1. **Raw/Intermediate Files**
   - FASTQ files
   - BAM/SAM alignments
   - Assembly graphs
   - Full count matrices

2. **Visualization Files**
   - PDF reports
   - Interactive HTML plots
   - Phylogenetic trees
   - Network diagrams

### File Naming Convention
```
/hpc/project/pathogen_lims/
  └── analyses/
      └── BIO-001_16S_Project849_2024-01-15/
          ├── raw_data/
          ├── processed_data/
          ├── results/
          │   ├── otu_table_full.biom
          │   ├── taxonomy_assignments.tsv
          │   └── alpha_diversity.pdf
          └── logs/
```

## Implementation Strategy: Protocol-First Approach

### Strategic Decision: Results Repository First
Based on organizational needs analysis, implement in phases that prioritize immediate value (findability and organization) over complex workflow automation.

### Phase 1: Results Repository & Basic Protocols (2-3 weeks)
**Goal**: Solve the core organizational problem - scattered, unfindable results

**Key Features**:
- Extend existing protocol system for bioinformatics protocols (DADA2, RNA-seq, etc.)
- Simple analysis results upload interface
- Basic script template generation (sbatch files)
- Integration with existing specimen/project pages
- Search and browse functionality

**Leverages Existing**:
- Protocol management UI (just add bioinformatics category)
- File upload components and validation
- Project/specimen selection interfaces
- Search infrastructure

### Phase 2: Enhanced Protocol Management (2-3 weeks)  
**Goal**: Standardize analysis workflows and improve reproducibility

**Key Features**:
- Advanced parameter management for analysis protocols
- Template command generation with parameter substitution
- Compute resource requirement tracking
- GitHub repository integration
- Enhanced results metadata capture

**Builds On**:
- Existing protocol parameter handling patterns
- Current experiment workflow components
- File management and validation systems

### Phase 3: Advanced Integration & Analytics (Future)
**Goal**: Enable cross-analysis pattern detection and advanced workflows

**Key Features**:
- Cross-analysis reporting and comparison tools
- Integration with export system for multi-analysis reports
- Advanced search across analysis types and parameters
- Potential HPC workflow automation (very future)

**Development Timeline**:
- Phase 1: After core LIMS stabilization complete
- Phase 2: 4-6 weeks after Phase 1 
- Phase 3: Long-term roadmap item

## Example Use Cases

### Realistic Workflow: DADA2 16S Analysis on Stool Samples

**Scenario**: Bioinformatician has completed DADA2 analysis on stool samples from a disease cohort study

#### Step 1: Bioinformatician's Current Workflow (External to LIMS)
```bash
# Run DADA2 pipeline on HPC (outside LIMS)
sbatch dada2_pipeline.sh --input /hpc/fastq/project_849/ --output /hpc/results/dada2_stool_2024/
```

#### Step 2: Results Upload to LIMS 
**What DADA2 Typically Produces**:
- **ASV Table**: `asv_table.tsv` - abundance counts per sample
- **Taxonomy Assignment**: `taxonomy.tsv` - bacterial species identified  
- **Quality Statistics**: `quality_stats.json` - read counts, filtering stats
- **Alpha Diversity**: `alpha_diversity.csv` - Shannon index, richness per sample
- **Representative Sequences**: `rep_seqs.fasta` - actual ASV sequences

**LIMS Upload Interface** (similar to current protocol upload):
```json
{
  "protocol": "DADA2 16S Analysis v1.28",
  "analysis_name": "Stool Microbiome - Disease Cohort A",
  "project": "Project 849 - IBD Patient Cohort", 
  "specimens": ["SPC-1001", "SPC-1002", "SPC-1003", "..."],
  "github_repo": "https://github.com/lab/project849_16s_analysis",
  "hpc_results_path": "/hpc/results/dada2_stool_2024/",
  
  "uploaded_results": [
    {
      "file_name": "asv_table.tsv",
      "result_type": "count_table", 
      "summary_stats": {"total_asvs": 1247, "total_reads": 3200000}
    },
    {
      "file_name": "taxonomy.tsv", 
      "result_type": "taxonomy",
      "summary_stats": {"classified_asvs": 1134, "unclassified": 113}
    },
    {
      "file_name": "alpha_diversity.csv",
      "result_type": "diversity_metrics",
      "summary_stats": {"mean_shannon": 4.23, "samples_analyzed": 48}
    }
  ]
}
```

#### Step 3: Integration Benefits
**Immediate Value**:
- Find all 16S analyses on stool samples: Search "stool" + "16S" → instant results
- Compare protocols: "Did DADA2 v1.28 work better than v1.24 on these sample types?"
- Quality troubleshooting: "Which samples had low diversity? What was different about their extraction protocol?"
- Collaboration: "Show me all microbiome analyses from the IBD project"

**Pattern Analysis** (future value):
- Cross-project comparison: Stool microbiomes in IBD vs. healthy controls
- Protocol optimization: Success rates by extraction method + analysis pipeline
- Resource planning: Typical compute requirements for different sample sizes

### RNA-seq Differential Expression
```json
{
  "protocol": "RNA-seq DE Analysis",
  "samples": ["treated_1", "treated_2", "control_1", "control_2"],
  "parameters": {
    "aligner": "STAR",
    "quantification": "featureCounts",
    "de_method": "DESeq2",
    "fdr_threshold": 0.05
  },
  "github_repo": "https://github.com/lab/project849_rnaseq",
  "results": [
    {
      "type": "de_results",
      "summary": {"total_de_genes": 342, "upregulated": 198, "downregulated": 144},
      "structured_data": "... top 100 DE genes ...",
      "file_path": "/hpc/analyses/BIO-002/full_de_results.csv"
    }
  ]
}
```

## Security Considerations

1. **Access Control**
   - Reuse existing role-based permissions
   - Bioinformaticians can create/edit analyses
   - All users can view results

2. **Data Privacy**
   - Ensure HPC paths don't expose sensitive information
   - Validate GitHub URLs before storing
   - Audit trail for all analysis operations

3. **File Security**
   - Store only paths, not actual HPC credentials
   - Validate file references exist before linking
   - Consider checksums for data integrity

## Future Enhancements

1. **Pipeline Integration**
   - Direct submission to HPC schedulers
   - Nextflow/Snakemake workflow tracking
   - Automatic status updates via webhooks

2. **Advanced Features**
   - Comparative analyses across projects
   - Automated quality control checks
   - Result versioning and comparisons
   - Integration with public databases

3. **Visualization**
   - Embedded plot viewers
   - Interactive data exploration
   - Cross-analysis comparisons

## Complexity & Timeline Assessment

### Revised Complexity Analysis
**Original Assessment**: 8 weeks for full system
**Revised Assessment**: 4-6 weeks for Phase 1 (results repository) 

**Why Much Simpler Than Initially Thought**:
- ✅ **Protocol Extension vs. Parallel System**: Build on existing infrastructure rather than create new systems
- ✅ **UI Component Reuse**: Protocol forms, file uploads, search interfaces already exist
- ✅ **Proven Patterns**: Database schema, API patterns, validation logic already established
- ✅ **Results-First Approach**: Solve organizational problem before workflow automation complexity

**Development Effort Comparison**:
- **Original Design**: Complex workflow system (8+ weeks)
- **Protocol Extension Approach**: Results repository (4-6 weeks)
- **Immediate Value**: Findability problem solved in Phase 1

### Strategic Priority & Timing

**Current Priority**: Core LIMS Stabilization
- Import/export system refinement
- Column mapping consistency 
- Error handling improvements
- Performance optimization

**Bioinformatics Module**: **Future Development**
- Begin after core systems are production-ready
- Estimated start: Q2/Q3 after current stabilization phase
- Delivery timeline: 6-8 weeks after development start

**Business Case Strength**: **High** - addresses real organizational pain point
**Technical Risk**: **Low** - builds on proven, stable infrastructure
**User Adoption Risk**: **Low** - solves immediate problem with familiar UI patterns

## Benefits Summary

✅ **Organizational Value**: Solves immediate scattered results problem  
✅ **Leverages Existing Infrastructure**: Protocol system extension rather than new architecture  
✅ **Consistent UX**: Reuses familiar experiment logging patterns  
✅ **Complete Traceability**: Sample → Sequencing → Analysis → Results  
✅ **Flexible Storage**: Appropriate data in appropriate places  
✅ **Reproducibility**: GitHub + parameter tracking  
✅ **Scalable**: Handles any analysis type  
✅ **Integrated**: Works with existing export/reporting systems  
✅ **Future-Ready**: Foundation for advanced workflow automation