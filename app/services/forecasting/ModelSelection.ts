import { SARIMAXModel } from './SARIMAXModel';
import { StatisticalUtils } from './StatisticalUtils';
import { ModelOptimizer } from './ModelOptimizer';
import { ModelValidator } from './ModelValidator';

interface ModelConfig {
  order: [number, number, number];
  seasonalOrders: Array<{
    order: [number, number, number];
    period: number;
  }>;
}

interface ModelEvaluation {
  config: ModelConfig;
  aic: number;
  bic: number;
  aicc: number;
  hqic: number;  // Hannan-Quinn Information Criterion
  fpe: number;   // Final Prediction Error
  mallowsCp: number;  // Mallows' Cp statistic
  rmse: number;
  mae: number;
  mape: number;
  seasonalityTest: {
    statistic: number;
    pValue: number;
  };
  stationarityTest: {
    statistic: number;
    pValue: number;
  };
  crossValidation?: {
    rmse: number;
    mae: number;
    mape: number;
    standardErrors: {
      rmse: number;
      mae: number;
      mape: number;
    };
  };
}

export class ModelSelection {
  static async findBestModel(
    data: Array<{ timestamp: Date; value: number; exogenous?: Record<string, number> }>,
    options: {
      maxOrder?: number;
      maxSeasonalOrder?: number;
      seasonalPeriods?: number[];
      crossValidationFolds?: number;
      parallel?: boolean;
      criterion?: 'aic' | 'bic' | 'aicc' | 'cv';
    } = {}
  ): Promise<{
    bestModel: SARIMAXModel;
    evaluation: ModelEvaluation;
    searchResults: ModelEvaluation[];
  }> {
    const defaultOptions = {
      maxOrder: 3,
      maxSeasonalOrder: 2,
      seasonalPeriods: this.detectSeasonalPeriods(data.map(d => d.value)),
      crossValidationFolds: 5,
      parallel: true,
      criterion: 'aic' as const
    };

    const opts = { ...defaultOptions, ...options };
    const candidateConfigs = this.generateCandidateConfigs(opts);
    
    // Evaluate all candidate models
    const evaluations = await this.evaluateModels(
      data,
      candidateConfigs,
      opts
    );

    // Sort by selected criterion
    evaluations.sort((a, b) => {
      if (opts.criterion === 'cv') {
        return a.rmse - b.rmse;
      }
      return a[opts.criterion] - b[opts.criterion];
    });

    // Create and fit best model
    const bestConfig = evaluations[0].config;
    const bestModel = new SARIMAXModel(bestConfig);
    bestModel.fit(data);

    return {
      bestModel,
      evaluation: evaluations[0],
      searchResults: evaluations
    };
  }

  private static detectSeasonalPeriods(values: number[]): number[] {
    const maxLag = Math.min(Math.floor(values.length / 4), 365);
    const acf = StatisticalUtils.acf(values, maxLag);
    
    // Find peaks in ACF
    const peaks = this.findPeaks(acf);
    
    // Filter significant peaks and sort by period
    const significantPeaks = peaks
      .filter(p => p.value > 1.96 / Math.sqrt(values.length))
      .map(p => p.index)
      .filter(i => i > 1)
      .sort((a, b) => a - b);

    return significantPeaks.slice(0, 2);  // Return up to 2 seasonal periods
  }

  private static findPeaks(data: number[]): Array<{ index: number; value: number }> {
    const peaks: Array<{ index: number; value: number }> = [];
    
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        peaks.push({ index: i, value: data[i] });
      }
    }

    return peaks.sort((a, b) => b.value - a.value);
  }

  private static generateCandidateConfigs(
    options: Required<{
      maxOrder: number;
      maxSeasonalOrder: number;
      seasonalPeriods: number[];
    }>
  ): ModelConfig[] {
    const configs: ModelConfig[] = [];
    
    // Generate non-seasonal orders (p, d, q)
    for (let p = 0; p <= options.maxOrder; p++) {
      for (let d = 0; d <= 2; d++) {
        for (let q = 0; q <= options.maxOrder; q++) {
          // Generate seasonal orders for each period
          const seasonalCombinations = this.generateSeasonalCombinations(
            options.seasonalPeriods,
            options.maxSeasonalOrder
          );

          seasonalCombinations.forEach(seasonalOrders => {
            configs.push({
              order: [p, d, q],
              seasonalOrders
            });
          });
        }
      }
    }

    return configs;
  }

  private static generateSeasonalCombinations(
    periods: number[],
    maxOrder: number
  ): Array<Array<{ order: [number, number, number]; period: number }>> {
    const combinations: Array<Array<{ order: [number, number, number]; period: number }>> = [[]];
    
    periods.forEach(period => {
      const newCombinations: Array<Array<{ order: [number, number, number]; period: number }>> = [];
      
      combinations.forEach(existing => {
        for (let P = 0; P <= maxOrder; P++) {
          for (let D = 0; D <= 1; D++) {
            for (let Q = 0; Q <= maxOrder; Q++) {
              newCombinations.push([
                ...existing,
                { order: [P, D, Q], period }
              ]);
            }
          }
        }
      });
      
      combinations.push(...newCombinations);
    });

    return combinations;
  }

  private static async evaluateModels(
    data: Array<{ timestamp: Date; value: number; exogenous?: Record<string, number> }>,
    configs: ModelConfig[],
    options: Required<{
      crossValidationFolds: number;
      parallel: boolean;
      criterion: 'aic' | 'bic' | 'aicc' | 'cv';
    }>
  ): Promise<ModelEvaluation[]> {
    const evaluations: ModelEvaluation[] = [];
    
    const evaluateConfig = async (config: ModelConfig): Promise<ModelEvaluation> => {
      const model = new SARIMAXModel(config);
      
      if (options.criterion === 'cv') {
        // Perform cross-validation
        const cvResult = ModelValidator.crossValidate(
          model,
          data,
          { folds: options.crossValidationFolds }
        );
        
        return {
          config,
          aic: Infinity,  // Not used for CV
          bic: Infinity,  // Not used for CV
          aicc: Infinity, // Not used for CV
          hqic: Infinity, // Not used for CV
          fpe: Infinity,  // Not used for CV
          mallowsCp: Infinity, // Not used for CV
          rmse: cvResult.metrics.rmse,
          mae: cvResult.metrics.mae,
          mape: cvResult.metrics.mape,
          ...this.testSeasonalityAndStationarity(data.map(d => d.value)),
          crossValidation: {
            rmse: cvResult.metrics.rmse,
            mae: cvResult.metrics.mae,
            mape: cvResult.metrics.mape,
            standardErrors: {
              rmse: cvResult.standardErrors.rmse,
              mae: cvResult.standardErrors.mae,
              mape: cvResult.standardErrors.mape
            }
          }
        };
      } else {
        // Fit model and get information criteria
        model.fit(data);
        const diagnostics = model.getDiagnostics(data);
        const predictions = model.predict(data.length).predictions;
        
        return {
          config,
          ...diagnostics.modelSelection,
          rmse: ModelValidator.calculateMetrics(
            data.map(d => d.value),
            predictions,
            data.map(d => d.value)
          ).rmse,
          mae: ModelValidator.calculateMetrics(
            data.map(d => d.value),
            predictions,
            data.map(d => d.value)
          ).mae,
          mape: ModelValidator.calculateMetrics(
            data.map(d => d.value),
            predictions,
            data.map(d => d.value)
          ).mape,
          ...this.testSeasonalityAndStationarity(data.map(d => d.value))
        };
      }
    };

    if (options.parallel) {
      // Evaluate configs in parallel batches
      const batchSize = 4;
      for (let i = 0; i < configs.length; i += batchSize) {
        const batch = configs.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(config => evaluateConfig(config))
        );
        evaluations.push(...results);
      }
    } else {
      // Evaluate configs sequentially
      for (const config of configs) {
        const evaluation = await evaluateConfig(config);
        evaluations.push(evaluation);
      }
    }

    return evaluations;
  }

  private static testSeasonalityAndStationarity(values: number[]): {
    seasonalityTest: { statistic: number; pValue: number };
    stationarityTest: { statistic: number; pValue: number };
  } {
    // Kruskal-Wallis test for seasonality
    const seasonalityTest = this.kruskalWallisTest(values);
    
    // Augmented Dickey-Fuller test for stationarity
    const stationarityTest = this.adfTest(values);

    return {
      seasonalityTest,
      stationarityTest
    };
  }

  private static kruskalWallisTest(values: number[]): { statistic: number; pValue: number } {
    // Implementation of Kruskal-Wallis test for seasonality
    // This is a simplified version
    const n = values.length;
    const ranks = this.calculateRanks(values);
    const seasonGroups = this.groupBySeasonality(ranks);
    
    const H = this.calculateKWStatistic(seasonGroups, n);
    const df = seasonGroups.length - 1;
    const pValue = 1 - StatisticalUtils.chiSquareCDF(H, df);

    return { statistic: H, pValue };
  }

  private static adfTest(values: number[]): { statistic: number; pValue: number } {
    // Implementation of Augmented Dickey-Fuller test
    // This is a simplified version
    const n = values.length;
    const diffs = values.slice(1).map((v, i) => v - values[i]);
    const lags = diffs.slice(0, -1);
    const y = diffs.slice(1);
    
    // Fit regression model
    const X = this.createDesignMatrix(lags);
    const beta = this.olsEstimate(X, y);
    const residuals = this.calculateResiduals(y, X, beta);
    
    // Calculate test statistic
    const se = Math.sqrt(StatisticalUtils.variance(residuals));
    const statistic = beta[0] / se;
    
    // Approximate p-value using normal distribution
    // (In practice, you'd use proper ADF critical values)
    const pValue = 2 * (1 - StatisticalUtils.normalCDF(Math.abs(statistic)));

    return { statistic, pValue };
  }

  private static calculateRanks(values: number[]): number[] {
    const indexed = values.map((v, i) => ({ value: v, index: i }));
    indexed.sort((a, b) => a.value - b.value);
    
    const ranks = new Array(values.length);
    for (let i = 0; i < indexed.length; i++) {
      ranks[indexed[i].index] = i + 1;
    }
    
    return ranks;
  }

  private static groupBySeasonality(values: number[]): number[][] {
    // Group values by potential seasonal periods
    const periods = this.detectSeasonalPeriods(values);
    const groups: number[][] = Array.from(
      { length: Math.max(...periods) },
      () => []
    );
    
    values.forEach((v, i) => {
      groups[i % groups.length].push(v);
    });
    
    return groups;
  }

  private static calculateKWStatistic(groups: number[][], n: number): number {
    const rankSum = groups.map(g => 
      g.reduce((sum, r) => sum + r, 0)
    );
    
    const H = (12 / (n * (n + 1))) * 
      groups.reduce((sum, g, i) => 
        sum + Math.pow(rankSum[i], 2) / g.length, 0
      ) - 3 * (n + 1);
    
    return H;
  }

  private static createDesignMatrix(x: number[]): number[][] {
    return x.map(xi => [1, xi]);  // Include intercept
  }

  private static olsEstimate(X: number[][], y: number[]): number[] {
    // Simple OLS implementation for ADF test
    const Xt = this.transpose(X);
    const XtX = this.matrixMultiply(Xt, X);
    const XtXInv = this.inverse2x2(XtX);
    const Xty = this.matrixMultiply(Xt, [y])[0];
    
    return this.matrixMultiply([XtXInv[0], XtXInv[1]], [[Xty[0]], [Xty[1]]])[0];
  }

  private static calculateResiduals(
    y: number[],
    X: number[][],
    beta: number[]
  ): number[] {
    return y.map((yi, i) => 
      yi - (beta[0] + beta[1] * X[i][1])
    );
  }

  private static transpose(matrix: number[][]): number[][] {
    return matrix[0].map((_, i) => 
      matrix.map(row => row[i])
    );
  }

  private static matrixMultiply(a: number[][], b: number[][]): number[][] {
    return a.map(row => 
      b[0].map((_, j) => 
        row.reduce((sum, val, i) => sum + val * b[i][j], 0)
      )
    );
  }

  private static inverse2x2(matrix: number[][]): number[][] {
    const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    return [
      [matrix[1][1] / det, -matrix[0][1] / det],
      [-matrix[1][0] / det, matrix[0][0] / det]
    ];
  }
} 