-- EXPANDED LIMS DEMO DATA
-- Comprehensive demo data for clinical research LIMS
-- Compatible with current database schema

BEGIN;

-- ================================================================================
-- COLLABORATORS (10 Research Institutions)
-- ================================================================================
INSERT INTO collaborators (collaborator_number, irb_id, pi_name, pi_institute, pi_email, pi_phone, internal_contact, comments) VALUES
(1, 'IRB-2024-001', 'Dr. Sarah Chen', 'Johns Hopkins School of Public Health', 's.chen@jhsph.edu', '410-955-3543', 'Maria Rodriguez', 'Specializes in respiratory pathogens and viral genomics'),
(2, 'IRB-2024-002', 'Dr. Michael Thompson', 'CDC Infectious Disease Laboratory', 'm.thompson@cdc.gov', '404-639-2206', 'James Liu', 'Focus on emerging viral threats and surveillance'),
(3, 'IRB-2024-003', 'Dr. Priya Patel', 'Stanford University Medical Center', 'p.patel@stanford.edu', '650-723-4000', 'David Kim', 'Cancer-associated pathogens and immunocompromised patients'),
(4, 'IRB-2024-004', 'Dr. Jennifer Walsh', 'Boston Children''s Hospital', 'j.walsh@childrens.harvard.edu', '617-355-6000', 'Thomas Murphy', 'Pediatric infectious diseases'),
(5, 'IRB-2024-005', 'Dr. Robert Fischer', 'University of Minnesota', 'r.fischer@umn.edu', '612-625-9372', 'Lisa Wong', 'Immunology and vaccine research'),
(6, 'IRB-2024-006', 'Dr. Elena Martinez', 'Mayo Clinic', 'e.martinez@mayo.edu', '507-284-2511', 'Carlos Mendoza', 'Molecular diagnostics and precision medicine'),
(7, 'IRB-2024-007', 'Dr. David Lee', 'UCSF Medical Center', 'd.lee@ucsf.edu', '415-476-1000', 'Amanda Chen', 'HIV and retrovirus research'),
(8, 'IRB-2024-008', 'Dr. Rachel Goldman', 'Mount Sinai Hospital', 'r.goldman@mssm.edu', '212-241-6500', 'Michael Brown', 'Antimicrobial resistance studies'),
(9, 'IRB-2024-009', 'Dr. James Patterson', 'Cleveland Clinic', 'j.patterson@ccf.org', '216-444-2200', 'Sarah Miller', 'Cardiac infection complications'),
(10, 'IRB-2024-010', 'Dr. Lisa Anderson', 'Duke University Medical Center', 'l.anderson@duke.edu', '919-684-8111', 'Kevin Park', 'Tropical and emerging infectious diseases');

-- ================================================================================
-- PROJECTS (15 Research Studies)
-- ================================================================================
INSERT INTO projects (project_number, collaborator_id, disease, specimen_type, source, date_received, feedback_date, comments) VALUES
(1, (SELECT id FROM collaborators WHERE collaborator_number = 1), 'COVID-19', 'Nasopharyngeal Swab', 'Hospital ICU', '2024-08-15', '2024-09-15', 'Long-term study of variant evolution in hospitalized patients'),
(2, (SELECT id FROM collaborators WHERE collaborator_number = 2), 'Influenza A/B', 'Nasal Swab', 'Community Clinic', '2024-08-10', '2024-09-10', 'Seasonal surveillance for CDC reporting'),
(3, (SELECT id FROM collaborators WHERE collaborator_number = 3), 'Opportunistic Infections', 'Blood', 'Cancer Center', '2024-08-01', '2024-08-31', 'Immunocompromised patient infection screening'),
(4, (SELECT id FROM collaborators WHERE collaborator_number = 4), 'RSV', 'Nasal Aspirate', 'Pediatric ER', '2024-07-20', '2024-08-20', 'Severe RSV cases in infants under 6 months'),
(5, (SELECT id FROM collaborators WHERE collaborator_number = 5), 'Measles', 'Serum', 'Vaccine Clinic', '2024-07-15', '2024-08-15', 'Vaccine efficacy and antibody response study'),
(6, (SELECT id FROM collaborators WHERE collaborator_number = 6), 'Sepsis', 'Blood Culture', 'ICU', '2024-08-05', '2024-09-05', 'Rapid pathogen identification in septic patients'),
(7, (SELECT id FROM collaborators WHERE collaborator_number = 7), 'HIV', 'Plasma', 'HIV Clinic', '2024-07-25', '2024-08-25', 'Viral load monitoring and drug resistance'),
(8, (SELECT id FROM collaborators WHERE collaborator_number = 8), 'MRSA', 'Wound Swab', 'Wound Care Center', '2024-08-12', '2024-09-12', 'Antibiotic resistance profiling'),
(9, (SELECT id FROM collaborators WHERE collaborator_number = 9), 'Endocarditis', 'Blood', 'Cardiology', '2024-07-30', '2024-08-30', 'Bacterial endocarditis pathogen identification'),
(10, (SELECT id FROM collaborators WHERE collaborator_number = 10), 'Dengue Fever', 'Serum', 'Travel Clinic', '2024-08-08', '2024-09-08', 'Serotype characterization and diagnosis'),
(11, (SELECT id FROM collaborators WHERE collaborator_number = 1), 'COVID-19 Long Haul', 'Serum', 'Post-COVID Clinic', '2024-09-01', '2024-10-01', 'Immunological markers in long COVID patients'),
(12, (SELECT id FROM collaborators WHERE collaborator_number = 3), 'Pneumocystis pneumonia', 'BAL', 'Cancer Center', '2024-08-20', '2024-09-20', 'PCP screening in immunosuppressed patients'),
(13, (SELECT id FROM collaborators WHERE collaborator_number = 6), 'C. difficile', 'Stool', 'GI Clinic', '2024-08-25', '2024-09-25', 'CDI toxin testing and strain typing'),
(14, (SELECT id FROM collaborators WHERE collaborator_number = 8), 'Tuberculosis', 'Sputum', 'TB Clinic', '2024-07-10', '2024-08-10', 'MDR-TB surveillance and resistance profiling'),
(15, (SELECT id FROM collaborators WHERE collaborator_number = 10), 'Zika Virus', 'Urine', 'Travel Medicine', '2024-09-05', '2024-10-05', 'Zika detection in returning travelers');

-- ================================================================================
-- PATIENTS (25 patients)
-- ================================================================================
INSERT INTO patients (patient_number, external_id, first_name, last_name, date_of_birth, diagnosis, physician_first_name, physician_last_name, comments) VALUES
(1, 'COV-2024-001', 'John', 'Smith', '1957-03-15', 'COVID-19 Pneumonia', 'Dr. Sarah', 'Johnson', 'ICU admission, diabetes, hypertension'),
(2, 'FLU-2024-001', 'Tommy', 'Lee', '2016-04-12', 'Influenza A H3N2', 'Dr. Jennifer', 'Walsh', 'Pediatric patient with asthma'),
(3, 'ONC-2024-001', 'Robert', 'Wilson', '1972-01-25', 'Febrile Neutropenia', 'Dr. Priya', 'Patel', 'ALL patient on chemotherapy'),
(4, 'RSV-2024-001', 'Emma', 'Johnson', '2024-03-10', 'RSV Bronchiolitis', 'Dr. Jennifer', 'Walsh', '5-month-old infant, premature birth'),
(5, 'RSV-2024-002', 'Noah', 'Brown', '2024-02-15', 'Severe RSV', 'Dr. Jennifer', 'Walsh', '6-month-old, respiratory distress'),
(6, 'VAC-2024-001', 'Sarah', 'Davis', '2020-05-20', 'Measles Antibody Testing', 'Dr. Robert', 'Fischer', 'Post-vaccination titer check'),
(7, 'SEP-2024-001', 'Michael', 'Anderson', '1965-11-08', 'Septic Shock', 'Dr. Elena', 'Martinez', 'Post-surgical sepsis'),
(8, 'HIV-2024-001', 'Alex', 'Taylor', '1988-07-22', 'HIV (suppressed)', 'Dr. David', 'Lee', 'On ART, routine monitoring'),
(9, 'HIV-2024-002', 'Jordan', 'Martinez', '1992-09-14', 'HIV with resistance', 'Dr. David', 'Lee', 'Treatment failure, resistance testing'),
(10, 'MRSA-2024-001', 'Patricia', 'Thompson', '1955-12-03', 'Diabetic Foot Infection', 'Dr. Rachel', 'Goldman', 'MRSA wound infection'),
(11, 'CARD-2024-001', 'William', 'Garcia', '1948-04-17', 'Bacterial Endocarditis', 'Dr. James', 'Patterson', 'Prosthetic valve infection'),
(12, 'DEN-2024-001', 'Maria', 'Rodriguez', '1985-08-25', 'Dengue Fever', 'Dr. Lisa', 'Anderson', 'Recent travel to Southeast Asia'),
(13, 'COV-2024-002', 'Linda', 'White', '1963-10-12', 'Long COVID Syndrome', 'Dr. Sarah', 'Chen', 'Persistent fatigue, brain fog'),
(14, 'COV-2024-003', 'James', 'Harris', '1970-02-28', 'COVID-19 Mild', 'Dr. Sarah', 'Chen', 'Outpatient, fully vaccinated'),
(15, 'PCP-2024-001', 'Charles', 'Martin', '1968-06-05', 'Pneumocystis Pneumonia', 'Dr. Priya', 'Patel', 'Lymphoma patient'),
(16, 'CDI-2024-001', 'Barbara', 'Jackson', '1952-11-30', 'C. difficile Infection', 'Dr. Elena', 'Martinez', 'Post-antibiotic diarrhea'),
(17, 'TB-2024-001', 'Richard', 'Lee', '1975-03-18', 'Tuberculosis', 'Dr. Rachel', 'Goldman', 'MDR-TB suspected'),
(18, 'TB-2024-002', 'Susan', 'Walker', '1982-07-09', 'Latent TB', 'Dr. Rachel', 'Goldman', 'Contact tracing, treatment initiated'),
(19, 'ZIKA-2024-001', 'Jennifer', 'Hall', '1990-12-22', 'Zika Virus', 'Dr. Lisa', 'Anderson', 'Pregnant, travel to Brazil'),
(20, 'FLU-2024-002', 'David', 'Allen', '1958-05-14', 'Influenza B', 'Dr. Michael', 'Thompson', 'Elderly, nursing home outbreak'),
(21, 'FLU-2024-003', 'Nancy', 'Young', '1945-09-03', 'Influenza A H1N1', 'Dr. Michael', 'Thompson', 'Community-acquired'),
(22, 'SEP-2024-002', 'Kevin', 'King', '1978-01-19', 'Pneumonia with Sepsis', 'Dr. Elena', 'Martinez', 'Community-acquired pneumonia'),
(23, 'MRSA-2024-002', 'Betty', 'Wright', '1960-08-11', 'MRSA Pneumonia', 'Dr. Rachel', 'Goldman', 'Healthcare-associated'),
(24, 'ONC-2024-002', 'George', 'Lopez', '1953-04-26', 'Neutropenic Fever', 'Dr. Priya', 'Patel', 'AML patient'),
(25, 'RSV-2024-003', 'Olivia', 'Hill', '2024-04-05', 'RSV', 'Dr. Jennifer', 'Walsh', '4-month-old, hospitalized');

-- ================================================================================
-- SPECIMENS (40 specimens)
-- ================================================================================
INSERT INTO specimens (specimen_number, project_id, patient_id, tube_id, date_collected, collection_category, specimen_site, position_freezer, comments, metadata) VALUES
-- COVID-19 specimens
(1, (SELECT id FROM projects WHERE project_number = 1), (SELECT id FROM patients WHERE patient_number = 1), 'COV-001-001', '2024-08-15', 'Respiratory', 'Nasopharynx', 'Freezer A-1-05', 'ICU patient, day 1', '{"viral_load": "1.2e6 copies/mL", "ct_value": 22.4, "variant": "BA.2.86"}'),
(2, (SELECT id FROM projects WHERE project_number = 1), (SELECT id FROM patients WHERE patient_number = 1), 'COV-001-002', '2024-08-20', 'Respiratory', 'Nasopharynx', 'Freezer A-1-06', 'ICU patient, day 5', '{"viral_load": "3.5e5 copies/mL", "ct_value": 25.1, "variant": "BA.2.86"}'),
(3, (SELECT id FROM projects WHERE project_number = 11), (SELECT id FROM patients WHERE patient_number = 13), 'COV-002-001', '2024-09-01', 'Blood', 'Venipuncture', 'Freezer A-2-01', 'Long COVID serology', '{"antibody_level": "450 AU/mL", "inflammatory_markers": "elevated"}'),
(4, (SELECT id FROM projects WHERE project_number = 1), (SELECT id FROM patients WHERE patient_number = 14), 'COV-001-003', '2024-08-22', 'Respiratory', 'Nasopharynx', 'Freezer A-1-07', 'Outpatient, mild case', '{"viral_load": "8.7e4 copies/mL", "ct_value": 28.3, "variant": "BA.2.86"}'),

-- Influenza specimens
(5, (SELECT id FROM projects WHERE project_number = 2), (SELECT id FROM patients WHERE patient_number = 2), 'FLU-001-001', '2024-08-10', 'Respiratory', 'Nasal cavity', 'Freezer B-2-12', 'Pediatric flu', '{"subtype": "H3N2", "viral_load": "2.1e5 copies/mL", "ct_value": 26.3}'),
(6, (SELECT id FROM projects WHERE project_number = 2), (SELECT id FROM patients WHERE patient_number = 20), 'FLU-001-002', '2024-08-18', 'Respiratory', 'Nasopharynx', 'Freezer B-2-13', 'Nursing home outbreak', '{"subtype": "B/Victoria", "ct_value": 24.5}'),
(7, (SELECT id FROM projects WHERE project_number = 2), (SELECT id FROM patients WHERE patient_number = 21), 'FLU-001-003', '2024-08-19', 'Respiratory', 'Nasopharynx', 'Freezer B-2-14', 'Community case', '{"subtype": "H1N1", "ct_value": 27.2}'),

-- Cancer/Immunocompromised specimens
(8, (SELECT id FROM projects WHERE project_number = 3), (SELECT id FROM patients WHERE patient_number = 3), 'ONC-001-001', '2024-08-01', 'Blood', 'Venipuncture', 'Freezer C-3-08', 'Febrile neutropenia', '{"sample_type": "EDTA plasma", "culture_results": "Candida albicans"}'),
(9, (SELECT id FROM projects WHERE project_number = 3), (SELECT id FROM patients WHERE patient_number = 24), 'ONC-001-002', '2024-08-28', 'Blood', 'Venipuncture', 'Freezer C-3-09', 'AML patient fever', '{"sample_type": "EDTA plasma", "culture_results": "E. coli ESBL+"}'),
(10, (SELECT id FROM projects WHERE project_number = 12), (SELECT id FROM patients WHERE patient_number = 15), 'PCP-001-001', '2024-08-20', 'BAL', 'Bronchoscopy', 'Freezer C-1-01', 'PCP suspected', '{"microscopy": "cysts observed", "PCR": "positive"}'),

-- RSV specimens
(11, (SELECT id FROM projects WHERE project_number = 4), (SELECT id FROM patients WHERE patient_number = 4), 'RSV-001-001', '2024-07-20', 'Respiratory', 'Nasal aspirate', 'Freezer B-1-01', 'Infant bronchiolitis', '{"viral_load": "1.5e6 copies/mL", "ct_value": 21.8}'),
(12, (SELECT id FROM projects WHERE project_number = 4), (SELECT id FROM patients WHERE patient_number = 5), 'RSV-001-002', '2024-07-22', 'Respiratory', 'Nasal aspirate', 'Freezer B-1-02', 'Severe RSV', '{"viral_load": "2.3e6 copies/mL", "ct_value": 20.5}'),
(13, (SELECT id FROM projects WHERE project_number = 4), (SELECT id FROM patients WHERE patient_number = 25), 'RSV-001-003', '2024-09-10', 'Respiratory', 'Nasal aspirate', 'Freezer B-1-03', 'RSV hospitalization', '{"viral_load": "1.8e6 copies/mL", "ct_value": 22.1}'),

-- Vaccine/Serology specimens
(14, (SELECT id FROM projects WHERE project_number = 5), (SELECT id FROM patients WHERE patient_number = 6), 'VAC-001-001', '2024-07-15', 'Blood', 'Venipuncture', 'Freezer D-1-01', 'Post-vaccination', '{"antibody_titer": "1:640", "result": "protective"}'),

-- Sepsis specimens
(15, (SELECT id FROM projects WHERE project_number = 6), (SELECT id FROM patients WHERE patient_number = 7), 'SEP-001-001', '2024-08-05', 'Blood', 'Blood culture', 'Freezer C-2-01', 'Septic shock', '{"organism": "Klebsiella pneumoniae", "carbapenem_resistant": true}'),
(16, (SELECT id FROM projects WHERE project_number = 6), (SELECT id FROM patients WHERE patient_number = 22), 'SEP-001-002', '2024-09-12', 'Blood', 'Blood culture', 'Freezer C-2-02', 'CAP with sepsis', '{"organism": "Streptococcus pneumoniae", "penicillin_resistant": false}'),

-- HIV specimens
(17, (SELECT id FROM projects WHERE project_number = 7), (SELECT id FROM patients WHERE patient_number = 8), 'HIV-001-001', '2024-07-25', 'Blood', 'Plasma', 'Freezer D-2-01', 'Routine monitoring', '{"viral_load": "undetectable", "CD4_count": 550}'),
(18, (SELECT id FROM projects WHERE project_number = 7), (SELECT id FROM patients WHERE patient_number = 9), 'HIV-001-002', '2024-07-26', 'Blood', 'Plasma', 'Freezer D-2-02', 'Treatment failure', '{"viral_load": "25000 copies/mL", "resistance_mutations": "M184V, K103N"}'),

-- MRSA specimens
(19, (SELECT id FROM projects WHERE project_number = 8), (SELECT id FROM patients WHERE patient_number = 10), 'MRSA-001-001', '2024-08-12', 'Wound', 'Swab', 'Freezer E-1-01', 'Diabetic foot wound', '{"organism": "MRSA", "vancomycin_MIC": "1.0"}'),
(20, (SELECT id FROM projects WHERE project_number = 8), (SELECT id FROM patients WHERE patient_number = 23), 'MRSA-001-002', '2024-09-15', 'Respiratory', 'Sputum', 'Freezer E-1-02', 'HAP', '{"organism": "MRSA", "vancomycin_MIC": "1.5"}'),

-- Endocarditis specimens
(21, (SELECT id FROM projects WHERE project_number = 9), (SELECT id FROM patients WHERE patient_number = 11), 'CARD-001-001', '2024-07-30', 'Blood', 'Blood culture', 'Freezer C-2-03', 'Prosthetic valve', '{"organism": "Staphylococcus epidermidis", "biofilm_producer": true}'),

-- Dengue specimens
(22, (SELECT id FROM projects WHERE project_number = 10), (SELECT id FROM patients WHERE patient_number = 12), 'DEN-001-001', '2024-08-08', 'Blood', 'Serum', 'Freezer D-3-01', 'Dengue fever', '{"serotype": "DENV-2", "NS1_antigen": "positive"}'),

-- C. diff specimens
(23, (SELECT id FROM projects WHERE project_number = 13), (SELECT id FROM patients WHERE patient_number = 16), 'CDI-001-001', '2024-08-25', 'Stool', 'Stool sample', 'Freezer F-1-01', 'Post-antibiotic diarrhea', '{"toxin_A": "positive", "toxin_B": "positive", "ribotype": "027"}'),

-- TB specimens
(24, (SELECT id FROM projects WHERE project_number = 14), (SELECT id FROM patients WHERE patient_number = 17), 'TB-001-001', '2024-07-10', 'Respiratory', 'Sputum', 'Freezer G-1-01', 'MDR-TB suspected', '{"AFB_smear": "3+", "rifampin_resistant": true}'),
(25, (SELECT id FROM projects WHERE project_number = 14), (SELECT id FROM patients WHERE patient_number = 18), 'TB-001-002', '2024-07-11', 'Blood', 'IGRA', 'Freezer G-1-02', 'Latent TB', '{"IGRA_result": "positive"}'),

-- Zika specimens
(26, (SELECT id FROM projects WHERE project_number = 15), (SELECT id FROM patients WHERE patient_number = 19), 'ZIKA-001-001', '2024-09-05', 'Urine', 'Urine sample', 'Freezer D-3-02', 'Pregnant traveler', '{"PCR": "positive", "viral_load": "1.2e4 copies/mL"}'),

-- Additional specimens for variety
(27, (SELECT id FROM projects WHERE project_number = 1), (SELECT id FROM patients WHERE patient_number = 1), 'COV-001-004', '2024-08-25', 'Respiratory', 'Nasopharynx', 'Freezer A-1-08', 'ICU patient, day 10', '{"viral_load": "2.1e4 copies/mL", "ct_value": 30.2}'),
(28, (SELECT id FROM projects WHERE project_number = 2), (SELECT id FROM patients WHERE patient_number = 2), 'FLU-001-004', '2024-08-12', 'Respiratory', 'Nasal cavity', 'Freezer B-2-15', 'Follow-up sample', '{"subtype": "H3N2", "ct_value": 32.1}'),
(29, (SELECT id FROM projects WHERE project_number = 3), (SELECT id FROM patients WHERE patient_number = 3), 'ONC-001-003', '2024-08-10', 'Blood', 'Venipuncture', 'Freezer C-3-10', 'Post-treatment', '{"sample_type": "EDTA plasma", "culture_results": "negative"}'),
(30, (SELECT id FROM projects WHERE project_number = 4), (SELECT id FROM patients WHERE patient_number = 4), 'RSV-001-004', '2024-07-25', 'Respiratory', 'Nasal aspirate', 'Freezer B-1-04', 'Recovery sample', '{"viral_load": "1.2e5 copies/mL", "ct_value": 26.8}'),
(31, (SELECT id FROM projects WHERE project_number = 6), (SELECT id FROM patients WHERE patient_number = 7), 'SEP-001-003', '2024-08-07', 'Blood', 'Blood culture', 'Freezer C-2-04', 'Day 2 repeat culture', '{"organism": "Klebsiella pneumoniae", "same_strain": true}'),
(32, (SELECT id FROM projects WHERE project_number = 7), (SELECT id FROM patients WHERE patient_number = 8), 'HIV-001-003', '2024-10-25', 'Blood', 'Plasma', 'Freezer D-2-03', '3-month follow-up', '{"viral_load": "undetectable", "CD4_count": 580}'),
(33, (SELECT id FROM projects WHERE project_number = 8), (SELECT id FROM patients WHERE patient_number = 10), 'MRSA-001-003', '2024-08-19', 'Wound', 'Swab', 'Freezer E-1-03', 'Post-debridement', '{"organism": "MRSA", "improving": true}'),
(34, (SELECT id FROM projects WHERE project_number = 11), (SELECT id FROM patients WHERE patient_number = 13), 'COV-002-002', '2024-10-01', 'Blood', 'Venipuncture', 'Freezer A-2-02', 'Long COVID 1-month', '{"antibody_level": "420 AU/mL", "inflammatory_markers": "stable"}'),
(35, (SELECT id FROM projects WHERE project_number = 12), (SELECT id FROM patients WHERE patient_number = 15), 'PCP-001-002', '2024-08-27', 'Blood', 'Serum', 'Freezer C-1-02', 'PCP serology', '{"beta_D_glucan": "elevated"}'),
(36, (SELECT id FROM projects WHERE project_number = 13), (SELECT id FROM patients WHERE patient_number = 16), 'CDI-001-002', '2024-09-01', 'Stool', 'Stool sample', 'Freezer F-1-02', 'Test of cure', '{"toxin_A": "negative", "toxin_B": "negative"}'),
(37, (SELECT id FROM projects WHERE project_number = 14), (SELECT id FROM patients WHERE patient_number = 17), 'TB-001-003', '2024-07-17', 'Respiratory', 'Sputum', 'Freezer G-1-03', 'Week 1 culture', '{"AFB_smear": "2+"}'),
(38, (SELECT id FROM projects WHERE project_number = 5), (SELECT id FROM patients WHERE patient_number = 6), 'VAC-001-002', '2024-10-15', 'Blood', 'Venipuncture', 'Freezer D-1-02', '3-month titer check', '{"antibody_titer": "1:320", "result": "protective"}'),
(39, (SELECT id FROM projects WHERE project_number = 10), (SELECT id FROM patients WHERE patient_number = 12), 'DEN-001-002', '2024-08-15', 'Blood', 'Serum', 'Freezer D-3-03', 'Convalescent sample', '{"serotype": "DENV-2", "IgG": "positive", "IgM": "positive"}'),
(40, (SELECT id FROM projects WHERE project_number = 15), (SELECT id FROM patients WHERE patient_number = 19), 'ZIKA-001-002', '2024-09-12', 'Blood', 'Serum', 'Freezer D-3-04', 'Serology follow-up', '{"IgM": "positive", "IgG": "equivocal"}');

-- ================================================================================
-- INVENTORY CATEGORIES
-- ================================================================================
INSERT INTO inventory_categories (category_name, description, default_unit) VALUES
('Molecular Biology', 'PCR reagents, primers, enzymes, and molecular biology supplies', 'reactions'),
('Cell Culture', 'Cell culture media, sera, antibiotics, and tissue culture supplies', 'bottles'),
('Virology', 'Viral transport media, cell lines, and virology-specific reagents', 'tubes'),
('Safety Equipment', 'PPE, disinfectants, and laboratory safety supplies', 'pieces'),
('Consumables', 'Pipette tips, tubes, and general lab consumables', 'boxes'),
('Reagents', 'General laboratory reagents and chemicals', 'bottles');

-- ================================================================================
-- INVENTORY (20 items)
-- ================================================================================
INSERT INTO inventory (name, category, supplier, catalog_number, lot_number, current_quantity, unit_of_measure, cost_per_unit, storage_location, expiration_date, minimum_stock_level, description) VALUES
('TaqMan Fast Virus 1-Step Master Mix', 'Molecular Biology', 'Applied Biosystems', '4444432', 'LOT240815', 100, 'reactions', 2.85, 'Freezer -20C A-1', '2025-08-15', 50, 'For COVID-19 RT-PCR assays'),
('COVID-19 N1/N2 Primer Set', 'Molecular Biology', 'IDT', 'Custom-COVID19', 'BATCH2024-08', 500, 'reactions', 0.75, 'Freezer -20C B-1', '2026-08-01', 100, 'CDC recommended sequences'),
('Viral Transport Medium', 'Virology', 'Hardy Diagnostics', 'R99', 'LOT240801', 200, 'tubes', 1.25, 'Cold Room Shelf B', '2024-11-01', 100, '3mL screw-cap tubes'),
('N95 Respirators', 'Safety Equipment', '3M', '8210', 'LOT240805', 500, 'pieces', 1.25, 'PPE Storage Room A', '2029-08-05', 200, 'NIOSH approved'),
('QIAamp Viral RNA Mini Kit', 'Molecular Biology', 'Qiagen', '52906', 'LOT240720', 48, 'preps', 8.50, 'Freezer -20C A-2', '2025-07-20', 24, 'RNA extraction kit'),
('PCR Tubes 0.2mL', 'Consumables', 'Eppendorf', '0030124.332', 'LOT240801', 5000, 'tubes', 0.08, 'Room Temperature Storage A', '2027-08-01', 1000, '8-strip tubes with caps'),
('Pipette Tips 200μL', 'Consumables', 'Rainin', 'RT-L200F', 'LOT240715', 9600, 'tips', 0.05, 'Room Temperature Storage B', '2028-07-15', 2000, 'Filtered pipette tips'),
('Ethanol 200 Proof', 'Reagents', 'Sigma-Aldrich', 'E7023', 'LOT240705', 4, 'liters', 75.00, 'Flammables Cabinet', '2026-07-05', 2, 'Molecular biology grade'),
('Blood Culture Bottles (Aerobic)', 'Consumables', 'BD', '442192', 'LOT240810', 100, 'bottles', 8.75, 'Room Temperature Storage C', '2025-08-10', 50, 'BacT/ALERT FA Plus'),
('Blood Culture Bottles (Anaerobic)', 'Consumables', 'BD', '442193', 'LOT240810', 100, 'bottles', 8.75, 'Room Temperature Storage C', '2025-08-10', 50, 'BacT/ALERT FN Plus'),
('Latex Gloves (Medium)', 'Safety Equipment', 'Kimberly-Clark', '55082', 'LOT240820', 10, 'boxes', 12.50, 'PPE Storage Room B', '2026-08-20', 5, 'Powder-free'),
('Latex Gloves (Large)', 'Safety Equipment', 'Kimberly-Clark', '55083', 'LOT240820', 10, 'boxes', 12.50, 'PPE Storage Room B', '2026-08-20', 5, 'Powder-free'),
('Influenza A/B RT-PCR Kit', 'Molecular Biology', 'Qiagen', '211752', 'LOT240725', 96, 'reactions', 5.25, 'Freezer -20C B-2', '2025-07-25', 48, 'Multiplex flu detection'),
('HIV Viral Load Kit', 'Molecular Biology', 'Roche', '05895286190', 'LOT240801', 48, 'tests', 45.00, 'Freezer -20C C-1', '2025-08-01', 24, 'COBAS AmpliPrep'),
('TB GeneXpert Cartridges', 'Molecular Biology', 'Cepheid', 'XPRMTB', 'LOT240715', 50, 'cartridges', 18.50, 'Room Temperature Storage D', '2025-07-15', 25, 'MTB/RIF detection'),
('Sterile Swabs', 'Consumables', 'Puritan', '25-806 1PD', 'LOT240805', 500, 'swabs', 0.35, 'Room Temperature Storage E', '2026-08-05', 200, 'Rayon tipped'),
('Cryovials 2mL', 'Consumables', 'Corning', '430488', 'LOT240720', 1000, 'vials', 0.45, 'Room Temperature Storage F', '2027-07-20', 200, 'External thread'),
('Nuclease-Free Water', 'Reagents', 'Invitrogen', 'AM9937', 'LOT240810', 5, 'bottles', 32.00, 'Room Temperature Storage G', '2026-08-10', 2, '500mL bottles'),
('Bleach 10% Solution', 'Safety Equipment', 'Clorox', 'CLX-68', 'LOT240901', 20, 'liters', 8.50, 'Chemical Storage', '2025-09-01', 10, 'For decontamination'),
('70% Ethanol Spray', 'Safety Equipment', 'VWR', '89125-188', 'LOT240815', 24, 'bottles', 12.00, 'Lab Bench Storage', '2025-08-15', 12, 'Surface disinfection');

-- ================================================================================
-- PROTOCOLS
-- ================================================================================
INSERT INTO protocols (protocol_id, name, version, is_active, description, required_reagents, basic_steps) VALUES
(1, 'COVID-19 RT-PCR Detection', '2.1', true, 'Real-time RT-PCR protocol for SARS-CoV-2 detection using N1/N2 targets',
 '[{"name": "TaqMan Fast Virus 1-Step Master Mix", "quantity": 10, "unit": "μL"}, {"name": "COVID-19 N1/N2 Primer Set", "quantity": 2, "unit": "μL"}]',
 'Mix reagents, add sample RNA, run thermal cycling program'),

(2, 'Viral RNA Extraction', '3.2', true, 'RNA extraction from clinical specimens using QIAamp kit',
 '[{"name": "QIAamp Viral RNA Mini Kit", "quantity": 1, "unit": "prep"}, {"name": "Ethanol 200 Proof", "quantity": 560, "unit": "μL"}]',
 'Lyse sample, bind RNA to column, wash, elute purified RNA'),

(3, 'Influenza A/B RT-PCR', '1.5', true, 'Multiplex RT-PCR for influenza A and B detection',
 '[{"name": "Influenza A/B RT-PCR Kit", "quantity": 1, "unit": "reaction"}]',
 'Extract RNA, prepare master mix, run RT-PCR protocol'),

(4, 'Blood Culture Processing', '2.0', true, 'Standard blood culture collection and processing protocol',
 '[{"name": "Blood Culture Bottles (Aerobic)", "quantity": 1, "unit": "bottle"}, {"name": "Blood Culture Bottles (Anaerobic)", "quantity": 1, "unit": "bottle"}]',
 'Collect blood aseptically, inoculate bottles, incubate in automated system'),

(5, 'TB GeneXpert Testing', '1.2', true, 'Rapid molecular detection of Mycobacterium tuberculosis and rifampin resistance',
 '[{"name": "TB GeneXpert Cartridges", "quantity": 1, "unit": "cartridge"}]',
 'Process sample, load cartridge, run GeneXpert protocol'),

(6, 'HIV Viral Load Testing', '2.3', true, 'Quantitative HIV-1 RNA detection',
 '[{"name": "HIV Viral Load Kit", "quantity": 1, "unit": "test"}]',
 'Extract viral RNA, amplify, quantify using real-time PCR');

-- ================================================================================
-- EXPERIMENTS
-- ================================================================================
INSERT INTO experiments (experiment_id, protocol_id, sample_ids, status, date_performed, notes) VALUES
(1, (SELECT id FROM protocols WHERE name = 'COVID-19 RT-PCR Detection'),
 ('["' || (SELECT id FROM specimens WHERE specimen_number = 1) || '"]')::jsonb,
 'completed', '2024-08-15',
 'High viral load detected. CT values: N1=22.4, N2=22.8'),

(2, (SELECT id FROM protocols WHERE name = 'Viral RNA Extraction'),
 ('["' || (SELECT id FROM specimens WHERE specimen_number = 5) || '", "' || (SELECT id FROM specimens WHERE specimen_number = 6) || '"]')::jsonb,
 'completed', '2024-08-10',
 'RNA extraction for influenza samples. Good yields obtained'),

(3, (SELECT id FROM protocols WHERE name = 'Influenza A/B RT-PCR'),
 ('["' || (SELECT id FROM specimens WHERE specimen_number = 5) || '"]')::jsonb,
 'completed', '2024-08-11',
 'Influenza A H3N2 detected. CT=26.3'),

(4, (SELECT id FROM protocols WHERE name = 'Blood Culture Processing'),
 ('["' || (SELECT id FROM specimens WHERE specimen_number = 15) || '"]')::jsonb,
 'completed', '2024-08-05',
 'Klebsiella pneumoniae isolated. Carbapenem resistant'),

(5, (SELECT id FROM protocols WHERE name = 'TB GeneXpert Testing'),
 ('["' || (SELECT id FROM specimens WHERE specimen_number = 24) || '"]')::jsonb,
 'completed', '2024-07-10',
 'MTB detected, rifampin resistance detected. High bacterial load'),

(6, (SELECT id FROM protocols WHERE name = 'HIV Viral Load Testing'),
 ('["' || (SELECT id FROM specimens WHERE specimen_number = 17) || '"]')::jsonb,
 'completed', '2024-07-25',
 'Viral load undetectable (<20 copies/mL). Treatment success');

COMMIT;
