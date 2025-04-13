import { StatisticalUtils } from './StatisticalUtils';

interface PlotData {
  type: string;
  data: Array<{
    x: number[] | Date[];
    y: number[];
    type?: string;
    mode?: string;
    name?: string;
    line?: {
      color?: string;
      dash?: string;
    };
  }>;
  layout: {
    title: string;
    xaxis: { title: string };
    yaxis: { title: string; type?: 'log' | 'linear' };
    showlegend?: boolean;
    [key: string]: any;
  };
}

export class DiagnosticPlots {
  static generatePlots(
    actual: number[],
    predicted: number[],
    residuals: number[],
    timestamps: Date[]
  ): PlotData[] {
    return [
      this.createResidualPlot(residuals, timestamps),
      this.createQQPlot(residuals),
      this.createACFPlot(residuals),
      this.createPACFPlot(residuals),
      this.createFitPlot(actual, predicted, timestamps),
      this.createResidualHistogram(residuals),
      this.createScaleLocationPlot(predicted, residuals),
      this.createSeasonalDecomposition(actual, timestamps),
      this.createPeriodogram(actual),
      this.createCumulativePeriodogram(actual),
      this.createResidualLagPlot(residuals),
      this.createPredictionIntervals(actual, predicted, residuals, timestamps)
    ];
  }

  private static createResidualPlot(
    residuals: number[],
    timestamps: Date[]
  ): PlotData {
    const std = StatisticalUtils.standardDeviation(residuals);
    const bands = [-2 * std, -std, 0, std, 2 * std];
    
    return {
      type: 'residual_plot',
      data: [
        {
          x: timestamps,
          y: residuals,
          type: 'scatter',
          mode: 'markers',
          name: 'Residuals'
        },
        ...bands.map(b => ({
          x: [timestamps[0], timestamps[timestamps.length - 1]],
          y: [b, b],
          type: 'scatter',
          mode: 'lines',
          name: `${Math.abs(b / std)}σ`,
          line: {
            dash: 'dash',
            color: b === 0 ? 'red' : 'gray'
          }
        }))
      ],
      layout: {
        title: 'Residual Plot',
        xaxis: { title: 'Time' },
        yaxis: { title: 'Residual' }
      }
    };
  }

  private static createQQPlot(residuals: number[]): PlotData {
    const n = residuals.length;
    const sorted = [...residuals].sort((a, b) => a - b);
    const theoretical = Array.from({ length: n }, (_, i) => 
      StatisticalUtils.normalQuantile((i + 0.5) / n)
    );
    
    // Add reference line
    const min = Math.min(...theoretical);
    const max = Math.max(...theoretical);
    
    return {
      type: 'qq_plot',
      data: [
        {
          x: theoretical,
          y: sorted,
          type: 'scatter',
          mode: 'markers',
          name: 'Q-Q Plot'
        },
        {
          x: [min, max],
          y: [min * StatisticalUtils.standardDeviation(residuals), 
              max * StatisticalUtils.standardDeviation(residuals)],
          type: 'scatter',
          mode: 'lines',
          name: 'Reference Line',
          line: { color: 'red', dash: 'dash' }
        }
      ],
      layout: {
        title: 'Normal Q-Q Plot',
        xaxis: { title: 'Theoretical Quantiles' },
        yaxis: { title: 'Sample Quantiles' }
      }
    };
  }

  private static createACFPlot(residuals: number[]): PlotData {
    const maxLag = Math.min(40, Math.floor(residuals.length / 4));
    const acf = StatisticalUtils.acf(residuals, maxLag);
    const confBand = 1.96 / Math.sqrt(residuals.length);
    
    return {
      type: 'acf_plot',
      data: [
        {
          x: Array.from({ length: maxLag + 1 }, (_, i) => i),
          y: acf,
          type: 'bar',
          name: 'ACF'
        },
        {
          x: [0, maxLag],
          y: [confBand, confBand],
          type: 'scatter',
          mode: 'lines',
          name: '95% Confidence',
          line: { color: 'red', dash: 'dash' }
        },
        {
          x: [0, maxLag],
          y: [-confBand, -confBand],
          type: 'scatter',
          mode: 'lines',
          name: '95% Confidence',
          line: { color: 'red', dash: 'dash' }
        }
      ],
      layout: {
        title: 'Autocorrelation Function',
        xaxis: { title: 'Lag' },
        yaxis: { title: 'ACF' }
      }
    };
  }

  private static createPACFPlot(residuals: number[]): PlotData {
    const maxLag = Math.min(40, Math.floor(residuals.length / 4));
    const pacf = StatisticalUtils.pacf(residuals, maxLag);
    const confBand = 1.96 / Math.sqrt(residuals.length);
    
    return {
      type: 'pacf_plot',
      data: [
        {
          x: Array.from({ length: maxLag }, (_, i) => i + 1),
          y: pacf,
          type: 'bar',
          name: 'PACF'
        },
        {
          x: [1, maxLag],
          y: [confBand, confBand],
          type: 'scatter',
          mode: 'lines',
          name: '95% Confidence',
          line: { color: 'red', dash: 'dash' }
        },
        {
          x: [1, maxLag],
          y: [-confBand, -confBand],
          type: 'scatter',
          mode: 'lines',
          name: '95% Confidence',
          line: { color: 'red', dash: 'dash' }
        }
      ],
      layout: {
        title: 'Partial Autocorrelation Function',
        xaxis: { title: 'Lag' },
        yaxis: { title: 'PACF' }
      }
    };
  }

  private static createFitPlot(
    actual: number[],
    predicted: number[],
    timestamps: Date[]
  ): PlotData {
    return {
      type: 'fit_plot',
      data: [
        {
          x: timestamps,
          y: actual,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Actual'
        },
        {
          x: timestamps,
          y: predicted,
          type: 'scatter',
          mode: 'lines',
          name: 'Fitted',
          line: { color: 'red' }
        }
      ],
      layout: {
        title: 'Model Fit',
        xaxis: { title: 'Time' },
        yaxis: { title: 'Value' }
      }
    };
  }

  private static createResidualHistogram(residuals: number[]): PlotData {
    const { bins, counts } = StatisticalUtils.histogram(residuals, 30);
    const normal = this.generateNormalCurve(residuals);
    
    return {
      type: 'residual_histogram',
      data: [
        {
          x: bins,
          y: counts,
          type: 'bar',
          name: 'Residuals'
        },
        {
          x: normal.x,
          y: normal.y,
          type: 'scatter',
          mode: 'lines',
          name: 'Normal',
          line: { color: 'red' }
        }
      ],
      layout: {
        title: 'Residual Distribution',
        xaxis: { title: 'Residual' },
        yaxis: { title: 'Frequency' }
      }
    };
  }

  private static createScaleLocationPlot(
    predicted: number[],
    residuals: number[]
  ): PlotData {
    const standardizedResiduals = residuals.map(r => 
      Math.sqrt(Math.abs(r / StatisticalUtils.standardDeviation(residuals)))
    );
    
    return {
      type: 'scale_location',
      data: [{
        x: predicted,
        y: standardizedResiduals,
        type: 'scatter',
        mode: 'markers',
        name: 'Scale-Location'
      }],
      layout: {
        title: 'Scale-Location Plot',
        xaxis: { title: 'Fitted Values' },
        yaxis: { title: '√|Standardized Residuals|' }
      }
    };
  }

  private static createSeasonalDecomposition(
    data: number[],
    timestamps: Date[]
  ): PlotData {
    const decomposition = StatisticalUtils.seasonalDecompose(data);
    
    return {
      type: 'seasonal_decomposition',
      data: [
        {
          x: timestamps,
          y: decomposition.trend,
          type: 'scatter',
          mode: 'lines',
          name: 'Trend'
        },
        {
          x: timestamps,
          y: decomposition.seasonal,
          type: 'scatter',
          mode: 'lines',
          name: 'Seasonal'
        },
        {
          x: timestamps,
          y: decomposition.residual,
          type: 'scatter',
          mode: 'lines',
          name: 'Residual'
        }
      ],
      layout: {
        title: 'Seasonal Decomposition',
        xaxis: { title: 'Time' },
        yaxis: { title: 'Component' },
        grid: { rows: 3, columns: 1 }
      }
    };
  }

  private static createPeriodogram(data: number[]): PlotData {
    const { frequencies, power } = StatisticalUtils.periodogram(data);
    
    return {
      type: 'periodogram',
      data: [{
        x: frequencies,
        y: power,
        type: 'scatter',
        mode: 'lines',
        name: 'Periodogram'
      }],
      layout: {
        title: 'Periodogram',
        xaxis: { title: 'Frequency' },
        yaxis: { title: 'Spectral Density', type: 'log' }
      }
    };
  }

  private static createCumulativePeriodogram(data: number[]): PlotData {
    const { frequencies, power } = StatisticalUtils.periodogram(data);
    const cumPower = power.reduce((acc, p, i) => 
      [...acc, (acc[i - 1] || 0) + p], [] as number[]
    );
    const normalizedCumPower = cumPower.map(p => p / cumPower[cumPower.length - 1]);
    
    return {
      type: 'cumulative_periodogram',
      data: [{
        x: frequencies,
        y: normalizedCumPower,
        type: 'scatter',
        mode: 'lines',
        name: 'Cumulative Periodogram'
      }],
      layout: {
        title: 'Cumulative Periodogram',
        xaxis: { title: 'Frequency' },
        yaxis: { title: 'Cumulative Power' }
      }
    };
  }

  private static createResidualLagPlot(residuals: number[]): PlotData {
    const laggedResiduals = residuals.slice(0, -1);
    const currentResiduals = residuals.slice(1);
    
    return {
      type: 'residual_lag_plot',
      data: [{
        x: laggedResiduals,
        y: currentResiduals,
        type: 'scatter',
        mode: 'markers',
        name: 'Lag Plot'
      }],
      layout: {
        title: 'Residual Lag Plot',
        xaxis: { title: 'Residual(t-1)' },
        yaxis: { title: 'Residual(t)' }
      }
    };
  }

  private static createPredictionIntervals(
    actual: number[],
    predicted: number[],
    residuals: number[],
    timestamps: Date[]
  ): PlotData {
    const std = StatisticalUtils.standardDeviation(residuals);
    const upper95 = predicted.map(p => p + 1.96 * std);
    const lower95 = predicted.map(p => p - 1.96 * std);
    const upper80 = predicted.map(p => p + 1.28 * std);
    const lower80 = predicted.map(p => p - 1.28 * std);
    
    return {
      type: 'prediction_intervals',
      data: [
        {
          x: timestamps,
          y: actual,
          type: 'scatter',
          mode: 'markers',
          name: 'Actual'
        },
        {
          x: timestamps,
          y: predicted,
          type: 'scatter',
          mode: 'lines',
          name: 'Predicted',
          line: { color: 'red' }
        },
        {
          x: timestamps,
          y: upper95,
          type: 'scatter',
          mode: 'lines',
          name: '95% Interval',
          line: { color: 'gray', dash: 'dash' }
        },
        {
          x: timestamps,
          y: lower95,
          type: 'scatter',
          mode: 'lines',
          name: '95% Interval',
          line: { color: 'gray', dash: 'dash' }
        },
        {
          x: timestamps,
          y: upper80,
          type: 'scatter',
          mode: 'lines',
          name: '80% Interval',
          line: { color: 'lightgray', dash: 'dot' }
        },
        {
          x: timestamps,
          y: lower80,
          type: 'scatter',
          mode: 'lines',
          name: '80% Interval',
          line: { color: 'lightgray', dash: 'dot' }
        }
      ],
      layout: {
        title: 'Prediction Intervals',
        xaxis: { title: 'Time' },
        yaxis: { title: 'Value' }
      }
    };
  }

  private static generateNormalCurve(data: number[]): { x: number[]; y: number[] } {
    const mean = StatisticalUtils.mean(data);
    const std = StatisticalUtils.standardDeviation(data);
    const x = Array.from({ length: 100 }, (_, i) => 
      mean - 4 * std + (i * 8 * std / 99)
    );
    const y = x.map(xi => 
      Math.exp(-Math.pow(xi - mean, 2) / (2 * std * std)) / 
      (std * Math.sqrt(2 * Math.PI))
    );
    
    return { x, y };
  }
} 