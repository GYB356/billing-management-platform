export class StatisticalUtils {
  // Normal distribution utilities
  static normalCDF(x: number, mean = 0, stdDev = 1): number {
    // Approximation of normal CDF
    const b1 = 0.31938153;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;
    const p = 0.2316419;
    const c = 0.39894228;
    
    const z = (x - mean) / stdDev;
    if (z >= 0) {
      const t = 1 / (1 + p * z);
      return 1 - c * Math.exp(-z * z / 2) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
    } else {
      return 1 - this.normalCDF(-x, mean, stdDev);
    }
  }

  static normalInverseCDF(p: number, mean = 0, stdDev = 1): number {
    if (p <= 0 || p >= 1) {
      throw new Error('Probability must be between 0 and 1');
    }

    // Initial guess using approximation
    let x = mean;
    if (p < 0.5) {
      x = mean - stdDev * Math.sqrt(-2 * Math.log(p));
    } else {
      x = mean + stdDev * Math.sqrt(-2 * Math.log(1 - p));
    }

    // Newton-Raphson refinement
    const maxIterations = 100;
    const tolerance = 1e-10;
    
    for (let i = 0; i < maxIterations; i++) {
      const cdf = this.normalCDF(x, mean, stdDev);
      const pdf = this.normalPDF(x, mean, stdDev);
      
      const delta = (cdf - p) / pdf;
      x -= delta;
      
      if (Math.abs(delta) < tolerance) {
        break;
      }
    }

    return x;
  }

  static normalPDF(x: number, mean = 0, stdDev = 1): number {
    const z = (x - mean) / stdDev;
    return Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
  }

  // Chi-square distribution utilities
  static chiSquareCDF(x: number, df: number): number {
    // Approximation of chi-square CDF using Wilson-Hilferty transformation
    if (x <= 0) return 0;
    const z = Math.pow(x / df, 1/3) - (1 - 2/(9 * df)) / Math.sqrt(2/(9 * df));
    return this.normalCDF(z);
  }

  static chiSquareInverseCDF(p: number, k: number): number {
    if (p <= 0 || p >= 1) {
      throw new Error('Probability must be between 0 and 1');
    }

    // Initial guess
    let x = k;
    
    // Newton-Raphson refinement
    const maxIterations = 100;
    const tolerance = 1e-10;
    
    for (let i = 0; i < maxIterations; i++) {
      const cdf = this.chiSquareCDF(x, k);
      const pdf = this.chiSquarePDF(x, k);
      
      const delta = (cdf - p) / pdf;
      x -= delta;
      
      if (Math.abs(delta) < tolerance) {
        break;
      }
    }

    return x;
  }

  static chiSquarePDF(x: number, k: number): number {
    if (x <= 0) return 0;
    return Math.exp((k/2 - 1) * Math.log(x) - x/2 - this.logGamma(k/2) - k/2 * Math.log(2));
  }

  // Special functions
  static erf(x: number): number {
    // Error function approximation
    const t = 1.0 / (1.0 + 0.5 * Math.abs(x));
    const tau = t * Math.exp(
      -x * x +
      0.430638815 +
      t * (-0.12842638 +
        t * (0.1288089 +
          t * (-0.0705230 +
            t * (0.0078116 +
              t * (-0.0029776)))))
    );
    return x >= 0 ? 1 - tau : tau - 1;
  }

  static gamma(z: number): number {
    // Lanczos approximation
    const p = [
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];

    if (z < 0.5) {
      return Math.PI / (Math.sin(Math.PI * z) * this.gamma(1 - z));
    }

    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < p.length; i++) {
      x += p[i] / (z + i + 1);
    }

    const t = z + p.length - 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  static logGamma(z: number): number {
    return Math.log(this.gamma(z));
  }

  static incompleteGamma(s: number, x: number): number {
    if (x <= 0) return 0;
    
    const maxIterations = 200;
    const epsilon = 1e-10;
    
    let sum = 1;
    let term = 1;
    let n = 1;
    
    while (n < maxIterations) {
      term *= x / (s + n);
      sum += term;
      
      if (Math.abs(term) < epsilon * Math.abs(sum)) {
        break;
      }
      n++;
    }
    
    return Math.pow(x, s) * Math.exp(-x) * sum / this.gamma(s);
  }

  // Time series utilities
  static acf(data: number[], maxLag: number): number[] {
    const n = data.length;
    const mean = this.mean(data);
    const variance = this.variance(data);
    const result = new Array(maxLag + 1);
    
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += (data[i] - mean) * (data[i + lag] - mean);
      }
      result[lag] = sum / ((n - lag) * variance);
    }
    
    return result;
  }

  static pacf(data: number[], maxLag: number): number[] {
    const result = new Array(maxLag);
    const phi = new Array(maxLag + 1).fill(0).map(() => new Array(maxLag + 1));
    
    // Initialize first row with ACF values
    const acf = this.acf(data, maxLag);
    phi[1][1] = acf[1];
    result[0] = phi[1][1];
    
    // Durbin-Levinson algorithm
    for (let j = 2; j <= maxLag; j++) {
      let sum = 0;
      for (let k = 1; k < j; k++) {
        sum += phi[j - 1][k] * acf[j - k];
      }
      phi[j][j] = (acf[j] - sum) / (1 - this.sum(
        Array.from({ length: j - 1 }, (_, k) => phi[j - 1][k + 1] * acf[k + 1])
      ));
      
      for (let k = 1; k < j; k++) {
        phi[j][k] = phi[j - 1][k] - phi[j][j] * phi[j - 1][j - k];
      }
      
      result[j - 1] = phi[j][j];
    }
    
    return result;
  }

  static mean(data: number[]): number {
    return data.reduce((sum, x) => sum + x, 0) / data.length;
  }

  static variance(data: number[]): number {
    const m = this.mean(data);
    return this.mean(data.map(x => Math.pow(x - m, 2)));
  }

  static standardDeviation(data: number[]): number {
    return Math.sqrt(this.variance(data));
  }

  static sum(data: number[]): number {
    return data.reduce((sum, x) => sum + x, 0);
  }

  static skewness(data: number[]): number {
    const m = this.mean(data);
    const s = this.standardDeviation(data);
    return this.mean(data.map(x => Math.pow((x - m) / s, 3)));
  }

  static kurtosis(data: number[]): number {
    const m = this.mean(data);
    const s = this.standardDeviation(data);
    return this.mean(data.map(x => Math.pow((x - m) / s, 4)));
  }

  static covariance(x: number[], y: number[]): number {
    if (x.length !== y.length) {
      throw new Error('Arrays must have same length');
    }
    
    const meanX = this.mean(x);
    const meanY = this.mean(y);
    
    return x.reduce((sum, xi, i) => 
      sum + (xi - meanX) * (y[i] - meanY), 0
    ) / x.length;
  }

  static correlation(x: number[], y: number[]): number {
    const stdX = this.standardDeviation(x);
    const stdY = this.standardDeviation(y);
    return this.covariance(x, y) / (stdX * stdY);
  }

  static autocovariance(data: number[], lag: number): number {
    const mean = this.mean(data);
    let sum = 0;
    
    for (let i = 0; i < data.length - lag; i++) {
      sum += (data[i] - mean) * (data[i + lag] - mean);
    }
    
    return sum / data.length;
  }

  static autocorrelation(data: number[], lag: number): number {
    return this.autocovariance(data, lag) / this.variance(data);
  }

  static partialAutocorrelation(data: number[], maxLag: number): number[] {
    const pacf: number[] = [];
    const phi: number[][] = Array(maxLag + 1).fill(0).map(() => Array(maxLag + 1).fill(0));
    
    // Initialize first value (lag 0)
    pacf[0] = 1;
    
    // Calculate PACF for each lag using Durbin-Levinson algorithm
    for (let k = 1; k <= maxLag; k++) {
      let sum = this.autocorrelation(data, k);
      
      for (let j = 1; j < k; j++) {
        sum -= phi[k-1][j] * this.autocorrelation(data, k - j);
      }
      
      phi[k][k] = sum;
      
      for (let j = 1; j < k; j++) {
        phi[k][j] = phi[k-1][j] - phi[k][k] * phi[k-1][k-j];
      }
      
      pacf[k] = phi[k][k];
    }
    
    return pacf;
  }

  static quantile(data: number[], q: number): number {
    if (q < 0 || q > 1) {
      throw new Error('Quantile must be between 0 and 1');
    }
    
    const sorted = [...data].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    
    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
      return sorted[base];
    }
  }

  static normalQuantile(p: number): number {
    // Approximation of inverse normal CDF
    const a1 = -3.969683028665376e+01;
    const a2 = 2.209460984245205e+02;
    const a3 = -2.759285104469687e+02;
    const a4 = 1.383577518672690e+02;
    const a5 = -3.066479806614716e+01;
    const a6 = 2.506628277459239e+00;
    
    const b1 = -5.447609879822406e+01;
    const b2 = 1.615858368580409e+02;
    const b3 = -1.556989798598866e+02;
    const b4 = 6.680131188771972e+01;
    const b5 = -1.328068155288572e+01;
    
    const c1 = -7.784894002430293e-03;
    const c2 = -3.223964580411365e-01;
    const c3 = -2.400758277161838e+00;
    const c4 = -2.549732539343734e+00;
    const c5 = 4.374664141464968e+00;
    const c6 = 2.938163982698783e+00;
    
    const d1 = 7.784695709041462e-03;
    const d2 = 3.224671290700398e-01;
    const d3 = 2.445134137142996e+00;
    const d4 = 3.754408661907416e+00;
    
    const p_low = 0.02425;
    const p_high = 1 - p_low;
    
    let q: number;
    let r: number;
    
    if (p < p_low) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    } else if (p > p_high) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
        ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    } else {
      q = p - 0.5;
      r = q * q;
      return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
        (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    }
  }

  static histogram(
    data: number[],
    bins: number
  ): { bins: number[]; counts: number[] } {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / bins;
    
    const binEdges = Array.from({ length: bins + 1 }, (_, i) => min + i * binWidth);
    const counts = new Array(bins).fill(0);
    
    data.forEach(x => {
      const binIndex = Math.min(
        Math.floor((x - min) / binWidth),
        bins - 1
      );
      counts[binIndex]++;
    });
    
    return { bins: binEdges, counts };
  }

  static seasonalDecompose(data: number[]): {
    trend: number[];
    seasonal: number[];
    residual: number[];
  } {
    // Simple moving average for trend
    const windowSize = Math.min(12, Math.floor(data.length / 4));
    const trend = this.movingAverage(data, windowSize);
    
    // Calculate seasonal component
    const detrended = data.map((x, i) => x - (trend[i] || x));
    const period = this.findDominantPeriod(detrended);
    const seasonal = this.extractSeasonalComponent(detrended, period);
    
    // Calculate residual
    const residual = data.map((x, i) => 
      x - (trend[i] || x) - (seasonal[i % period] || 0)
    );
    
    return { trend, seasonal, residual };
  }

  private static movingAverage(data: number[], window: number): number[] {
    const result = new Array(data.length);
    const halfWindow = Math.floor(window / 2);
    
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(data.length, i + halfWindow + 1);
      result[i] = this.mean(data.slice(start, end));
    }
    
    return result;
  }

  private static findDominantPeriod(data: number[]): number {
    const { frequencies, power } = this.periodogram(data);
    const maxIndex = power.indexOf(Math.max(...power));
    return Math.round(1 / frequencies[maxIndex]);
  }

  private static extractSeasonalComponent(
    data: number[],
    period: number
  ): number[] {
    const seasonal = new Array(period).fill(0);
    const counts = new Array(period).fill(0);
    
    data.forEach((x, i) => {
      const idx = i % period;
      seasonal[idx] += x;
      counts[idx]++;
    });
    
    return seasonal.map((s, i) => s / counts[i]);
  }

  static periodogram(data: number[]): {
    frequencies: number[];
    power: number[];
  } {
    const n = data.length;
    const frequencies = Array.from(
      { length: Math.floor(n / 2) + 1 },
      (_, i) => i / n
    );
    
    const power = frequencies.map(f => {
      let real = 0;
      let imag = 0;
      const omega = 2 * Math.PI * f;
      
      for (let t = 0; t < n; t++) {
        real += data[t] * Math.cos(omega * t);
        imag += data[t] * Math.sin(omega * t);
      }
      
      return (real * real + imag * imag) / n;
    });
    
    return { frequencies, power };
  }

  static findSeasonalPeaks(data: number[]): Array<{ period: number; strength: number }> {
    const { frequencies, power } = this.periodogram(data);
    const peaks: Array<{ period: number; strength: number }> = [];
    
    // Find local maxima in periodogram
    for (let i = 1; i < power.length - 1; i++) {
      if (power[i] > power[i - 1] && power[i] > power[i + 1]) {
        const period = Math.round(1 / frequencies[i]);
        const strength = power[i] / Math.max(...power);
        peaks.push({ period, strength });
      }
    }
    
    // Sort by strength and return top peaks
    return peaks
      .sort((a, b) => b.strength - a.strength)
      .filter(p => p.strength > 0.1)  // Filter weak seasonalities
      .slice(0, 3);  // Return top 3 seasonal periods
  }

  static seasonalStrength(data: number[]): number {
    const { seasonal, residual } = this.seasonalDecompose(data);
    const seasonalVar = this.variance(seasonal);
    const residualVar = this.variance(residual);
    return seasonalVar / (seasonalVar + residualVar);
  }

  static durbinWatson(residuals: number[]): number {
    let sumDiff = 0;
    let sumSquared = 0;
    
    for (let i = 1; i < residuals.length; i++) {
      sumDiff += Math.pow(residuals[i] - residuals[i - 1], 2);
      sumSquared += Math.pow(residuals[i], 2);
    }
    sumSquared += Math.pow(residuals[0], 2);
    
    return sumDiff / sumSquared;
  }

  static boxPierce(residuals: number[]): { statistic: number; pValue: number } {
    const n = residuals.length;
    const maxLag = Math.min(20, Math.floor(n / 5));
    const acf = this.acf(residuals, maxLag);
    
    const statistic = n * this.sum(
      acf.slice(1).map(r => r * r)
    );
    
    const pValue = 1 - this.chiSquareCDF(statistic, maxLag);
    
    return { statistic, pValue };
  }

  static goldfeldQuandt(
    predicted: number[],
    residuals: number[]
  ): { statistic: number; pValue: number } {
    const n = residuals.length;
    const c = Math.floor(n / 3);
    
    // Sort by predicted values
    const pairs = predicted.map((p, i) => ({ p, r: residuals[i] }));
    pairs.sort((a, b) => a.p - b.p);
    
    // Calculate RSS for first and last thirds
    const rss1 = this.sum(
      pairs.slice(0, c).map(p => p.r * p.r)
    );
    const rss2 = this.sum(
      pairs.slice(n - c).map(p => p.r * p.r)
    );
    
    const statistic = rss2 / rss1;
    const df = c - 2;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(
      (statistic - 1) * Math.sqrt(df / 2)
    )));
    
    return { statistic, pValue };
  }

  static breuschPagan(
    predicted: number[],
    residuals: number[]
  ): { statistic: number; pValue: number } {
    const n = residuals.length;
    const squaredResiduals = residuals.map(r => r * r);
    const mean = this.mean(squaredResiduals);
    
    // Fit regression of squared residuals on predicted values
    const X = predicted.map(p => [1, p]);
    const y = squaredResiduals.map(r => r / mean);
    
    // Calculate explained sum of squares
    const yHat = this.multiply(X, this.olsEstimate(X, y));
    const ess = this.sum(yHat.map(h => Math.pow(h - 1, 2)));
    
    const statistic = n * ess / 2;
    const pValue = 1 - this.chiSquareCDF(statistic, 1);
    
    return { statistic, pValue };
  }

  private static multiply(X: number[][], beta: number[]): number[] {
    return X.map(row => 
      row.reduce((sum, x, i) => sum + x * beta[i], 0)
    );
  }

  private static olsEstimate(X: number[][], y: number[]): number[] {
    const Xt = X[0].map((_, i) => X.map(row => row[i]));
    const XtX = Xt.map(row => 
      X[0].map((_, j) => 
        row.reduce((sum, x, k) => sum + x * X[k][j], 0)
      )
    );
    const Xty = Xt.map(row => 
      row.reduce((sum, x, i) => sum + x * y[i], 0)
    );
    
    // Solve system using Gaussian elimination
    const n = XtX.length;
    const augmented = XtX.map((row, i) => [...row, Xty[i]]);
    
    for (let i = 0; i < n; i++) {
      const pivot = augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[i][j] /= pivot;
      }
      
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i];
          for (let j = i; j <= n; j++) {
            augmented[k][j] -= factor * augmented[i][j];
          }
        }
      }
    }
    
    return augmented.map(row => row[n]);
  }
} 