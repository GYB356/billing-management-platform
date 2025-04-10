import { parse } from 'papaparse';
import { stringify } from 'csv-stringify/sync';

interface CSVOptions {
  header?: boolean;
  skipEmptyLines?: boolean;
  delimiter?: string;
  columns?: string[];
}

/**
 * Export data to CSV format
 * @param data Array of objects to export
 * @param options CSV formatting options
 * @returns CSV string
 */
export function exportToCSV(data: any[], options: CSVOptions = {}) {
  const defaultOptions = {
    header: true,
    delimiter: ',',
    ...options
  };

  return stringify(data, defaultOptions);
}

/**
 * Import data from CSV buffer
 * @param file Buffer containing CSV data
 * @param options CSV parsing options
 * @returns Parsed data array
 */
export async function importFromCSV(file: Buffer, options: CSVOptions = {}) {
  const defaultOptions = {
    header: true,
    skipEmptyLines: true,
    ...options
  };

  return new Promise((resolve, reject) => {
    parse(file.toString(), {
      ...defaultOptions,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error)
    });
  });
}

/**
 * Transform an array of objects to CSV format with custom column mapping
 * @param data Array of objects to transform
 * @param columnMap Object mapping source keys to CSV column headers
 * @returns CSV string
 */
export function transformToCSV(data: any[], columnMap: Record<string, string>) {
  const transformedData = data.map(item => {
    const transformed: Record<string, any> = {};
    for (const [key, header] of Object.entries(columnMap)) {
      transformed[header] = item[key];
    }
    return transformed;
  });

  return exportToCSV(transformedData);
}

/**
 * Validate CSV data against a schema
 * @param data Parsed CSV data
 * @param schema Object describing expected columns and their types
 * @returns Array of validation errors, empty if valid
 */
export function validateCSV(data: any[], schema: Record<string, string>): string[] {
  const errors: string[] = [];

  data.forEach((row, index) => {
    for (const [column, type] of Object.entries(schema)) {
      const value = row[column];
      
      if (value === undefined || value === '') {
        errors.push(`Row ${index + 1}: Missing required value for column "${column}"`);
        continue;
      }

      switch (type) {
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`Row ${index + 1}: Invalid number in column "${column}": ${value}`);
          }
          break;
        case 'date':
          if (isNaN(Date.parse(value))) {
            errors.push(`Row ${index + 1}: Invalid date in column "${column}": ${value}`);
          }
          break;
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`Row ${index + 1}: Invalid email in column "${column}": ${value}`);
          }
          break;
      }
    }
  });

  return errors;
}