import { StatisticalUtils } from './StatisticalUtils';
import { ModelDiagnostics } from './ModelDiagnostics';

interface BaseModel {
  fit: (data: Array<{ timestamp: Date; value: number }>) => void;
  predict: (horizon: number) => number[];
  getParameters: () => Record<string, number>;
}

interface EnsembleConfig {
  models: BaseModel[];
  weightingStrategy: 'equal' | 'performance' | 'dynamic' | 'stacked';
  evaluationMetric?: 'mape' | 'rmse' | 'mae' | 'r2';
  dynamicWindowSize?: number;
}

export class EnsembleModel implements BaseModel {
  private models: BaseModel[];
  private weights: number[];
  private config: EnsembleConfig;
  private trainData: Array<{ timestamp: Date; value: number }>;
  private stackingModel: BaseModel | null = null;

  constructor(config: EnsembleConfig) {
    this.models = config.models;
    this.config = config;
    this.weights = new Array(config.models.length).fill(1 / config.models.length);
    this.trainData = [];
  }

  fit(data: Array<{ timestamp: Date; value: number }>) {
    this.trainData = data;

    // Train individual models
    this.models.forEach(model => model.fit(data));

    // Calculate weights based on strategy
    switch (this.config.weightingStrategy) {
      case 'equal':
        this.calculateEqualWeights();
        break;
      case 'performance':
        this.calculatePerformanceBasedWeights();
        break;
      case 'dynamic':
        this.calculateDynamicWeights();
        break;
      case 'stacked':
        this.fitStackingModel();
        break;
    }
  }

  predict(horizon: number): number[] {
    const predictions = this.models.map(model => model.predict(horizon));
    
    if (this.config.weightingStrategy === 'stacked' && this.stackingModel) {
      return this.generateStackedPredictions(predictions, horizon);
    }

    return this.combineWeightedPredictions(predictions, horizon);
  }

  getParameters(): Record<string, number> {
    return {
      numModels: this.models.length,
      ...Object.fromEntries(
        this.weights.map((w, i) => [`weight_${i}`, w])
      )
    };
  }

  private calculateEqualWeights() {
    this.weights = new Array(this.models.length).fill(1 / this.models.length);
  }

  private calculatePerformanceBasedWeights() {
    const metric = this.config.evaluationMetric || 'rmse';
    const errors = this.models.map(model => {
      const predictions = model.predict(this.trainData.length);
      const metrics = ModelDiagnostics.calculateMetrics(
        this.trainData.map(d => d.value),
        predictions
      );
      return metrics[metric];
    });

    // Convert errors to weights (lower error = higher weight)
    const totalError = errors.reduce((a, b) => a + b, 0);
    this.weights = errors.map(error => 
      (totalError - error) / ((this.models.length - 1) * totalError)
    );
  }

  private calculateDynamicWeights() {
    const windowSize = this.config.dynamicWindowSize || 10;
    const metric = this.config.evaluationMetric || 'rmse';
    
    // Calculate rolling window performance
    const rollingMetrics = this.models.map(model => 
      ModelDiagnostics.performRollingWindowAnalysis(
        this.trainData,
        windowSize,
        1,
        (data) => {
          model.fit(data);
          return model;
        },
        (m, h) => m.predict(h)
      )
    );

    // Use recent performance to calculate weights
    const recentErrors = rollingMetrics.map(metrics => 
      metrics.slice(-5).reduce((sum, m) => sum + m.metrics[metric], 0) / 5
    );

    // Convert recent errors to weights
    const totalError = recentErrors.reduce((a, b) => a + b, 0);
    this.weights = recentErrors.map(error => 
      (totalError - error) / ((this.models.length - 1) * totalError)
    );
  }

  private fitStackingModel() {
    // Generate level-0 predictions
    const level0Predictions = this.models.map(model => {
      const predictions = model.predict(this.trainData.length);
      return predictions.map((p, i) => ({
        timestamp: this.trainData[i].timestamp,
        value: p
      }));
    });

    // Prepare training data for meta-model
    const metaFeatures = this.trainData.map((d, i) => ({
      timestamp: d.timestamp,
      value: d.value,
      predictions: level0Predictions.map(preds => preds[i].value)
    }));

    // Train meta-model (using simple weighted average for now)
    this.calculatePerformanceBasedWeights();
  }

  private generateStackedPredictions(
    basePredictions: number[][],
    horizon: number
  ): number[] {
    // For each time step, combine predictions using meta-model
    return Array.from({ length: horizon }, (_, h) => 
      basePredictions.reduce((sum, preds, i) => 
        sum + preds[h] * this.weights[i], 0
      )
    );
  }

  private combineWeightedPredictions(
    predictions: number[][],
    horizon: number
  ): number[] {
    return Array.from({ length: horizon }, (_, h) => 
      predictions.reduce((sum, preds, i) => 
        sum + preds[h] * this.weights[i], 0
      )
    );
  }
} 