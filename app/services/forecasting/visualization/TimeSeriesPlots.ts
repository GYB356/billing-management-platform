import { StatisticalUtils } from '../StatisticalUtils';

interface PlotData {
  x: number[];
  y: number[];
  type: 'scatter' | 'line' | 'bar';
  name?: string;
}

interface PlotLayout {
  title: string;
  xaxis: { title: string };
  yaxis: { title: string };
}

export class TimeSeriesPlots {
  static generateResidualPlots(residuals: number[], timestamps: Date[]): {
    residualPlot: { data: PlotData[]; layout: PlotLayout };
    acfPlot: { data: PlotData[]; layout: PlotLayout };
    pacfPlot: { data: PlotData[]; layout: PlotLayout };
    qqPlot: { data: PlotData[]; layout: PlotLayout };
  } {
    return {
      residualPlot: this.createResidualPlot(residuals, timestamps),
      acfPlot: this.createACFPlot(residuals),
      pacfPlot: this.createPACFPlot(residuals),
      qqPlot: this.createQQPlot(residuals)
    };
  }

  private static createResidualPlot(residuals: number[], timestamps: Date[]): { data: PlotData[]; layout: PlotLayout } {
    const data: PlotData[] = [
      {
        x: timestamps.map(t => t.getTime()),
        y: residuals,
        type: 'scatter',
        name: 'Residuals'
      },
      {
        x: timestamps.map(t => t.getTime()),
        y: new Array(residuals.length).fill(0),
        type: 'line',
        name: 'Zero Line'
      }
    ];

    const layout: PlotLayout = {
      title: 'Residual Plot',
      xaxis: { title: 'Time' },
      yaxis: { title: 'Residual' }
    };

    return { data, layout };
  }

  private static createACFPlot(residuals: number[]): { data: PlotData[]; layout: PlotLayout } {
    const maxLag = Math.min(40, Math.floor(residuals.length / 4));
    const acf = StatisticalUtils.acf(residuals, maxLag);
    const confidenceBound = 1.96 / Math.sqrt(residuals.length);

    const data: PlotData[] = [
      {
        x: Array.from({ length: maxLag + 1 }, (_, i) => i),
        y: acf,
        type: 'bar',
        name: 'ACF'
      },
      {
        x: [0, maxLag],
        y: [confidenceBound, confidenceBound],
        type: 'line',
        name: '95% Confidence Bound'
      },
      {
        x: [0, maxLag],
        y: [-confidenceBound, -confidenceBound],
        type: 'line',
        name: '95% Confidence Bound'
      }
    ];

    const layout: PlotLayout = {
      title: 'Autocorrelation Function (ACF)',
      xaxis: { title: 'Lag' },
      yaxis: { title: 'ACF' }
    };

    return { data, layout };
  }

  private static createPACFPlot(residuals: number[]): { data: PlotData[]; layout: PlotLayout } {
    const maxLag = Math.min(40, Math.floor(residuals.length / 4));
    const pacf = StatisticalUtils.pacf(residuals, maxLag);
    const confidenceBound = 1.96 / Math.sqrt(residuals.length);

    const data: PlotData[] = [
      {
        x: Array.from({ length: maxLag + 1 }, (_, i) => i),
        y: pacf,
        type: 'bar',
        name: 'PACF'
      },
      {
        x: [0, maxLag],
        y: [confidenceBound, confidenceBound],
        type: 'line',
        name: '95% Confidence Bound'
      },
      {
        x: [0, maxLag],
        y: [-confidenceBound, -confidenceBound],
        type: 'line',
        name: '95% Confidence Bound'
      }
    ];

    const layout: PlotLayout = {
      title: 'Partial Autocorrelation Function (PACF)',
      xaxis: { title: 'Lag' },
      yaxis: { title: 'PACF' }
    };

    return { data, layout };
  }

  private static createQQPlot(residuals: number[]): { data: PlotData[]; layout: PlotLayout } {
    // Sort residuals and calculate theoretical quantiles
    const sortedResiduals = [...residuals].sort((a, b) => a - b);
    const n = residuals.length;
    
    const theoreticalQuantiles = Array.from({ length: n }, (_, i) => {
      const p = (i + 0.5) / n;
      return StatisticalUtils.normalInverseCDF(p);
    });

    // Calculate line of best fit
    const mean = StatisticalUtils.mean(sortedResiduals);
    const std = StatisticalUtils.standardDeviation(sortedResiduals);
    const lineStart = mean + std * Math.min(...theoreticalQuantiles);
    const lineEnd = mean + std * Math.max(...theoreticalQuantiles);

    const data: PlotData[] = [
      {
        x: theoreticalQuantiles,
        y: sortedResiduals,
        type: 'scatter',
        name: 'Q-Q Plot'
      },
      {
        x: [Math.min(...theoreticalQuantiles), Math.max(...theoreticalQuantiles)],
        y: [lineStart, lineEnd],
        type: 'line',
        name: 'Reference Line'
      }
    ];

    const layout: PlotLayout = {
      title: 'Normal Q-Q Plot',
      xaxis: { title: 'Theoretical Quantiles' },
      yaxis: { title: 'Sample Quantiles' }
    };

    return { data, layout };
  }

  static generateForecastPlot(
    actual: Array<{ timestamp: Date; value: number }>,
    forecast: Array<{ timestamp: Date; value: number }>,
    confidence?: Array<{ timestamp: Date; lower: number; upper: number }>
  ): { data: PlotData[]; layout: PlotLayout } {
    const data: PlotData[] = [
      {
        x: actual.map(d => d.timestamp.getTime()),
        y: actual.map(d => d.value),
        type: 'line',
        name: 'Actual'
      },
      {
        x: forecast.map(d => d.timestamp.getTime()),
        y: forecast.map(d => d.value),
        type: 'line',
        name: 'Forecast'
      }
    ];

    if (confidence) {
      data.push(
        {
          x: confidence.map(d => d.timestamp.getTime()),
          y: confidence.map(d => d.upper),
          type: 'line',
          name: '95% Confidence Upper'
        },
        {
          x: confidence.map(d => d.timestamp.getTime()),
          y: confidence.map(d => d.lower),
          type: 'line',
          name: '95% Confidence Lower'
        }
      );
    }

    const layout: PlotLayout = {
      title: 'Time Series Forecast',
      xaxis: { title: 'Time' },
      yaxis: { title: 'Value' }
    };

    return { data, layout };
  }

  static generateSeasonalDecomposition(
    data: Array<{ timestamp: Date; value: number }>,
    period: number
  ): {
    trend: { data: PlotData[]; layout: PlotLayout };
    seasonal: { data: PlotData[]; layout: PlotLayout };
    residual: { data: PlotData[]; layout: PlotLayout };
  } {
    const values = data.map(d => d.value);
    const timestamps = data.map(d => d.timestamp);

    // Calculate trend using moving average
    const trendWindow = period;
    const trend = this.calculateMovingAverage(values, trendWindow);

    // Calculate seasonal component
    const detrended = values.map((v, i) => v - (trend[i] || 0));
    const seasonal = this.calculateSeasonalComponent(detrended, period);

    // Calculate residuals
    const residuals = values.map((v, i) => v - (trend[i] || 0) - seasonal[i % period]);

    return {
      trend: {
        data: [{
          x: timestamps.map(t => t.getTime()),
          y: trend,
          type: 'line',
          name: 'Trend'
        }],
        layout: {
          title: 'Trend Component',
          xaxis: { title: 'Time' },
          yaxis: { title: 'Value' }
        }
      },
      seasonal: {
        data: [{
          x: timestamps.map(t => t.getTime()),
          y: seasonal,
          type: 'line',
          name: 'Seasonal'
        }],
        layout: {
          title: 'Seasonal Component',
          xaxis: { title: 'Time' },
          yaxis: { title: 'Value' }
        }
      },
      residual: {
        data: [{
          x: timestamps.map(t => t.getTime()),
          y: residuals,
          type: 'line',
          name: 'Residual'
        }],
        layout: {
          title: 'Residual Component',
          xaxis: { title: 'Time' },
          yaxis: { title: 'Value' }
        }
      }
    };
  }

  private static calculateMovingAverage(data: number[], window: number): number[] {
    const result = new Array(data.length).fill(NaN);
    const halfWindow = Math.floor(window / 2);

    for (let i = halfWindow; i < data.length - halfWindow; i++) {
      let sum = 0;
      for (let j = -halfWindow; j <= halfWindow; j++) {
        sum += data[i + j];
      }
      result[i] = sum / window;
    }

    return result;
  }

  private static calculateSeasonalComponent(data: number[], period: number): number[] {
    const seasonal = new Array(period).fill(0);
    const counts = new Array(period).fill(0);

    // Calculate average for each position in the cycle
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(data[i])) {
        seasonal[i % period] += data[i];
        counts[i % period]++;
      }
    }

    // Normalize to get seasonal factors
    for (let i = 0; i < period; i++) {
      seasonal[i] = seasonal[i] / counts[i];
    }

    // Center the seasonal component
    const seasonalMean = StatisticalUtils.mean(seasonal);
    return seasonal.map(s => s - seasonalMean);
  }
}