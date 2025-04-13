import { prisma } from '../../../lib/prisma';
import { StatisticalUtils } from './StatisticalUtils';
import { 
  ForecastModel, 
  TimeSeriesData, 
  MarketTrend, 
  PredictionInterval 
} from '@prisma/client';

interface ForecastConfig {
  horizon: number;  // forecast periods ahead
  confidence: number;  // confidence level (0-1)
  seasonality: boolean;
  includeExternalFactors: boolean;
  modelType: 'arima' | 'prophet' | 'lstm' | 'ensemble';
}

interface ModelMetrics {
  mape: number;  // Mean Absolute Percentage Error
  rmse: number;  // Root Mean Square Error
  mae: number;   // Mean Absolute Error
  r2: number;    // R-squared value
}

interface ForecastResult {
  predictions: Array<{
    timestamp: Date;
    value: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }>;
  metrics: ModelMetrics;
  factors: Array<{
    name: string;
    importance: number;
    correlation: number;
  }>;
}

interface SARIMAConfig extends ForecastConfig {
  seasonal: {
    P: number;  // Seasonal autoregressive order
    D: number;  // Seasonal differencing order
    Q: number;  // Seasonal moving average order
    m: number;  // Seasonal period
  };
}

interface ModelDiagnostics {
  residualTests: {
    normalityTest: {  // Jarque-Bera test
      statistic: number;
      pValue: number;
    };
    autocorrelationTest: {  // Ljung-Box test
      statistic: number;
      pValue: number;
    };
    heteroskedasticityTest: {  // Breusch-Pagan test
      statistic: number;
      pValue: number;
    };
  };
  informationCriteria: {
    aic: number;
    bic: number;
    hqic: number;  // Hannan-Quinn information criterion
  };
  forecastAccuracy: {
    mape: number;
    rmse: number;
    mae: number;
    r2: number;
    theilU: number;  // Theil's U statistic
  };
}

export class ForecastingService {
  // Initialize a new forecast model
  async initializeModel(
    modelName: string,
    config: ForecastConfig,
    metadata?: Record<string, any>
  ) {
    const model = await prisma.forecastModel.create({
      data: {
        name: modelName,
        config,
        metadata: metadata || {},
        status: 'initializing',
        createdAt: new Date(),
        lastTraining: null
      }
    });

    // Initialize model parameters based on type
    await this.setupModelParameters(model.id, config.modelType);

    return model;
  }

  // Train model with historical data
  async trainModel(
    modelId: string,
    trainingData: TimeSeriesData[],
    options?: {
      validationSplit?: number;
      epochs?: number;
      earlyStoppingPatience?: number;
    }
  ) {
    const model = await prisma.forecastModel.findUnique({
      where: { id: modelId }
    });

    if (!model) throw new Error('Model not found');

    try {
      // Preprocess data
      const processedData = await this.preprocessData(trainingData);

      // Train based on model type
      const trainingResult = await this.executeTraining(
        model.config.modelType,
        processedData,
        options
      );

      // Update model with training results
      await prisma.forecastModel.update({
        where: { id: modelId },
        data: {
          status: 'trained',
          lastTraining: new Date(),
          metrics: trainingResult.metrics,
          metadata: {
            ...model.metadata,
            trainingHistory: trainingResult.history
          }
        }
      });

      return trainingResult;
    } catch (error) {
      await prisma.forecastModel.update({
        where: { id: modelId },
        data: {
          status: 'error',
          metadata: {
            ...model.metadata,
            lastError: error.message
          }
        }
      });
      throw error;
    }
  }

  // Generate forecasts
  async generateForecast(
    modelId: string,
    horizon: number,
    options?: {
      includeConfidenceIntervals?: boolean;
      scenarioAnalysis?: boolean;
      externalFactors?: Record<string, number[]>;
    }
  ): Promise<ForecastResult> {
    const model = await prisma.forecastModel.findUnique({
      where: { id: modelId }
    });

    if (!model) throw new Error('Model not found');
    if (model.status !== 'trained') throw new Error('Model not trained');

    // Get latest data for forecasting
    const latestData = await this.getLatestData(modelId);

    // Generate predictions
    const predictions = await this.executePrediction(
      model.config.modelType,
      latestData,
      horizon,
      options
    );

    // Calculate confidence intervals if requested
    if (options?.includeConfidenceIntervals) {
      await this.calculateConfidenceIntervals(predictions, model.config.confidence);
    }

    // Perform scenario analysis if requested
    if (options?.scenarioAnalysis) {
      await this.performScenarioAnalysis(predictions, options.externalFactors);
    }

    // Store forecast results
    await this.storeForecastResults(modelId, predictions);

    return predictions;
  }

  // Analyze forecast accuracy
  async analyzeForecastAccuracy(
    modelId: string,
    actualData: TimeSeriesData[]
  ): Promise<ModelMetrics> {
    const forecasts = await prisma.forecastResult.findMany({
      where: { modelId },
      orderBy: { timestamp: 'desc' },
      take: actualData.length
    });

    const metrics = this.calculateMetrics(forecasts, actualData);

    // Update model metrics
    await prisma.forecastModel.update({
      where: { id: modelId },
      data: {
        metrics: metrics
      }
    });

    return metrics;
  }

  // Private helper methods
  private async preprocessData(data: TimeSeriesData[]) {
    // Handle missing values
    const cleanedData = this.handleMissingValues(data);

    // Normalize data
    const normalizedData = this.normalizeData(cleanedData);

    // Detect and handle outliers
    const processedData = this.handleOutliers(normalizedData);

    return processedData;
  }

  private async executeTraining(
    modelType: string,
    data: TimeSeriesData[],
    options?: any
  ) {
    switch (modelType) {
      case 'arima':
        return this.trainARIMA(data, options);
      case 'prophet':
        return this.trainProphet(data, options);
      case 'lstm':
        return this.trainLSTM(data, options);
      case 'ensemble':
        return this.trainEnsemble(data, options);
      default:
        throw new Error(`Unsupported model type: ${modelType}`);
    }
  }

  private async executePrediction(
    modelType: string,
    data: TimeSeriesData[],
    horizon: number,
    options?: any
  ) {
    // Implementation for different model types
    switch (modelType) {
      case 'arima':
        return this.predictARIMA(data, horizon, options);
      case 'prophet':
        return this.predictProphet(data, horizon, options);
      case 'lstm':
        return this.predictLSTM(data, horizon, options);
      case 'ensemble':
        return this.predictEnsemble(data, horizon, options);
      default:
        throw new Error(`Unsupported model type: ${modelType}`);
    }
  }

  private handleMissingValues(data: TimeSeriesData[]) {
    // Implement sophisticated missing value imputation
    return data.map(point => ({
      ...point,
      value: point.value || this.interpolateValue(data, point.timestamp)
    }));
  }

  private normalizeData(data: TimeSeriesData[]) {
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    );

    return data.map(point => ({
      ...point,
      value: (point.value - mean) / std
    }));
  }

  private handleOutliers(data: TimeSeriesData[]) {
    const values = data.map(d => d.value);
    const q1 = this.calculateQuantile(values, 0.25);
    const q3 = this.calculateQuantile(values, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return data.map(point => ({
      ...point,
      value: Math.max(lowerBound, Math.min(upperBound, point.value))
    }));
  }

  private calculateQuantile(values: number[], q: number) {
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
      return sorted[base];
    }
  }

  private interpolateValue(data: TimeSeriesData[], timestamp: Date) {
    // Implement linear interpolation for missing values
    const sortedData = [...data].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    const targetTime = timestamp.getTime();
    let before = sortedData.filter(d => d.timestamp.getTime() < targetTime).pop();
    let after = sortedData.find(d => d.timestamp.getTime() > targetTime);

    if (!before || !after) return null;

    const timeDiff = after.timestamp.getTime() - before.timestamp.getTime();
    const valueDiff = after.value - before.value;
    const timeFromBefore = targetTime - before.timestamp.getTime();

    return before.value + (valueDiff * timeFromBefore) / timeDiff;
  }

  private calculateMetrics(
    forecasts: any[],
    actuals: TimeSeriesData[]
  ): ModelMetrics {
    const pairs = forecasts.map((f, i) => ({
      forecast: f.value,
      actual: actuals[i].value
    }));

    const mape = this.calculateMAPE(pairs);
    const rmse = this.calculateRMSE(pairs);
    const mae = this.calculateMAE(pairs);
    const r2 = this.calculateR2(pairs);

    return { mape, rmse, mae, r2 };
  }

  private calculateMAPE(pairs: Array<{ forecast: number; actual: number }>) {
    return (
      pairs.reduce(
        (sum, pair) =>
          sum + Math.abs((pair.actual - pair.forecast) / pair.actual),
        0
      ) / pairs.length
    ) * 100;
  }

  private calculateRMSE(pairs: Array<{ forecast: number; actual: number }>) {
    return Math.sqrt(
      pairs.reduce(
        (sum, pair) => sum + Math.pow(pair.actual - pair.forecast, 2),
        0
      ) / pairs.length
    );
  }

  private calculateMAE(pairs: Array<{ forecast: number; actual: number }>) {
    return (
      pairs.reduce(
        (sum, pair) => sum + Math.abs(pair.actual - pair.forecast),
        0
      ) / pairs.length
    );
  }

  private calculateR2(pairs: Array<{ forecast: number; actual: number }>) {
    const actualMean =
      pairs.reduce((sum, pair) => sum + pair.actual, 0) / pairs.length;
    const totalSS = pairs.reduce(
      (sum, pair) => sum + Math.pow(pair.actual - actualMean, 2),
      0
    );
    const residualSS = pairs.reduce(
      (sum, pair) => sum + Math.pow(pair.actual - pair.forecast, 2),
      0
    );
    return 1 - residualSS / totalSS;
  }

  private async trainARIMA(
    data: TimeSeriesData[],
    options?: {
      validationSplit?: number;
      maxOrder?: { p: number; d: number; q: number };
      criterion?: 'aic' | 'bic';
    }
  ) {
    // Extract time series values
    const values = data.map(d => d.value);
    
    // Determine optimal ARIMA parameters using grid search
    const optimalParams = await this.findOptimalARIMAParams(
      values,
      options?.maxOrder || { p: 5, d: 2, q: 5 },
      options?.criterion || 'aic'
    );

    // Fit ARIMA model with optimal parameters
    const model = await this.fitARIMA(values, optimalParams);

    // Validate model if validation split is specified
    let validationMetrics = null;
    if (options?.validationSplit) {
      const splitIndex = Math.floor(values.length * (1 - options.validationSplit));
      const trainData = values.slice(0, splitIndex);
      const validData = values.slice(splitIndex);
      
      // Fit model on training data
      const validationModel = await this.fitARIMA(trainData, optimalParams);
      
      // Generate predictions for validation period
      const validationPreds = await this.generateARIMAPredictions(
        validationModel,
        trainData,
        validData.length
      );

      // Calculate validation metrics
      validationMetrics = this.calculateMetrics(
        validationPreds.map((v, i) => ({ forecast: v, actual: validData[i] })),
        []
      );
    }

    return {
      model,
      params: optimalParams,
      metrics: validationMetrics,
      history: {
        parameterSearch: optimalParams.searchHistory,
        training: model.stats
      }
    };
  }

  private async findOptimalARIMAParams(
    data: number[],
    maxOrder: { p: number; d: number; q: number },
    criterion: 'aic' | 'bic'
  ) {
    let bestParams = { p: 0, d: 0, q: 0 };
    let bestScore = Infinity;
    const searchHistory = [];

    // Determine optimal differencing order (d) using unit root tests
    const d = await this.determineOptimalDifferencingOrder(data, maxOrder.d);

    // Grid search over p and q values
    for (let p = 0; p <= maxOrder.p; p++) {
      for (let q = 0; q <= maxOrder.q; q++) {
        try {
          const model = await this.fitARIMA(data, { p, d, q });
          const score = criterion === 'aic' ? model.aic : model.bic;

          searchHistory.push({
            params: { p, d, q },
            score,
            timestamp: new Date()
          });

          if (score < bestScore) {
            bestScore = score;
            bestParams = { p, d, q };
          }
        } catch (error) {
          // Skip invalid parameter combinations
          continue;
        }
      }
    }

    return { ...bestParams, searchHistory };
  }

  private async determineOptimalDifferencingOrder(data: number[], maxD: number) {
    let d = 0;
    let isStationary = await this.checkStationarity(data);

    while (!isStationary && d < maxD) {
      d++;
      const diffData = this.difference(data, d);
      isStationary = await this.checkStationarity(diffData);
    }

    return d;
  }

  private async checkStationarity(data: number[]): Promise<boolean> {
    // Augmented Dickey-Fuller test implementation
    const n = data.length;
    const diffData = this.difference(data, 1);
    const lagData = data.slice(0, -1);
    
    // Prepare matrices for regression
    const X = [];
    const y = diffData.slice(1);
    
    for (let i = 0; i < n - 2; i++) {
      X.push([1, lagData[i + 1]]); // Include constant term
    }

    // Perform OLS regression
    const { coefficients, standardErrors } = this.performOLS(X, y);
    
    // Calculate test statistic
    const testStat = (coefficients[1] - 1) / standardErrors[1];
    
    // Critical values for 5% significance level
    const criticalValue = -2.86;
    
    return testStat < criticalValue;
  }

  private async fitARIMA(
    data: number[],
    params: { p: number; d: number; q: number }
  ) {
    // Apply differencing
    let diffData = this.difference(data, params.d);

    // Prepare matrices for AR and MA components
    const n = diffData.length;
    const X = [];
    const y = diffData.slice(Math.max(params.p, params.q));

    // Add AR terms
    for (let i = 0; i < n - Math.max(params.p, params.q); i++) {
      const row = [];
      for (let j = 1; j <= params.p; j++) {
        row.push(diffData[i + Math.max(params.p, params.q) - j]);
      }
      X.push(row);
    }

    // Add MA terms using residuals
    let residuals = new Array(n).fill(0);
    for (let iteration = 0; iteration < 10; iteration++) {
      // Update MA terms
      for (let i = 0; i < X.length; i++) {
        for (let j = 1; j <= params.q; j++) {
          X[i].push(residuals[i + Math.max(params.p, params.q) - j]);
        }
      }

      // Fit model
      const { coefficients, residuals: newResiduals } = this.performOLS(X, y);
      
      // Check convergence
      if (this.checkConvergence(residuals, newResiduals)) {
        return {
          coefficients,
          residuals: newResiduals,
          aic: this.calculateAIC(newResiduals, params),
          bic: this.calculateBIC(newResiduals, params, n),
          stats: {
            iterations: iteration + 1,
            finalResidualSS: this.sumSquares(newResiduals)
          }
        };
      }
      
      residuals = newResiduals;
    }

    throw new Error('ARIMA fitting did not converge');
  }

  private async predictARIMA(
    data: TimeSeriesData[],
    horizon: number,
    options?: any
  ) {
    const values = data.map(d => d.value);
    const model = await this.trainARIMA(data);
    
    return this.generateARIMAPredictions(model, values, horizon);
  }

  private async generateARIMAPredictions(
    model: any,
    data: number[],
    horizon: number
  ) {
    const predictions = [];
    let currentData = [...data];

    for (let h = 0; h < horizon; h++) {
      // Generate next prediction
      const nextValue = this.generateNextARIMAValue(
        currentData,
        model.coefficients,
        model.residuals,
        { p: model.params.p, q: model.params.q }
      );

      predictions.push(nextValue);
      currentData.push(nextValue);
    }

    return predictions;
  }

  private generateNextARIMAValue(
    data: number[],
    coefficients: number[],
    residuals: number[],
    params: { p: number; q: number }
  ) {
    let prediction = 0;
    
    // Add AR components
    for (let i = 0; i < params.p; i++) {
      prediction += coefficients[i] * data[data.length - 1 - i];
    }
    
    // Add MA components
    for (let i = 0; i < params.q; i++) {
      prediction += coefficients[params.p + i] * residuals[residuals.length - 1 - i];
    }
    
    return prediction;
  }

  private difference(data: number[], order: number): number[] {
    let result = [...data];
    for (let d = 0; d < order; d++) {
      const temp = [];
      for (let i = 1; i < result.length; i++) {
        temp.push(result[i] - result[i - 1]);
      }
      result = temp;
    }
    return result;
  }

  private performOLS(X: number[][], y: number[]) {
    // Simple OLS implementation using normal equations
    const Xt = this.transpose(X);
    const XtX = this.matrixMultiply(Xt, X);
    const XtXInv = this.inverse(XtX);
    const Xty = this.matrixMultiply(Xt, y.map(v => [v]));
    
    const coefficients = this.matrixMultiply(XtXInv, Xty).map(row => row[0]);
    
    // Calculate residuals
    const yHat = this.matrixMultiply(X, coefficients.map(c => [c])).map(row => row[0]);
    const residuals = y.map((yi, i) => yi - yHat[i]);
    
    // Calculate standard errors
    const mse = this.sumSquares(residuals) / (y.length - coefficients.length);
    const varCovar = this.scalarMultiply(XtXInv, mse);
    const standardErrors = varCovar.map((row, i) => Math.sqrt(row[i]));

    return { coefficients, residuals, standardErrors };
  }

  // Matrix operation helper methods
  private transpose(matrix: number[][]) {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
  }

  private matrixMultiply(a: number[][], b: number[][]) {
    return a.map(row => 
      b[0].map((_, i) => 
        row.reduce((sum, cell, j) => sum + cell * b[j][i], 0)
      )
    );
  }

  private inverse(matrix: number[][]) {
    // Simple implementation for 2x2 matrices
    // For larger matrices, use LU decomposition or similar methods
    const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    return [
      [matrix[1][1] / det, -matrix[0][1] / det],
      [-matrix[1][0] / det, matrix[0][0] / det]
    ];
  }

  private scalarMultiply(matrix: number[][], scalar: number) {
    return matrix.map(row => row.map(cell => cell * scalar));
  }

  private sumSquares(array: number[]) {
    return array.reduce((sum, val) => sum + val * val, 0);
  }

  private checkConvergence(oldResiduals: number[], newResiduals: number[]) {
    const tolerance = 1e-6;
    const diff = oldResiduals.reduce(
      (sum, val, i) => sum + Math.abs(val - newResiduals[i]),
      0
    );
    return diff < tolerance;
  }

  private calculateAIC(residuals: number[], params: { p: number; d: number; q: number }) {
    const n = residuals.length;
    const k = params.p + params.q + 1; // Add 1 for variance parameter
    const rss = this.sumSquares(residuals);
    return n * Math.log(rss / n) + 2 * k;
  }

  private calculateBIC(
    residuals: number[],
    params: { p: number; d: number; q: number },
    n: number
  ) {
    const k = params.p + params.q + 1;
    const rss = this.sumSquares(residuals);
    return n * Math.log(rss / n) + k * Math.log(n);
  }

  private async trainSARIMA(
    data: TimeSeriesData[],
    options?: {
      validationSplit?: number;
      maxOrder?: {
        p: number;
        d: number;
        q: number;
        P: number;
        D: number;
        Q: number;
        m: number;
      };
      criterion?: 'aic' | 'bic' | 'hqic';
    }
  ) {
    const values = data.map(d => d.value);
    
    // Find optimal parameters including seasonal components
    const optimalParams = await this.findOptimalSARIMAParams(
      values,
      options?.maxOrder || { 
        p: 5, d: 2, q: 5,
        P: 2, D: 1, Q: 2,
        m: this.detectSeasonalPeriod(values)
      },
      options?.criterion || 'aic'
    );

    // Fit SARIMA model
    const model = await this.fitSARIMA(values, optimalParams);

    // Calculate model diagnostics
    const diagnostics = await this.calculateModelDiagnostics(
      values,
      model.residuals,
      optimalParams
    );

    return {
      model,
      params: optimalParams,
      diagnostics,
      history: {
        parameterSearch: optimalParams.searchHistory,
        training: model.stats
      }
    };
  }

  private async fitSARIMA(
    data: number[],
    params: {
      p: number;
      d: number;
      q: number;
      P: number;
      D: number;
      Q: number;
      m: number;
    }
  ) {
    // Apply seasonal and non-seasonal differencing
    let diffData = this.seasonalDifference(
      this.difference(data, params.d),
      params.D,
      params.m
    );

    // Prepare matrices for AR, MA, SAR, and SMA components
    const n = diffData.length;
    const X = [];
    const y = diffData.slice(
      Math.max(
        params.p + params.m * params.P,
        params.q + params.m * params.Q
      )
    );

    // Add AR and SAR terms
    for (let i = 0; i < n - Math.max(params.p + params.m * params.P, params.q + params.m * params.Q); i++) {
      const row = [];
      // Non-seasonal AR terms
      for (let j = 1; j <= params.p; j++) {
        row.push(diffData[i + Math.max(params.p + params.m * params.P, params.q + params.m * params.Q) - j]);
      }
      // Seasonal AR terms
      for (let j = 1; j <= params.P; j++) {
        row.push(diffData[i + Math.max(params.p + params.m * params.P, params.q + params.m * params.Q) - j * params.m]);
      }
      X.push(row);
    }

    // Initialize residuals
    let residuals = new Array(n).fill(0);
    
    // Iterative fitting process
    for (let iteration = 0; iteration < 20; iteration++) {
      // Add MA and SMA terms
      for (let i = 0; i < X.length; i++) {
        // Non-seasonal MA terms
        for (let j = 1; j <= params.q; j++) {
          X[i].push(residuals[i + Math.max(params.p + params.m * params.P, params.q + params.m * params.Q) - j]);
        }
        // Seasonal MA terms
        for (let j = 1; j <= params.Q; j++) {
          X[i].push(residuals[i + Math.max(params.p + params.m * params.P, params.q + params.m * params.Q) - j * params.m]);
        }
      }

      // Fit model
      const { coefficients, residuals: newResiduals, standardErrors } = this.performOLS(X, y);
      
      // Check convergence
      if (this.checkConvergence(residuals, newResiduals)) {
        return {
          coefficients,
          residuals: newResiduals,
          standardErrors,
          aic: this.calculateAIC(newResiduals, params),
          bic: this.calculateBIC(newResiduals, params, n),
          hqic: this.calculateHQIC(newResiduals, params, n),
          stats: {
            iterations: iteration + 1,
            finalResidualSS: this.sumSquares(newResiduals)
          }
        };
      }
      
      residuals = newResiduals;
    }

    throw new Error('SARIMA fitting did not converge');
  }

  private async calculateConfidenceIntervals(
    predictions: any[],
    confidence: number
  ) {
    for (const pred of predictions) {
      const stderr = Math.sqrt(pred.variance);
      const alpha = 1 - confidence;
      const criticalValue = StatisticalUtils.normalInverseCDF(1 - alpha / 2);
      
      pred.lowerBound = pred.value - criticalValue * stderr;
      pred.upperBound = pred.value + criticalValue * stderr;
      pred.confidence = confidence;
    }
  }

  private async calculateModelDiagnostics(
    data: number[],
    residuals: number[],
    params: any
  ): Promise<ModelDiagnostics> {
    return {
      residualTests: {
        normalityTest: await this.performJarqueBeraTest(residuals),
        autocorrelationTest: await this.performLjungBoxTest(residuals, 10),
        heteroskedasticityTest: await this.performBreuschPaganTest(residuals, data)
      },
      informationCriteria: {
        aic: this.calculateAIC(residuals, params),
        bic: this.calculateBIC(residuals, params, data.length),
        hqic: this.calculateHQIC(residuals, params, data.length)
      },
      forecastAccuracy: {
        mape: this.calculateMAPE(data, residuals),
        rmse: this.calculateRMSE(data, residuals),
        mae: this.calculateMAE(data, residuals),
        r2: this.calculateR2(data, residuals),
        theilU: this.calculateTheilU(data, residuals)
      }
    };
  }

  private async performJarqueBeraTest(residuals: number[]) {
    const n = residuals.length;
    const mean = residuals.reduce((a, b) => a + b, 0) / n;
    const variance = this.sumSquares(residuals.map(r => r - mean)) / (n - 1);
    
    // Calculate skewness and kurtosis
    const skewness = this.calculateSkewness(residuals, mean, variance);
    const kurtosis = this.calculateKurtosis(residuals, mean, variance);
    
    // Calculate JB statistic
    const jbStat = n * (Math.pow(skewness, 2) / 6 + Math.pow(kurtosis - 3, 2) / 24);
    
    // p-value from chi-square distribution with 2 degrees of freedom
    const pValue = 1 - this.chiSquareCDF(jbStat, 2);
    
    return { statistic: jbStat, pValue };
  }

  private calculateHQIC(residuals: number[], params: any, n: number) {
    const k = params.p + params.q + params.P + params.Q + 2; // Add 2 for variance and constant
    const rss = this.sumSquares(residuals);
    return n * Math.log(rss / n) + 2 * k * Math.log(Math.log(n));
  }

  private calculateTheilU(actuals: number[], forecasts: number[]) {
    const n = actuals.length;
    const numerator = Math.sqrt(
      this.sumSquares(actuals.map((a, i) => forecasts[i] - a)) / n
    );
    const denominator = Math.sqrt(
      this.sumSquares(actuals) / n
    );
    return numerator / denominator;
  }

  private detectSeasonalPeriod(data: number[]): number {
    // Implement seasonal period detection using autocorrelation
    const maxLag = Math.min(data.length - 1, 365); // Maximum lag to consider
    const acf = this.calculateACF(data, maxLag);
    
    // Find peaks in ACF
    const peaks = this.findPeaks(acf);
    
    // Return the first significant peak
    const significantPeaks = peaks.filter(p => acf[p] > 2 / Math.sqrt(data.length));
    return significantPeaks.length > 0 ? significantPeaks[0] : 1;
  }

  private calculateACF(data: number[], maxLag: number): number[] {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = this.sumSquares(data.map(x => x - mean)) / data.length;
    
    return Array.from({ length: maxLag + 1 }, (_, k) => {
      let sum = 0;
      for (let t = k; t < data.length; t++) {
        sum += (data[t] - mean) * (data[t - k] - mean);
      }
      return sum / (data.length * variance);
    });
  }

  private findPeaks(data: number[]): number[] {
    const peaks = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        peaks.push(i);
      }
    }
    return peaks;
  }

  private seasonalDifference(data: number[], D: number, m: number): number[] {
    let result = [...data];
    for (let d = 0; d < D; d++) {
      const temp = [];
      for (let i = 0; i < result.length; i++) {
        temp.push(result[i] - result[i - m]);
      }
      result = temp;
    }
    return result;
  }

  private calculateSkewness(data: number[], mean: number, variance: number) {
    const n = data.length;
    const sum = data.reduce((a, b) => a + Math.pow(b - mean, 3), 0);
    return sum / (n * Math.pow(variance, 1.5));
  }

  private calculateKurtosis(data: number[], mean: number, variance: number) {
    const n = data.length;
    const sum = data.reduce((a, b) => a + Math.pow(b - mean, 4), 0);
    return sum / (n * Math.pow(variance, 2)) - 3;
  }

  private chiSquareCDF(x: number, k: number) {
    // Implement chi-square CDF calculation
    // This is a placeholder and should be replaced with a proper implementation
    return 0.5; // Placeholder return, actual implementation needed
  }

  private normalInverseCDF(p: number) {
    // Implement normal inverse CDF calculation
    // This is a placeholder and should be replaced with a proper implementation
    return 0; // Placeholder return, actual implementation needed
  }

  private calculatePredictionVariances(params: any, sigma: number, horizon: number) {
    // Implement prediction variance calculation
    // This is a placeholder and should be replaced with a proper implementation
    return Array(horizon).fill(Math.pow(sigma, 2)); // Placeholder return, actual implementation needed
  }

  private performLjungBoxTest(residuals: number[], maxLag: number) {
    const n = residuals.length;
    let Q = 0;
    const acf = StatisticalUtils.acf(residuals, maxLag);
    
    for (let k = 1; k <= maxLag; k++) {
      Q += Math.pow(acf[k], 2) / (n - k);
    }
    Q = n * (n + 2) * Q;
    
    // p-value from chi-square distribution with maxLag degrees of freedom
    const pValue = 1 - StatisticalUtils.chiSquareCDF(Q, maxLag);
    
    return { statistic: Q, pValue };
  }

  private performBreuschPaganTest(residuals: number[], data: number[]) {
    const n = residuals.length;
    
    // Fit squared residuals against original data
    const squaredResiduals = residuals.map(r => r * r);
    const X = data.map(x => [1, x]);  // Add constant term
    
    const { coefficients } = this.performOLS(X, squaredResiduals);
    
    // Calculate test statistic
    const rss = this.sumSquares(squaredResiduals);
    const explained = squaredResiduals.reduce((sum, r2, i) => {
      const predicted = coefficients[0] + coefficients[1] * data[i];
      return sum + Math.pow(predicted - r2, 2);
    }, 0);
    
    const statistic = explained / (2 * Math.pow(rss / n, 2));
    
    // p-value from chi-square distribution with 1 degree of freedom
    const pValue = 1 - StatisticalUtils.chiSquareCDF(statistic, 1);
    
    return { statistic, pValue };
  }

  private generateCombinations(arrays: number[][]): number[][] {
    if (arrays.length === 0) return [[]];
    
    const [first, ...rest] = arrays;
    const restCombinations = this.generateCombinations(rest);
    
    return first.flatMap(x => 
      restCombinations.map(combination => [x, ...combination])
    );
  }

  private adjustPredictions(
    predictions: any[],
    factorNames: string[],
    factorValues: number[]
  ) {
    // Simple linear adjustment for demonstration
    // In practice, you would use a more sophisticated model
    return predictions.map(pred => ({
      ...pred,
      value: pred.value * (1 + factorValues.reduce((sum, val) => sum + val, 0) / factorNames.length),
      factors: Object.fromEntries(factorNames.map((name, i) => [name, factorValues[i]]))
    }));
  }

  private async setupModelParameters(modelId: string, modelType: string) {
    const defaultParams = {
      arima: {
        p: 1,
        d: 1,
        q: 1,
        seasonal: {
          P: 1,
          D: 1,
          Q: 1,
          m: 12
        }
      },
      prophet: {
        changepoint_prior_scale: 0.05,
        seasonality_prior_scale: 10,
        seasonality_mode: 'multiplicative'
      },
      lstm: {
        layers: [50, 50],
        dropout: 0.1,
        recurrent_dropout: 0.1,
        optimizer: 'adam'
      },
      ensemble: {
        models: ['arima', 'prophet', 'lstm'],
        weights: [0.4, 0.3, 0.3]
      }
    };

    await prisma.forecastModel.update({
      where: { id: modelId },
      data: {
        metadata: {
          parameters: defaultParams[modelType]
        }
      }
    });
  }

  private async getLatestData(modelId: string) {
    return await prisma.timeSeriesData.findMany({
      where: { modelId },
      orderBy: { timestamp: 'desc' },
      take: 100  // Adjust based on your needs
    });
  }

  private async storeForecastResults(modelId: string, predictions: any[]) {
    await prisma.forecastResult.createMany({
      data: predictions.map(pred => ({
        modelId,
        timestamp: pred.timestamp,
        value: pred.value,
        lowerBound: pred.lowerBound,
        upperBound: pred.upperBound,
        confidence: pred.confidence,
        metadata: {
          factors: pred.factors || null
        }
      }))
    });
  }
} 