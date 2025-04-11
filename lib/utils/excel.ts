import ExcelJS from 'exceljs';

/**
 * Converts JSON data to Excel file buffer
 * @param data Array of objects to convert to Excel
 * @param sheetName Name of the worksheet
 * @returns Buffer containing Excel file
 */
export async function jsonToExcel(data: any[], sheetName = 'Sheet1'): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  
  // Add headers if data exists
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
  }
  
  // Add data rows
  data.forEach(item => {
    const row = Object.values(item);
    worksheet.addRow(row);
  });
  
  // Apply some styling
  worksheet.getRow(1).font = { bold: true };
  worksheet.columns.forEach(column => {
    column.width = 20;
  });
  
  // Write to buffer
  return await workbook.xlsx.writeBuffer();
}

/**
 * Reads data from Excel file buffer
 * @param buffer Excel file buffer
 * @returns Promise resolving to array of objects from Excel
 */
export async function excelToJson(buffer: Buffer): Promise<any[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.worksheets[0];
  const jsonData: any[] = [];
  
  // Get headers from first row
  const headers: string[] = [];
  worksheet.getRow(1).eachCell((cell) => {
    headers.push(cell.value?.toString() || '');
  });
  
  // Get data from remaining rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // Skip header row
      const rowData: Record<string, any> = {};
      row.eachCell((cell, colNumber) => {
        rowData[headers[colNumber - 1]] = cell.value;
      });
      jsonData.push(rowData);
    }
  });
  
  return jsonData;
}
