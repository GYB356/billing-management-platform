import { SARIMAXModel } from './SARIMAXModel';
import { StatisticalUtils } from './StatisticalUtils';

interface ValidationMetrics {
  rmse: number;
  mae: number;
  mape: number;
  r2: number;
  adjustedR2: number;
  theilU: number;
  dw: number;  // Durbin-Watson statistic
}

interface CrossValidationResult {
  metrics: ValidationMetrics;
  foldResults: ValidationMetrics[];
  standardErrors: {
    rmse: number;
    mae: number;
    mape: number;
  };
}

export class ModelValidator {
  static crossValidate(
    model: SARIMAXModel,
    data: Array<{ timestamp: Date; value: number; exogenous?: Record<string, number> }>,
    options: {
      folds?: number;
      horizon?: number;
      rollingWindow?: boolean;
      expandingWindow?: boolean;
    } = {}
  ): CrossValidationResult {
    const {
      folds = 5,
      horizon = 1,
      rollingWindow = false,
      expandingWindow = false
    } = options;

    const n = data.length;
    const foldSize = Math.floor(n / folds);
    const foldResults: ValidationMetrics[] = [];

    for (let i = 0; i < folds; i++) {
      let trainData: typeof data;
      let testData: typeof data;

      if (rollingWindow) {
        // Rolling window validation
        const windowStart = i * foldSize;
        const windowEnd = windowStart + foldSize;
        trainData = data.slice(windowStart, windowEnd);
        testData = data.slice(windowEnd, windowEnd + horizon);
      } else if (expandingWindow) {
        // Expanding window validation
        trainData = data.slice(0, (i + 1) * foldSize);
        testData = data.slice((i + 1) * foldSize, (i + 1) * foldSize + horizon);
      } else {
        // Standard k-fold cross-validation
        testData = data.slice(i * foldSize, (i + 1) * foldSize);
        trainData = [
          ...data.slice(0, i * foldSize),
          ...data.slice((i + 1) * foldSize)
        ];
      }

      // Skip if not enough test data
      if (testData.length === 0) continue;

      // Create a new model instance with the same configuration
      const modelClone = Object.create(
        Object.getPrototypeOf(model),
        Object.getOwnPropertyDescriptors(model)
      );

      // Fit model and make predictions
      modelClone.fit(trainData);
      const predictions = modelClone.predict(testData.length).predictions;

      // Calculate metrics
      const metrics = this.calculateMetrics(
        testData.map(d => d.value),
        predictions,
        trainData.map(d => d.value)
      );
      foldResults.push(metrics);
    }

    // Calculate average metrics and standard errors
    const metrics = this.averageMetrics(foldResults);
    const standardErrors = this.calculateStandardErrors(foldResults);

    return {
      metrics,
      foldResults,
      standardErrors
    };
  }

  static validateResiduals(
    residuals: number[],
    predictions: number[],
    data: number[]
  ): {
    normalityTest: { statistic: number; pValue: number };
    heteroskedasticityTest: { statistic: number; pValue: number };
    autocorrelationTest: { statistic: number; pValue: number };
    outliers: Array<{ index: number; value: number; zscore: number }>;
  } {
    // Jarque-Bera test for normality
    const normalityTest = this.jarqueBera(residuals);

    // White test for heteroskedasticity
    const heteroskedasticityTest = this.whiteTest(residuals, predictions);

    // Ljung-Box test for autocorrelation
    const autocorrelationTest = this.ljungBox(residuals);

    // Detect outliers using z-score
    const outliers = this.detectOutliers(residuals);

    return {
      normalityTest,
      heteroskedasticityTest,
      autocorrelationTest,
      outliers
    };
  }

  static calculateMetrics(
    actual: number[],
    predicted: number[],
    trainData: number[]
  ): ValidationMetrics {
    const n = actual.length;
    const errors = actual.map((a, i) => a - predicted[i]);
    
    // Calculate basic error metrics
    const rmse = Math.sqrt(StatisticalUtils.mean(errors.map(e => e * e)));
    const mae = StatisticalUtils.mean(errors.map(e => Math.abs(e)));
    const mape = StatisticalUtils.mean(
      errors.map((e, i) => Math.abs(e / actual[i])) 
    ) * 100;

    // Calculate R-squared
    const actualMean = StatisticalUtils.mean(actual);
    const totalSS = StatisticalUtils.sum(
      actual.map(a => Math.pow(a - actualMean, 2))
    );
    const residualSS = StatisticalUtils.sum(
      errors.map(e => e * e)
    );
    const r2 = 1 - (residualSS / totalSS);

    // Calculate adjusted R-squared
    const p = trainData.length;  // number of parameters
    const adjustedR2 = 1 - ((1 - r2) * (n - 1) / (n - p - 1));

    // Calculate Theil's U statistic
    const theilU = Math.sqrt(StatisticalUtils.mean(errors.map(e => e * e))) /
      Math.sqrt(
        StatisticalUtils.mean(actual.map(a => a * a)) +
        StatisticalUtils.mean(predicted.map(p => p * p))
      );

    // Calculate Durbin-Watson statistic
    let dwNum = 0;
    for (let i = 1; i < errors.length; i++) {
      dwNum += Math.pow(errors[i] - errors[i - 1], 2);
    }
    const dw = dwNum / StatisticalUtils.sum(errors.map(e => e * e));

    return {
      rmse,
      mae,
      mape,
      r2,
      adjustedR2,
      theilU,
      dw
    };
  }

  private static averageMetrics(results: ValidationMetrics[]): ValidationMetrics {
    const n = results.length;
    return {
      rmse: StatisticalUtils.mean(results.map(r => r.rmse)),
      mae: StatisticalUtils.mean(results.map(r => r.mae)),
      mape: StatisticalUtils.mean(results.map(r => r.mape)),
      r2: StatisticalUtils.mean(results.map(r => r.r2)),
      adjustedR2: StatisticalUtils.mean(results.map(r => r.adjustedR2)),
      theilU: StatisticalUtils.mean(results.map(r => r.theilU)),
      dw: StatisticalUtils.mean(results.map(r => r.dw))
    };
  }

  private static calculateStandardErrors(results: ValidationMetrics[]): {
    rmse: number;
    mae: number;
    mape: number;
  } {
    const n = results.length;
    const metrics = this.averageMetrics(results);

    return {
      rmse: Math.sqrt(
        results.reduce((sum, r) => 
          sum + Math.pow(r.rmse - metrics.rmse, 2), 0
        ) / (n * (n - 1))
      ),
      mae: Math.sqrt(
        results.reduce((sum, r) => 
          sum + Math.pow(r.mae - metrics.mae, 2), 0
        ) / (n * (n - 1))
      ),
      mape: Math.sqrt(
        results.reduce((sum, r) => 
          sum + Math.pow(r.mape - metrics.mape, 2), 0
        ) / (n * (n - 1))
      )
    };
  }

  private static jarqueBera(residuals: number[]): { statistic: number; pValue: number } {
    const n = residuals.length;
    const skewness = StatisticalUtils.skewness(residuals);
    const kurtosis = StatisticalUtils.kurtosis(residuals);
    
    const statistic = n * (
      Math.pow(skewness, 2) / 6 + 
      Math.pow(kurtosis - 3, 2) / 24
    );
    
    // p-value from chi-square distribution with 2 df
    const pValue = 1 - StatisticalUtils.chiSquareCDF(statistic, 2);
    
    return { statistic, pValue };
  }

  private static whiteTest(
    residuals: number[],
    predictions: number[]
  ): { statistic: number; pValue: number } {
    const n = residuals.length;
    const squaredResiduals = residuals.map(r => r * r);
    
    // Fit regression of squared residuals on predictions and their squares
    const X = predictions.map(p => [1, p, p * p]);
    const y = squaredResiduals;
    
    // Calculate R-squared of this regression
    const { r2 } = this.fitOLS(X, y);
    
    // Test statistic is n*R^2
    const statistic = n * r2;
    
    // p-value from chi-square distribution with 2 df (number of regressors - 1)
    const pValue = 1 - StatisticalUtils.chiSquareCDF(statistic, 2);
    
    return { statistic, pValue };
  }

  private static ljungBox(residuals: number[]): { statistic: number; pValue: number } {
    const n = residuals.length;
    const maxLag = Math.min(20, Math.floor(n / 5));
    const acf = StatisticalUtils.acf(residuals, maxLag);
    
    // Calculate test statistic
    let statistic = 0;
    for (let k = 1; k <= maxLag; k++) {
      statistic += Math.pow(acf[k], 2) / (n - k);
    }
    statistic = n * (n + 2) * statistic;
    
    // p-value from chi-square distribution with maxLag df
    const pValue = 1 - StatisticalUtils.chiSquareCDF(statistic, maxLag);
    
    return { statistic, pValue };
  }

  private static detectOutliers(
    residuals: number[]
  ): Array<{ index: number; value: number; zscore: number }> {
    const mean = StatisticalUtils.mean(residuals);
    const std = StatisticalUtils.standardDeviation(residuals);
    const threshold = 3;  // 3 sigma rule
    
    return residuals
      .map((r, i) => {
        const zscore = Math.abs((r - mean) / std);
        return { index: i, value: r, zscore };
      })
      .filter(({ zscore }) => zscore > threshold)
      .sort((a, b) => b.zscore - a.zscore);
  }

  private static fitOLS(X: number[][], y: number[]): {
    coefficients: number[];
    r2: number;
  } {
    const n = X.length;
    const p = X[0].length;
    
    // Calculate (X'X)^(-1)X'y
    const Xt = this.transpose(X);
    const XtX = this.multiply(Xt, X);
    const XtXInv = this.inverse(XtX);
    const Xty = this.multiply(Xt, [y])[0];
    
    const coefficients = this.multiply([XtXInv[0]], [[Xty[0]]])[0];
    
    // Calculate R-squared
    const yHat = this.multiply(X, [[...coefficients]])[0];
    const yMean = StatisticalUtils.mean(y);
    const totalSS = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const residualSS = y.reduce((sum, yi, i) => 
      sum + Math.pow(yi - yHat[i], 2), 0
    );
    const r2 = 1 - (residualSS / totalSS);
    
    return { coefficients, r2 };
  }

  private static transpose(matrix: number[][]): number[][] {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
  }

  private static multiply(a: number[][], b: number[][]): number[][] {
    return a.map(row => 
      b[0].map((_, j) => 
        row.reduce((sum, val, i) => sum + val * b[i][j], 0)
      )
    );
  }

  private static inverse(matrix: number[][]): number[][] {
    const n = matrix.length;
    const augmented = matrix.map((row, i) => [
      ...row,
      ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
    ]);
    
    // Gaussian elimination
    for (let i = 0; i < n; i++) {
      const pivot = augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot;
      }
      
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }
    
    return augmented.map(row => row.slice(n));
  }
} 