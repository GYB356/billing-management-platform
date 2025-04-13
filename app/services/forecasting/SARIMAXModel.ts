import { StatisticalUtils } from './StatisticalUtils';
import { TimeSeriesPlots } from './visualization/TimeSeriesPlots';

interface SARIMAXConfig {
  order: [number, number, number];  // (p, d, q)
  seasonalOrders: Array<{
    order: [number, number, number];  // (P, D, Q)
    period: number;  // s
  }>;
  exogenousVariables?: string[];  // Names of exogenous variables
  tolerance?: number;
  maxIterations?: number;
}

interface ModelSelectionCriteria {
  aic: number;      // Akaike Information Criterion
  bic: number;      // Bayesian Information Criterion
  hqic: number;     // Hannan-Quinn Information Criterion
  aicc: number;     // Corrected Akaike Information Criterion
  mallowsCp: number;// Mallows' Cp Statistic
  fpe: number;      // Final Prediction Error
}

interface DiagnosticResults {
  modelSelection: ModelSelectionCriteria;
  residualStats: {
    mean: number;
    variance: number;
    skewness: number;
    kurtosis: number;
    ljungBox: {
      statistic: number;
      pValue: number;
    };
    jarqueBera: {
      statistic: number;
      pValue: number;
    };
    whiteNoise: {
      statistic: number;
      pValue: number;
    };
  };
  parameterStats: Array<{
    parameter: string;
    value: number;
    standardError: number;
    tStatistic: number;
    pValue: number;
  }>;
  plots: {
    residual: any;
    acf: any;
    pacf: any;
    qq: any;
    forecast?: any;
    decomposition?: any;
  };
}

export class SARIMAXModel {
  private config: SARIMAXConfig;
  private params: number[] = [];
  private exoParams: number[] = [];
  private residuals: number[] = [];
  private seasonalDiffs: number[][] = [];
  private regularDiffs: number[] = [];
  private means: number[] = [];
  private stds: number[] = [];
  private parameterCovariance: number[][] = [];
  private logLikelihood: number = -Infinity;
  private exogenousData?: number[][];

  constructor(config: SARIMAXConfig) {
    // Validate configuration
    if (config.order.some(x => x < 0) || 
        config.seasonalOrders.some(s => s.order.some(x => x < 0) || s.period <= 0)) {
      throw new Error('Invalid SARIMAX configuration: orders must be non-negative and periods must be positive');
    }
    
    this.config = {
      ...config,
      tolerance: config.tolerance || 1e-6,
      maxIterations: config.maxIterations || 1000
    };
  }

  getConfig(): SARIMAXConfig {
    return { ...this.config };
  }

  fit(data: Array<{ timestamp: Date; value: number; exogenous?: Record<string, number> }>) {
    const values = data.map(d => d.value);
    
    // Process exogenous variables if present
    if (this.config.exogenousVariables && this.config.exogenousVariables.length > 0) {
      this.exogenousData = this.config.exogenousVariables.map(variable => 
        data.map(d => d.exogenous?.[variable] ?? 0)
      );
    }

    // Apply seasonal differencing for each seasonal component
    this.seasonalDiffs = this.config.seasonalOrders.map(seasonal => {
      const { period, order: [_, D, __] } = seasonal;
      let diff = [...values];
      for (let d = 0; d < D; d++) {
        diff = this.seasonalDifference(diff, period);
      }
      return diff;
    });

    // Apply regular differencing
    this.regularDiffs = [...values];
    for (let d = 0; d < this.config.order[1]; d++) {
      this.regularDiffs = this.difference(this.regularDiffs);
    }

    // Standardize the differenced series
    this.means = this.seasonalDiffs.map(diff => StatisticalUtils.mean(diff));
    this.stds = this.seasonalDiffs.map(diff => StatisticalUtils.standardDeviation(diff));
    const standardizedDiffs = this.seasonalDiffs.map((diff, i) => 
      diff.map(x => (x - this.means[i]) / this.stds[i])
    );

    // Estimate parameters using maximum likelihood
    const allParams = this.estimateParameters(standardizedDiffs);
    
    // Split parameters between SARIMA and exogenous
    const numExoParams = this.config.exogenousVariables?.length ?? 0;
    this.params = allParams.slice(0, -numExoParams);
    this.exoParams = allParams.slice(-numExoParams);

    // Calculate residuals
    this.residuals = this.calculateResiduals(values);
  }

  predict(horizon: number, exogenous?: Array<Record<string, number>>): {
    predictions: number[];
    confidenceIntervals: Array<{ lower: number; upper: number }>;
  } {
    // Validate exogenous data if required
    if (this.config.exogenousVariables && !exogenous) {
      throw new Error('Exogenous variables required for prediction');
    }

    const predictions: number[] = [];
    const confidenceIntervals: Array<{ lower: number; upper: number }> = [];
    const lastValues = this.residuals.slice(-Math.max(...this.config.seasonalOrders.map(s => s.period)));

    for (let h = 0; h < horizon; h++) {
      let prediction = 0;

      // Add seasonal components
      this.config.seasonalOrders.forEach((seasonal, i) => {
        const { period, order: [P, _, Q] } = seasonal;
        
        // AR component
        for (let p = 0; p < P; p++) {
          const idx = lastValues.length - period * (p + 1);
          if (idx >= 0) {
            prediction += this.params[i * (P + Q) + p] * lastValues[idx];
          }
        }

        // MA component
        for (let q = 0; q < Q; q++) {
          const idx = this.residuals.length - period * (q + 1);
          if (idx >= 0) {
            prediction += this.params[i * (P + Q) + P + q] * this.residuals[idx];
          }
        }

        // Destandardize and add seasonal mean
        prediction = prediction * this.stds[i] + this.means[i];
      });

      // Add non-seasonal components
      const [p, _, q] = this.config.order;
      const baseParamOffset = this.config.seasonalOrders.reduce((sum, s) => 
        sum + s.order[0] + s.order[2], 0
      );

      // AR component
      for (let i = 0; i < p; i++) {
        const idx = lastValues.length - (i + 1);
        if (idx >= 0) {
          prediction += this.params[baseParamOffset + i] * lastValues[idx];
        }
      }

      // MA component
      for (let i = 0; i < q; i++) {
        const idx = this.residuals.length - (i + 1);
        if (idx >= 0) {
          prediction += this.params[baseParamOffset + p + i] * this.residuals[idx];
        }
      }

      // Add exogenous components
      if (exogenous && this.config.exogenousVariables) {
        this.config.exogenousVariables.forEach((variable, i) => {
          prediction += this.exoParams[i] * (exogenous[h]?.[variable] ?? 0);
        });
      }

      // Calculate prediction intervals
      const variance = this.calculatePredictionVariance(h);
      const criticalValue = StatisticalUtils.normalInverseCDF(0.975);  // 95% confidence
      const interval = criticalValue * Math.sqrt(variance);

      predictions.push(prediction);
      confidenceIntervals.push({
        lower: prediction - interval,
        upper: prediction + interval
      });

      lastValues.push(prediction);
      this.residuals.push(0);  // Assume zero residual for future points
    }

    return { predictions, confidenceIntervals };
  }

  getDiagnostics(data: Array<{ timestamp: Date; value: number }>): DiagnosticResults {
    const n = this.residuals.length;
    const k = this.params.length + (this.exoParams?.length ?? 0);
    
    // Calculate model selection criteria
    const modelSelection = this.calculateModelSelectionCriteria(n, k);
    
    // Calculate residual statistics
    const residualStats = this.calculateResidualStats();
    
    // Calculate parameter statistics
    const parameterStats = this.calculateParameterStats();
    
    // Generate diagnostic plots
    const plots = TimeSeriesPlots.generateResidualPlots(
      this.residuals,
      data.map(d => d.timestamp)
    );

    return {
      modelSelection,
      residualStats,
      parameterStats,
      plots
    };
  }

  private calculateModelSelectionCriteria(n: number, k: number): ModelSelectionCriteria {
    const aic = -2 * this.logLikelihood + 2 * k;
    const bic = -2 * this.logLikelihood + k * Math.log(n);
    const hqic = -2 * this.logLikelihood + 2 * k * Math.log(Math.log(n));
    const aicc = aic + (2 * k * (k + 1)) / (n - k - 1);
    
    // Calculate Mallows' Cp
    const residualVar = StatisticalUtils.variance(this.residuals);
    const mallowsCp = this.residuals.reduce((sum, r) => sum + r * r, 0) / residualVar - n + 2 * k;
    
    // Calculate Final Prediction Error
    const fpe = residualVar * (n + k) / (n - k);

    return {
      aic,
      bic,
      hqic,
      aicc,
      mallowsCp,
      fpe
    };
  }

  private calculateResidualStats() {
    const n = this.residuals.length;
    const mean = StatisticalUtils.mean(this.residuals);
    const variance = StatisticalUtils.variance(this.residuals);
    const skewness = StatisticalUtils.skewness(this.residuals);
    const kurtosis = StatisticalUtils.kurtosis(this.residuals);

    // Ljung-Box test
    const maxLag = Math.min(20, Math.floor(n / 5));
    const acf = StatisticalUtils.acf(this.residuals, maxLag);
    const ljungBox = this.calculateLjungBox(acf, n);

    // Jarque-Bera test for normality
    const jarqueBera = this.calculateJarqueBera(skewness, kurtosis, n);

    // White noise test
    const whiteNoise = this.calculateWhiteNoiseTest();

    return {
      mean,
      variance,
      skewness,
      kurtosis,
      ljungBox,
      jarqueBera,
      whiteNoise
    };
  }

  private calculateJarqueBera(skewness: number, kurtosis: number, n: number) {
    const statistic = n * (Math.pow(skewness, 2) / 6 + Math.pow(kurtosis, 2) / 24);
    const pValue = 1 - StatisticalUtils.chiSquareCDF(statistic, 2);
    return { statistic, pValue };
  }

  private calculateWhiteNoiseTest() {
    const n = this.residuals.length;
    const periodogram = this.calculatePeriodogram();
    const cumSum = periodogram.reduce((sum, p, i) => sum + p / periodogram[0], 0);
    
    const statistic = Math.max(...Array.from({ length: n - 1 }, (_, i) => 
      Math.abs(cumSum - (i + 1) / (n - 1))
    ));
    
    const pValue = Math.exp(-2 * statistic * statistic);
    return { statistic, pValue };
  }

  private calculatePeriodogram(): number[] {
    const n = this.residuals.length;
    const frequencies = Array.from({ length: Math.floor(n/2) }, (_, k) => 2 * Math.PI * k / n);
    
    return frequencies.map(freq => {
      const real = this.residuals.reduce((sum, r, t) => sum + r * Math.cos(freq * t), 0);
      const imag = this.residuals.reduce((sum, r, t) => sum + r * Math.sin(freq * t), 0);
      return (real * real + imag * imag) / n;
    });
  }

  private calculatePredictionVariance(horizon: number): number {
    // Base prediction variance
    let variance = StatisticalUtils.variance(this.residuals);
    
    // Add parameter uncertainty
    const gradients = this.calculatePredictionGradients(horizon);
    for (let i = 0; i < gradients.length; i++) {
      for (let j = 0; j < gradients.length; j++) {
        variance += gradients[i] * this.parameterCovariance[i][j] * gradients[j];
      }
    }
    
    return variance;
  }

  private calculatePredictionGradients(horizon: number): number[] {
    // Calculate gradients numerically
    const h = 1e-8;
    const basePred = this.predict(horizon).predictions[horizon - 1];
    
    return [...this.params, ...this.exoParams].map((param, i) => {
      const paramsPlus = [...this.params];
      if (i < this.params.length) {
        paramsPlus[i] += h;
      } else {
        this.exoParams[i - this.params.length] += h;
      }
      
      const predPlus = this.predict(horizon).predictions[horizon - 1];
      return (predPlus - basePred) / h;
    });
  }

  private seasonalDifference(values: number[], period: number): number[] {
    return values.slice(period).map((v, i) => v - values[i]);
  }

  private difference(values: number[]): number[] {
    return values.slice(1).map((v, i) => v - values[i]);
  }

  private estimateParameters(standardizedDiffs: number[][]): number[] {
    const numParams = this.calculateTotalParameters();
    
    // Initialize parameters using method of moments
    let params = this.initializeParameters(standardizedDiffs);
    let prevLogLik = -Infinity;
    let iteration = 0;
    let stepSize = 0.01;
    
    while (iteration < this.config.maxIterations!) {
      // Calculate gradient and Hessian
      const gradient = this.calculateGradient(params, standardizedDiffs);
      const hessian = this.calculateHessian(params, standardizedDiffs);
      
      // Calculate step using Newton-Raphson with regularization
      const step = this.solveNewtonStep(gradient, hessian, stepSize);
      const newParams = params.map((p, i) => p + step[i]);
      
      // Calculate new log-likelihood
      const newLogLik = this.calculateLogLikelihood(newParams, standardizedDiffs);
      
      // Check if improvement
      if (newLogLik > prevLogLik) {
        params = newParams;
        stepSize = Math.min(stepSize * 1.2, 1.0);  // Increase step size
      } else {
        stepSize *= 0.5;  // Reduce step size
      }
      
      // Check convergence
      if (Math.abs(newLogLik - prevLogLik) < this.config.tolerance!) {
        break;
      }
      
      prevLogLik = newLogLik;
      iteration++;
    }
    
    return params;
  }

  private calculateResiduals(values: number[]): number[] {
    const predictions = this.generateInSamplePredictions(values);
    return values.map((v, i) => v - predictions[i]);
  }

  private calculateParameterStats(): Array<{
    parameter: string;
    value: number;
    standardError: number;
    tStatistic: number;
    pValue: number;
  }> {
    const stats: Array<{
      parameter: string;
      value: number;
      standardError: number;
      tStatistic: number;
      pValue: number;
    }> = [];

    // SARIMA parameters
    this.params.forEach((param, i) => {
      const stdError = Math.sqrt(this.parameterCovariance[i][i]);
      const tStat = param / stdError;
      const pValue = 2 * (1 - StatisticalUtils.normalCDF(Math.abs(tStat)));
      
      stats.push({
        parameter: `sarima_param_${i}`,
        value: param,
        standardError: stdError,
        tStatistic: tStat,
        pValue: pValue
      });
    });

    // Exogenous parameters
    this.exoParams.forEach((param, i) => {
      const paramIdx = this.params.length + i;
      const stdError = Math.sqrt(this.parameterCovariance[paramIdx][paramIdx]);
      const tStat = param / stdError;
      const pValue = 2 * (1 - StatisticalUtils.normalCDF(Math.abs(tStat)));
      
      stats.push({
        parameter: `exo_${this.config.exogenousVariables![i]}`,
        value: param,
        standardError: stdError,
        tStatistic: tStat,
        pValue: pValue
      });
    });

    return stats;
  }

  private calculateLjungBox(acf: number[], n: number): { statistic: number; pValue: number } {
    const k = this.params.length + (this.exoParams?.length ?? 0);
    const Q = acf.reduce((sum, r, h) => 
      sum + (r * r) / (n - h - 1), 0
    ) * n * (n + 2);
    
    // Approximate p-value using chi-square distribution with (lags - k) degrees of freedom
    const df = acf.length - k;
    const pValue = 1 - StatisticalUtils.chiSquareCDF(Q, df);
    
    return { statistic: Q, pValue };
  }

  private generateInSamplePredictions(values: number[]): number[] {
    const predictions = new Array(values.length).fill(0);
    
    // Add seasonal predictions
    this.config.seasonalOrders.forEach((seasonal, i) => {
      const { period, order: [P, _, Q] } = seasonal;
      
      for (let t = period; t < values.length; t++) {
        let pred = 0;
        
        // AR component
        for (let p = 0; p < P; p++) {
          pred += this.params[i * (P + Q) + p] * values[t - period * (p + 1)];
        }
        
        // MA component
        for (let q = 0; q < Q; q++) {
          const idx = t - period * (q + 1);
          if (idx >= 0) {
            pred += this.params[i * (P + Q) + P + q] * this.residuals[idx];
          }
        }
        
        predictions[t] += pred;
      }
    });
    
    // Add non-seasonal predictions
    const [p, _, q] = this.config.order;
    const baseParamOffset = this.config.seasonalOrders.reduce((sum, s) => 
      sum + s.order[0] + s.order[2], 0
    );
    
    for (let t = p; t < values.length; t++) {
      // AR component
      for (let i = 0; i < p; i++) {
        predictions[t] += this.params[baseParamOffset + i] * values[t - i - 1];
      }
      
      // MA component
      for (let i = 0; i < q; i++) {
        if (t - i - 1 >= 0) {
          predictions[t] += this.params[baseParamOffset + p + i] * this.residuals[t - i - 1];
        }
      }
    }
    
    // Add exogenous predictions
    if (this.exogenousData && this.exoParams) {
      this.exogenousData.forEach((variable, i) => {
        for (let t = 0; t < values.length; t++) {
          predictions[t] += this.exoParams[i] * variable[t];
        }
      });
    }
    
    return predictions;
  }

  // ... existing helper methods ...
} 