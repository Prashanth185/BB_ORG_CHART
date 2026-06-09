/**
 * excelTemplate.js
 *
 * Generates and downloads a pre-formatted Excel template for the
 * Traditional Org Chart import feature.
 *
 * Uses SheetJS (xlsx) — already installed in client dependencies.
 */

import * as XLSX from 'xlsx';

/** Column headers exactly as expected by the server import endpoint */
const HEADERS = [
  'Employee ID',
  'Employee Name',
  'Designation',
  'Department',
  'Reports To Employee ID',
];

/** Sample rows shown in the template so users understand the format */
const SAMPLE_ROWS = [
  ['EMP001', 'Prabhu Sankar',  'Director',            'Management', ''],
  ['EMP002', 'Prem Selvaraj',  'Associate Director',  'PTD',        'EMP001'],
  ['EMP003', 'Jay Kumar',      'Associate Director',  'PTD',        'EMP001'],
  ['EMP004', 'Min',            'Engineer',            'PTD',        'EMP002'],
  ['EMP005', 'Van',            'Engineer',            'PTD',        'EMP002'],
  ['EMP006', 'Nan',            'Engineer',            'PTD',        'EMP002'],
  ['EMP007', 'Pras',           'Engineer',            'PTD',        'EMP003'],
  ['EMP008', 'Nan2',           'Engineer',            'PTD',        'EMP003'],
  ['EMP009', 'RA',             'Engineer',            'PTD',        'EMP005'],
  ['EMP010', 'PA',             'Engineer',            'PTD',        'EMP005'],
  ['EMP011', 'SAS',            'Engineer',            'PTD',        'EMP008'],
];

export function downloadExcelTemplate(filename = 'org-chart-import-template.xlsx') {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Template ──────────────────────────────────────────────────
  const templateData = [HEADERS, ...SAMPLE_ROWS];
  const ws = XLSX.utils.aoa_to_sheet(templateData);

  // Column widths
  ws['!cols'] = [
    { wch: 14 }, // Employee ID
    { wch: 24 }, // Employee Name
    { wch: 26 }, // Designation
    { wch: 20 }, // Department
    { wch: 24 }, // Reports To Employee ID
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Employee Data');

  // ── Sheet 2: Instructions ──────────────────────────────────────────────
  const instructions = [
    ['IMPORT INSTRUCTIONS'],
    [''],
    ['1. Fill in the "Employee Data" sheet with your employee records.'],
    ['2. Employee ID must be unique for each employee.'],
    ['3. Leave "Reports To Employee ID" blank for root/top-level employees (CEO, Director).'],
    ['4. "Reports To Employee ID" must match an existing Employee ID in this file.'],
    ['5. Save as .xlsx or .xls format.'],
    ['6. Upload in the Traditional Org Chart → Import From Excel.'],
    [''],
    ['COLUMN DESCRIPTIONS'],
    ['Employee ID', 'Unique identifier (e.g. EMP001, E-1234)'],
    ['Employee Name', 'Full name of the employee'],
    ['Designation', 'Job title (e.g. Director, Engineer, Manager)'],
    ['Department', 'Department name (e.g. PTD, HR, Finance)'],
    ['Reports To Employee ID', 'Employee ID of the direct manager. Leave blank for root nodes.'],
    [''],
    ['NOTES'],
    ['- Maximum supported: 20,000+ employees'],
    ['- Duplicate Employee IDs will be rejected'],
    ['- Circular reporting relationships will be detected and rejected'],
    ['- Invalid manager references will be flagged'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  wsInstr['!cols'] = [{ wch: 36 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  XLSX.writeFile(wb, filename);
}
