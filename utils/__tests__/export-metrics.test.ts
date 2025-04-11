import { exportMetricsAsCSV, exportMetricsAsPDF } from '../export-metrics';

describe('Export Metrics Utility', () => {
  const mockMetrics = [
    { mrr: 1000, activeSubscriptions: 50, ltv: 200 },
    { mrr: 2000, activeSubscriptions: 100, ltv: 300 },
  ];

  it('should export metrics as CSV', () => {
    const createElementSpy = jest.spyOn(document, 'createElement');
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');

    exportMetricsAsCSV(mockMetrics, 'test-metrics.csv');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });

  it('should export metrics as PDF', () => {
    const saveSpy = jest.fn();
    jest.mock('jspdf', () => {
      return jest.fn().mockImplementation(() => ({
        autoTable: jest.fn(),
        save: saveSpy,
      }));
    });

    exportMetricsAsPDF(mockMetrics, 'test-metrics.pdf');
    expect(saveSpy).toHaveBeenCalledWith('test-metrics.pdf');
  });
});