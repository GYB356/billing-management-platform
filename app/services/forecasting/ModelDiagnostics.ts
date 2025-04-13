import { StatisticalUtils } from './StatisticalUtils';

interface RollingMetrics {
  window: {
    start: Date;
    end: Date;
  };
  metrics: {
    mape: number;
    rmse: number;
    mae: number;
    r2: number;
  };
  parameters?: Record<string, number>;
}

interface CrossValidationResult {
  fold: number;
  trainMetrics: {
    mape: number;
    rmse: number;
    mae: number;
    r2: number;
  };
  testMetrics: {
    mape: number;
    rmse: number;
    mae: number;
    r2: number;
  };
  parameters?: Record<string, number>;
}

export class ModelDiagnostics {
  static performRollingWindowAnalysis(
    data: Array<{ timestamp: Date; value: number }>,
    windowSize: number,
    step: number,
    modelFitFn: (trainData: typeof data) => any,
    predictFn: (model: any, horizon: number) => number[]
  ): RollingMetrics[] {
    const results: RollingMetrics[] = [];
    
    for (let i = 0; i <= data.length - windowSize; i += step) {
      const windowData = data.slice(i, i + windowSize);
      const model = modelFitFn(windowData.slice(0, -1));
      const predictions = predictFn(model, 1);
      
      const actual = windowData[windowData.length - 1].value;
      const predicted = predictions[0];
      
      results.push({
        window: {
          start: windowData[0].timestamp,
          end: windowData[windowData.length - 1].timestamp
        },
        metrics: {
          mape: Math.abs((actual - predicted) / actual) * 100,
          rmse: Math.sqrt(Math.pow(actual - predicted, 2)),
          mae: Math.abs(actual - predicted),
          r2: this.calculateR2([actual], [predicted])
        },
        parameters: model.parameters
      });
    }
    
    return results;
  }

  static performCrossValidation(
    data: Array<{ timestamp: Date; value: number }>,
    numFolds: number,
    modelFitFn: (trainData: typeof data) => any,
    predictFn: (model: any, horizon: number) => number[]
  ): CrossValidationResult[] {
    const results: CrossValidationResult[] = [];
    const foldSize = Math.floor(data.length / numFolds);
    
    for (let i = 0; i < numFolds; i++) {
      const testStart = i * foldSize;
      const testEnd = testStart + foldSize;
      
      const trainData = [
        ...data.slice(0, testStart),
        ...data.slice(testEnd)
      ];
      const testData = data.slice(testStart, testEnd);
      
      const model = modelFitFn(trainData);
      const trainPredictions = predictFn(model, trainData.length);
      const testPredictions = predictFn(model, testData.length);
      
      results.push({
        fold: i + 1,
        trainMetrics: this.calculateMetrics(
          trainData.map(d => d.value),
          trainPredictions
        ),
        testMetrics: this.calculateMetrics(
          testData.map(d => d.value),
          testPredictions
        ),
        parameters: model.parameters
      });
    }
    
    return results;
  }

  static calculateParameterStability(rollingMetrics: RollingMetrics[]): Record<string, number> {
    const parameterNames = Object.keys(rollingMetrics[0].parameters || {});
    const stability: Record<string, number> = {};
    
    for (const param of parameterNames) {
      const values = rollingMetrics.map(m => m.parameters?.[param] || 0);
      stability[param] = this.calculateCoeffientOfVariation(values);
    }
    
    return stability;
  }

  private static calculateR2(actual: number[], predicted: number[]): number {
    const actualMean = actual.reduce((a, b) => a + b, 0) / actual.length;
    const totalSS = actual.reduce((a, b) => a + Math.pow(b - actualMean, 2), 0);
    const residualSS = actual.reduce((a, b, i) => a + Math.pow(b - predicted[i], 2), 0);
    return 1 - (residualSS / totalSS);
  }

  private static calculateMetrics(actual: number[], predicted: number[]) {
    return {
      mape: this.calculateMAPE(actual, predicted),
      rmse: this.calculateRMSE(actual, predicted),
      mae: this.calculateMAE(actual, predicted),
      r2: this.calculateR2(actual, predicted)
    };
  }

  private static calculateMAPE(actual: number[], predicted: number[]): number {
    return (actual.reduce((sum, val, i) => 
      sum + Math.abs((val - predicted[i]) / val), 0
    ) / actual.length) * 100;
  }

  private static calculateRMSE(actual: number[], predicted: number[]): number {
    return Math.sqrt(
      actual.reduce((sum, val, i) => 
        sum + Math.pow(val - predicted[i], 2), 0
      ) / actual.length
    );
  }

  private static calculateMAE(actual: number[], predicted: number[]): number {
    return actual.reduce((sum, val, i) => 
      sum + Math.abs(val - predicted[i]), 0
    ) / actual.length;
  }

  private static calculateCoeffientOfVariation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }
} 