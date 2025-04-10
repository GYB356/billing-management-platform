import { jsonToExcel, excelToJson } from '../utils/excel';

// Function to generate Excel file from JSON data
async function generateExcelReport(data: any): Promise<Buffer> {
  const excelBuffer = await jsonToExcel(data, 'Report');
  return excelBuffer;
}

// Function to parse Excel file into JSON data
async function parseExcelFile(excelBuffer: Buffer): Promise<any> {
  const jsonData = await excelToJson(excelBuffer);
  return jsonData;
}

export { generateExcelReport, parseExcelFile };