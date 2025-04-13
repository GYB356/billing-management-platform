import { SARIMAModel } from '../SARIMAModel';

describe('SARIMAModel', () => {
  // Test data generation helper
  const generateTestData = (n: number, seasonality: number = 7) => {
    const data: Array<{ timestamp: Date; value: number }> = [];
    let value = 100;
    
    for (let i = 0; i < n; i++) {
      // Add trend
      value += 0.1;
      
      // Add seasonality
      value += 10 * Math.sin(2 * Math.PI * (i % seasonality) / seasonality);
      
      // Add noise
      value += (Math.random() - 0.5) * 5;
      
      data.push({
        timestamp: new Date(2024, 0, 1 + i),
        value
      });
    }
    
    return data;
  };

  describe('Model Initialization', () => {
    it('should create model with valid configuration', () => {
      const model = new SARIMAModel({
        order: [1, 1, 1],
        seasonalOrders: [{
          order: [1, 1, 1],
          period: 7
        }]
      });
      
      expect(model).toBeDefined();
    });

    it('should throw error for invalid orders', () => {
      expect(() => new SARIMAModel({
        order: [-1, 1, 1],
        seasonalOrders: []
      })).toThrow();
    });
  });

  describe('Model Fitting', () => {
    const testData = generateTestData(100);
    let model: SARIMAModel;

    beforeEach(() => {
      model = new SARIMAModel({
        order: [1, 1, 1],
        seasonalOrders: [{
          order: [1, 1, 1],
          period: 7
        }]
      });
    });

    it('should fit model to data without errors', () => {
      expect(() => model.fit(testData)).not.toThrow();
    });

    it('should calculate reasonable parameters', () => {
      model.fit(testData);
      const params = model.getParameters();
      
      // Check if parameters exist
      expect(Object.keys(params).length).toBeGreaterThan(0);
      
      // Check if parameters are within reasonable bounds
      Object.values(params).forEach(param => {
        expect(Math.abs(param)).toBeLessThan(10);
      });
    });

    it('should handle missing values gracefully', () => {
      const dataWithMissing = [...testData];
      dataWithMissing[5].value = NaN;
      
      expect(() => model.fit(dataWithMissing)).not.toThrow();
    });
  });

  describe('Model Prediction', () => {
    const testData = generateTestData(100);
    let model: SARIMAModel;

    beforeEach(() => {
      model = new SARIMAModel({
        order: [1, 1, 1],
        seasonalOrders: [{
          order: [1, 1, 1],
          period: 7
        }]
      });
      model.fit(testData);
    });

    it('should generate predictions for future periods', () => {
      const horizon = 10;
      const predictions = model.predict(horizon);
      
      expect(predictions).toHaveLength(horizon);
      predictions.forEach(pred => {
        expect(typeof pred).toBe('number');
        expect(isNaN(pred)).toBe(false);
      });
    });

    it('should maintain seasonal patterns in predictions', () => {
      const horizon = 14;
      const predictions = model.predict(horizon);
      
      // Check if weekly pattern is preserved
      const weekDiffs = [];
      for (let i = 7; i < horizon; i++) {
        weekDiffs.push(Math.abs(predictions[i] - predictions[i - 7]));
      }
      
      // Weekly differences should be relatively small
      const avgWeekDiff = weekDiffs.reduce((a, b) => a + b, 0) / weekDiffs.length;
      expect(avgWeekDiff).toBeLessThan(20);
    });

    it('should handle long forecast horizons', () => {
      const horizon = 100;
      const predictions = model.predict(horizon);
      
      expect(predictions).toHaveLength(horizon);
      predictions.forEach(pred => {
        expect(isFinite(pred)).toBe(true);
      });
    });
  });

  describe('Model Diagnostics', () => {
    const testData = generateTestData(100);
    let model: SARIMAModel;

    beforeEach(() => {
      model = new SARIMAModel({
        order: [1, 1, 1],
        seasonalOrders: [{
          order: [1, 1, 1],
          period: 7
        }]
      });
      model.fit(testData);
    });

    it('should calculate reasonable residuals', () => {
      const diagnostics = model.getDiagnostics();
      const { residualStats } = diagnostics;
      
      // Check residual properties
      expect(Math.abs(residualStats.mean)).toBeLessThan(1);
      expect(residualStats.variance).toBeGreaterThan(0);
      
      // Check for approximate normality
      expect(Math.abs(residualStats.skewness)).toBeLessThan(2);
      expect(Math.abs(residualStats.kurtosis)).toBeLessThan(6);
    });

    it('should calculate information criteria', () => {
      const diagnostics = model.getDiagnostics();
      
      expect(diagnostics.aic).toBeGreaterThan(0);
      expect(diagnostics.bic).toBeGreaterThan(0);
      expect(diagnostics.bic).toBeGreaterThan(diagnostics.aic);
    });

    it('should provide parameter significance tests', () => {
      const diagnostics = model.getDiagnostics();
      
      diagnostics.parameterStats.forEach(stat => {
        expect(stat.standardError).toBeGreaterThan(0);
        expect(stat.pValue).toBeGreaterThanOrEqual(0);
        expect(stat.pValue).toBeLessThanOrEqual(1);
      });
    });
  });
}); 