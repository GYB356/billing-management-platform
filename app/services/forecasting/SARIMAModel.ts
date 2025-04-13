import { StatisticalUtils } from './StatisticalUtils';
import { ModelDiagnostics } from './ModelDiagnostics';

interface SARIMAConfig {
  order: [number, number, number];  // (p, d, q)
  seasonalOrders: Array<{
    order: [number, number, number];  // (P, D, Q)
    period: number;  // s
  }>;
  tolerance?: number;
  maxIterations?: number;
}

interface DiagnosticResults {
  aic: number;
  bic: number;
  logLikelihood: number;
  residualStats: {
    mean: number;
    variance: number;
    skewness: number;
    kurtosis: number;
    ljungBox: {
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
}

export class SARIMAModel {
  private config: SARIMAConfig;
  private params: number[] = [];
  private residuals: number[] = [];
  private seasonalDiffs: number[][] = [];
  private regularDiffs: number[] = [];
  private means: number[] = [];
  private stds: number[] = [];
  private parameterCovariance: number[][] = [];
  private logLikelihood: number = -Infinity;

  constructor(config: SARIMAConfig) {
    // Validate configuration
    if (config.order.some(x => x < 0) || 
        config.seasonalOrders.some(s => s.order.some(x => x < 0) || s.period <= 0)) {
      throw new Error('Invalid SARIMA configuration: orders must be non-negative and periods must be positive');
    }
    
    this.config = {
      ...config,
      tolerance: config.tolerance || 1e-6,
      maxIterations: config.maxIterations || 1000
    };
  }

  fit(data: Array<{ timestamp: Date; value: number }>) {
    const values = data.map(d => d.value);
    
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
    this.params = this.estimateParameters(standardizedDiffs);

    // Calculate residuals
    this.residuals = this.calculateResiduals(values);
  }

  predict(horizon: number): number[] {
    const predictions: number[] = [];
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

      predictions.push(prediction);
      lastValues.push(prediction);
      this.residuals.push(0);  // Assume zero residual for future points
    }

    return predictions;
  }

  getParameters(): Record<string, number> {
    return {
      ...Object.fromEntries(
        this.params.map((p, i) => [`param_${i}`, p])
      ),
      ...Object.fromEntries(
        this.means.map((m, i) => [`mean_${i}`, m])
      ),
      ...Object.fromEntries(
        this.stds.map((s, i) => [`std_${i}`, s])
      )
    };
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
      // Calculate gradient
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
    
    // Store final log-likelihood and parameter covariance
    this.logLikelihood = prevLogLik;
    this.parameterCovariance = this.calculateParameterCovariance(params, standardizedDiffs);
    
    return params;
  }

  private calculateGradient(params: number[], data: number[][]): number[] {
    const h = 1e-8;
    return params.map((_, i) => {
      const paramsPlus = [...params];
      const paramsMinus = [...params];
      paramsPlus[i] += h;
      paramsMinus[i] -= h;
      
      const logLikPlus = this.calculateLogLikelihood(paramsPlus, data);
      const logLikMinus = this.calculateLogLikelihood(paramsMinus, data);
      
      return (logLikPlus - logLikMinus) / (2 * h);
    });
  }

  private calculateHessian(params: number[], data: number[][]): number[][] {
    const h = 1e-4;
    const n = params.length;
    const hessian: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const paramspp = [...params];
        const paramspm = [...params];
        const paramsmp = [...params];
        const paramsmm = [...params];
        
        paramspp[i] += h; paramspp[j] += h;
        paramspm[i] += h; paramspm[j] -= h;
        paramsmp[i] -= h; paramsmp[j] += h;
        paramsmm[i] -= h; paramsmm[j] -= h;
        
        const fpp = this.calculateLogLikelihood(paramspp, data);
        const fpm = this.calculateLogLikelihood(paramspm, data);
        const fmp = this.calculateLogLikelihood(paramsmp, data);
        const fmm = this.calculateLogLikelihood(paramsmm, data);
        
        hessian[i][j] = hessian[j][i] = 
          (fpp - fpm - fmp + fmm) / (4 * h * h);
      }
    }
    
    return hessian;
  }

  private solveNewtonStep(gradient: number[], hessian: number[][], stepSize: number): number[] {
    const n = gradient.length;
    const regularized = hessian.map((row, i) => 
      row.map((h, j) => h + (i === j ? 1e-6 : 0))  // Add small regularization term
    );
    
    // Solve system using Cholesky decomposition
    const L = this.choleskyDecomposition(regularized);
    const y = this.forwardSubstitution(L, gradient);
    const step = this.backwardSubstitution(L, y);
    
    return step.map(s => -s * stepSize);  // Negative because we maximize
  }

  private choleskyDecomposition(matrix: number[][]): number[][] {
    const n = matrix.length;
    const L = Array(n).fill(0).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        
        if (j === i) {
          for (let k = 0; k < j; k++) {
            sum += L[j][k] * L[j][k];
          }
          L[j][j] = Math.sqrt(matrix[j][j] - sum);
        } else {
          for (let k = 0; k < j; k++) {
            sum += L[i][k] * L[j][k];
          }
          L[i][j] = (matrix[i][j] - sum) / L[j][j];
        }
      }
    }
    
    return L;
  }

  private forwardSubstitution(L: number[][], b: number[]): number[] {
    const n = L.length;
    const y = Array(n).fill(0);
    
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < i; j++) {
        sum += L[i][j] * y[j];
      }
      y[i] = (b[i] - sum) / L[i][i];
    }
    
    return y;
  }

  private backwardSubstitution(L: number[][], y: number[]): number[] {
    const n = L.length;
    const x = Array(n).fill(0);
    
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += L[j][i] * x[j];
      }
      x[i] = (y[i] - sum) / L[i][i];
    }
    
    return x;
  }

  private calculateLogLikelihood(params: number[], data: number[][]): number {
    const n = data[0].length;
    let logLik = -n/2 * Math.log(2 * Math.PI);
    
    // Calculate prediction errors and their variance
    const errors = this.calculatePredictionErrors(params, data);
    const variance = errors.reduce((sum, e) => sum + e * e, 0) / n;
    
    logLik -= n/2 * Math.log(variance);
    logLik -= errors.reduce((sum, e) => sum + (e * e)/(2 * variance), 0);
    
    return logLik;
  }

  private calculatePredictionErrors(params: number[], data: number[][]): number[] {
    const errors: number[] = [];
    const predictions = this.generateInSamplePredictions(params, data);
    
    for (let i = 0; i < data[0].length; i++) {
      let error = data[0][i];
      for (let j = 0; j < predictions.length; j++) {
        error -= predictions[j][i];
      }
      errors.push(error);
    }
    
    return errors;
  }

  private calculateInSamplePredictions(params: number[], data: number[][]): number[][] {
    const predictions: number[][] = [];
    
    for (let i = 0; i < data[0].length; i++) {
      let prediction = 0;
      
      // Add seasonal components
      this.config.seasonalOrders.forEach((seasonal, j) => {
        const { period, order: [P, _, Q] } = seasonal;
        
        // AR component
        for (let p = 0; p < P; p++) {
          const idx = i - period * (p + 1);
          if (idx >= 0) {
            prediction += params[j * (P + Q) + p] * data[0][idx];
          }
        }

        // MA component
        for (let q = 0; q < Q; q++) {
          const idx = i - period * (q + 1);
          if (idx >= 0) {
            prediction += params[j * (P + Q) + P + q] * data[0][idx];
          }
        }

        // Destandardize and add seasonal mean
        prediction = prediction * this.stds[j] + this.means[j];
      });

      // Add non-seasonal components
      const [p, _, q] = this.config.order;
      const baseParamOffset = this.config.seasonalOrders.reduce((sum, s) => 
        sum + s.order[0] + s.order[2], 0
      );

      // AR component
      for (let j = 0; j < p; j++) {
        const idx = i - (j + 1);
        if (idx >= 0) {
          prediction += params[baseParamOffset + j] * data[0][idx];
        }
      }

      // MA component
      for (let j = 0; j < q; j++) {
        const idx = i - (j + 1);
        if (idx >= 0) {
          prediction += params[baseParamOffset + p + j] * data[0][idx];
        }
      }

      predictions.push([prediction]);
    }
    
    return predictions;
  }

  getDiagnostics(): DiagnosticResults {
    const n = this.residuals.length;
    const k = this.params.length;
    
    // Calculate information criteria
    const aic = -2 * this.logLikelihood + 2 * k;
    const bic = -2 * this.logLikelihood + k * Math.log(n);
    
    // Calculate residual statistics
    const residualMean = this.residuals.reduce((a, b) => a + b, 0) / n;
    const residualVar = this.residuals.reduce((a, b) => 
      a + Math.pow(b - residualMean, 2), 0
    ) / (n - 1);
    
    // Calculate parameter statistics
    const parameterStats = this.params.map((param, i) => {
      const stdError = Math.sqrt(this.parameterCovariance[i][i]);
      const tStat = param / stdError;
      const pValue = 2 * (1 - this.normalCDF(Math.abs(tStat)));
      
      return {
        parameter: `param_${i}`,
        value: param,
        standardError: stdError,
        tStatistic: tStat,
        pValue: pValue
      };
    });
    
    // Calculate Ljung-Box statistic
    const lags = Math.min(20, Math.floor(n / 5));
    const acf = this.calculateACF(this.residuals, lags);
    const ljungBox = this.calculateLjungBox(acf, n, k);
    
    return {
      aic,
      bic,
      logLikelihood: this.logLikelihood,
      residualStats: {
        mean: residualMean,
        variance: residualVar,
        skewness: this.calculateSkewness(this.residuals),
        kurtosis: this.calculateKurtosis(this.residuals),
        ljungBox
      },
      parameterStats
    };
  }

  private calculateACF(data: number[], maxLag: number): number[] {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((a, b) => 
      a + Math.pow(b - mean, 2), 0
    ) / data.length;
    
    return Array.from({ length: maxLag }, (_, k) => {
      let sum = 0;
      for (let i = 0; i < data.length - k - 1; i++) {
        sum += (data[i] - mean) * (data[i + k + 1] - mean);
      }
      return sum / ((data.length - k - 1) * variance);
    });
  }

  private calculateLjungBox(acf: number[], n: number, k: number) {
    const Q = acf.reduce((sum, r, h) => 
      sum + (r * r) / (n - h - 1), 0
    ) * n * (n + 2);
    
    // Approximate p-value using chi-square distribution
    const df = acf.length - k;
    const pValue = 1 - this.chiSquareCDF(Q, df);
    
    return { statistic: Q, pValue };
  }

  private calculateSkewness(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const m3 = data.reduce((a, b) => a + Math.pow(b - mean, 3), 0) / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
    return m3 / Math.pow(variance, 1.5);
  }

  private calculateKurtosis(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const m4 = data.reduce((a, b) => a + Math.pow(b - mean, 4), 0) / data.length;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
    return (m4 / Math.pow(variance, 2)) - 3;  // Excess kurtosis
  }

  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  private chiSquareCDF(x: number, df: number): number {
    // Wilson-Hilferty transformation for chi-square approximation
    const z = Math.pow((x / df), 1/3);
    return this.normalCDF((z - (1 - 2/(9*df))) / Math.sqrt(2/(9*df)));
  }

  private erf(x: number): number {
    // Approximation of the error function
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }

  private calculateResiduals(values: number[]): number[] {
    // Calculate one-step-ahead prediction errors
    const predictions = this.predict(values.length);
    return values.map((v, i) => v - predictions[i]);
  }

  private calculateTotalParameters(): number {
    const [p, _, q] = this.config.order;
    return this.config.seasonalOrders.reduce((sum, s) => 
      sum + s.order[0] + s.order[2], 0
    ) + p + q;
  }

  private initializeParameters(data: number[][]): number[] {
    const numParams = this.calculateTotalParameters();
    const params = new Array(numParams).fill(0);
    
    // Initialize AR parameters using partial autocorrelations
    let paramIdx = 0;
    const pacf = StatisticalUtils.partialAutocorrelation(data[0], 
      Math.max(...this.config.seasonalOrders.map(s => s.period))
    );
    
    // Initialize seasonal AR parameters
    this.config.seasonalOrders.forEach(seasonal => {
      const [P, _, __] = seasonal.order;
      for (let i = 0; i < P; i++) {
        params[paramIdx + i] = pacf[seasonal.period * (i + 1)] || 0;
      }
      paramIdx += P;
    });
    
    // Initialize non-seasonal AR parameters
    const [p, _, __] = this.config.order;
    for (let i = 0; i < p; i++) {
      params[paramIdx + i] = pacf[i + 1] || 0;
    }
    
    return params;
  }

  private generateInSamplePredictions(params: number[], data: number[][]): number[][] {
    const predictions: number[][] = [];
    const n = data[0].length;
    
    // Generate predictions for each component
    this.config.seasonalOrders.forEach((seasonal, i) => {
      const [P, _, Q] = seasonal.order;
      const { period } = seasonal;
      const componentPreds = new Array(n).fill(0);
      
      for (let t = period; t < n; t++) {
        let pred = 0;
        
        // AR component
        for (let p = 0; p < P; p++) {
          pred += params[i * (P + Q) + p] * data[i][t - period * (p + 1)];
        }
        
        // MA component
        for (let q = 0; q < Q; q++) {
          const idx = t - period * (q + 1);
          if (idx >= 0) {
            pred += params[i * (P + Q) + P + q] * this.residuals[idx];
          }
        }
        
        componentPreds[t] = pred;
      }
      
      predictions.push(componentPreds);
    });
    
    // Add non-seasonal component
    const [p, _, q] = this.config.order;
    const baseParamOffset = this.config.seasonalOrders.reduce((sum, s) => 
      sum + s.order[0] + s.order[2], 0
    );
    const nonseasonal = new Array(n).fill(0);
    
    for (let t = p; t < n; t++) {
      let pred = 0;
      
      // AR component
      for (let i = 0; i < p; i++) {
        pred += params[baseParamOffset + i] * data[0][t - i - 1];
      }
      
      // MA component
      for (let i = 0; i < q; i++) {
        if (t - i - 1 >= 0) {
          pred += params[baseParamOffset + p + i] * this.residuals[t - i - 1];
        }
      }
      
      nonseasonal[t] = pred;
    }
    
    predictions.push(nonseasonal);
    return predictions;
  }

  private calculateParameterCovariance(params: number[], data: number[][]): number[][] {
    const n = params.length;
    const hessian = this.calculateHessian(params, data);
    
    // Invert Hessian using Cholesky decomposition
    const L = this.choleskyDecomposition(hessian);
    const identity = Array(n).fill(0).map((_, i) => 
      Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
    );
    
    const covariance = Array(n).fill(0).map(() => Array(n).fill(0));
    
    // Solve system for each column of identity matrix
    for (let j = 0; j < n; j++) {
      const y = this.forwardSubstitution(L, identity[j]);
      const x = this.backwardSubstitution(L, y);
      
      for (let i = 0; i < n; i++) {
        covariance[i][j] = x[i];
      }
    }
    
    return covariance;
  }
} 