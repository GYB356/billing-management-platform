import { StatisticalUtils } from '../StatisticalUtils';

interface PlotOptions {
  theme?: 'light' | 'dark';
  colors?: string[];
  width?: number;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  confidenceLevel?: number;  // e.g., 0.95 for 95%
  smoothing?: number;        // Moving average window for smoothing
  annotations?: Array<{
    x: number | Date;
    y: number;
    text: string;
  }>;
}

interface PlotData {
  x: (number | Date)[];
  y: number[];
  type: 'scatter' | 'line' | 'bar' | 'heatmap';
  name?: string;
  mode?: 'lines' | 'markers' | 'lines+markers';
  line?: {
    dash?: 'solid' | 'dot' | 'dash';
    width?: number;
  };
  opacity?: number;
}

interface PlotLayout {
  title: string;
  xaxis: {
    title: string;
    type?: 'linear' | 'log' | 'date';
    showgrid?: boolean;
  };
  yaxis: {
    title: string;
    type?: 'linear' | 'log';
    showgrid?: boolean;
  };
  showlegend?: boolean;
  width?: number;
  height?: number;
  paper_bgcolor?: string;
  plot_bgcolor?: string;
  annotations?: Array<{
    x: number | Date;
    y: number;
    text: string;
    showarrow: boolean;
  }>;
}

export class EnhancedPlots {
  static generateDiagnosticPlots(
    residuals: number[],
    timestamps: Date[],
    options: PlotOptions = {}
  ): {
    residualPlot: { data: PlotData[]; layout: PlotLayout };
    acfPlot: { data: PlotData[]; layout: PlotLayout };
    pacfPlot: { data: PlotData[]; layout: PlotLayout };
    qqPlot: { data: PlotData[]; layout: PlotLayout };
    histogramPlot: { data: PlotData[]; layout: PlotLayout };
    seasonalPlot: { data: PlotData[]; layout: PlotLayout };
  } {
    const defaultOptions: Required<PlotOptions> = {
      theme: 'light',
      colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728'],
      width: 800,
      height: 400,
      showLegend: true,
      showGrid: true,
      confidenceLevel: 0.95,
      smoothing: 1,
      annotations: []
    };

    const opts = { ...defaultOptions, ...options };
    const backgroundColor = opts.theme === 'light' ? '#ffffff' : '#1a1a1a';
    const textColor = opts.theme === 'light' ? '#000000' : '#ffffff';

    return {
      residualPlot: this.createEnhancedResidualPlot(residuals, timestamps, opts),
      acfPlot: this.createEnhancedACFPlot(residuals, opts),
      pacfPlot: this.createEnhancedPACFPlot(residuals, opts),
      qqPlot: this.createEnhancedQQPlot(residuals, opts),
      histogramPlot: this.createHistogramPlot(residuals, opts),
      seasonalPlot: this.createSeasonalPlot(residuals, timestamps, opts)
    };
  }

  private static createEnhancedResidualPlot(
    residuals: number[],
    timestamps: Date[],
    options: Required<PlotOptions>
  ): { data: PlotData[]; layout: PlotLayout } {
    // Apply smoothing if requested
    const smoothedResiduals = options.smoothing > 1 
      ? this.movingAverage(residuals, options.smoothing)
      : residuals;

    const data: PlotData[] = [
      {
        x: timestamps,
        y: residuals,
        type: 'scatter',
        mode: 'markers',
        name: 'Residuals',
        opacity: 0.6
      },
      {
        x: timestamps,
        y: smoothedResiduals,
        type: 'line',
        name: 'Smoothed Residuals',
        line: { dash: 'solid', width: 2 }
      },
      {
        x: timestamps,
        y: new Array(residuals.length).fill(0),
        type: 'line',
        name: 'Zero Line',
        line: { dash: 'dash', width: 1 }
      }
    ];

    // Add confidence bands
    const stdDev = StatisticalUtils.standardDeviation(residuals);
    const criticalValue = StatisticalUtils.normalInverseCDF(
      1 - (1 - options.confidenceLevel) / 2
    );
    const confBand = criticalValue * stdDev;

    data.push(
      {
        x: timestamps,
        y: new Array(residuals.length).fill(confBand),
        type: 'line',
        name: `${options.confidenceLevel * 100}% Confidence Band`,
        line: { dash: 'dot', width: 1 },
        opacity: 0.3
      },
      {
        x: timestamps,
        y: new Array(residuals.length).fill(-confBand),
        type: 'line',
        line: { dash: 'dot', width: 1 },
        opacity: 0.3
      }
    );

    const layout: PlotLayout = {
      title: 'Enhanced Residual Analysis',
      xaxis: {
        title: 'Time',
        type: 'date',
        showgrid: options.showGrid
      },
      yaxis: {
        title: 'Residual',
        showgrid: options.showGrid
      },
      showlegend: options.showLegend,
      width: options.width,
      height: options.height,
      paper_bgcolor: options.theme === 'light' ? '#ffffff' : '#1a1a1a',
      plot_bgcolor: options.theme === 'light' ? '#ffffff' : '#1a1a1a',
      annotations: options.annotations.map(a => ({
        ...a,
        showarrow: true
      }))
    };

    return { data, layout };
  }

  private static createHistogramPlot(
    residuals: number[],
    options: Required<PlotOptions>
  ): { data: PlotData[]; layout: PlotLayout } {
    const bins = Math.ceil(Math.sqrt(residuals.length));
    const { min, max } = this.getMinMax(residuals);
    const binWidth = (max - min) / bins;

    // Create histogram data
    const histogramCounts = new Array(bins).fill(0);
    residuals.forEach(r => {
      const binIndex = Math.min(
        Math.floor((r - min) / binWidth),
        bins - 1
      );
      histogramCounts[binIndex]++;
    });

    // Calculate normal distribution overlay
    const mean = StatisticalUtils.mean(residuals);
    const std = StatisticalUtils.standardDeviation(residuals);
    const normalX = Array.from(
      { length: 100 },
      (_, i) => min + (i / 99) * (max - min)
    );
    const normalY = normalX.map(x => 
      (residuals.length * binWidth) * 
      Math.exp(-Math.pow(x - mean, 2) / (2 * std * std)) / 
      (std * Math.sqrt(2 * Math.PI))
    );

    const data: PlotData[] = [
      {
        x: Array.from({ length: bins }, (_, i) => min + i * binWidth),
        y: histogramCounts,
        type: 'bar',
        name: 'Histogram',
        opacity: 0.7
      },
      {
        x: normalX,
        y: normalY,
        type: 'line',
        name: 'Normal Distribution',
        line: { dash: 'solid', width: 2 }
      }
    ];

    const layout: PlotLayout = {
      title: 'Residual Distribution',
      xaxis: {
        title: 'Residual Value',
        showgrid: options.showGrid
      },
      yaxis: {
        title: 'Frequency',
        showgrid: options.showGrid
      },
      showlegend: options.showLegend,
      width: options.width,
      height: options.height,
      paper_bgcolor: options.theme === 'light' ? '#ffffff' : '#1a1a1a',
      plot_bgcolor: options.theme === 'light' ? '#ffffff' : '#1a1a1a'
    };

    return { data, layout };
  }

  private static createSeasonalPlot(
    residuals: number[],
    timestamps: Date[],
    options: Required<PlotOptions>
  ): { data: PlotData[]; layout: PlotLayout } {
    // Detect potential seasonality using autocorrelation
    const maxLag = Math.min(Math.floor(residuals.length / 4), 365);
    const acf = StatisticalUtils.acf(residuals, maxLag);
    
    // Find peaks in ACF
    const peaks = this.findPeaks(acf);
    const seasonalPeriods = peaks.map(p => p.index).filter(i => i > 1);

    const data: PlotData[] = [];
    
    // Create seasonal subseries plots for each detected period
    seasonalPeriods.slice(0, 3).forEach((period, i) => {
      const seasonalData = this.createSeasonalSubseries(residuals, period);
      
      data.push({
        x: Array.from({ length: period }, (_, i) => i),
        y: seasonalData.means,
        type: 'line',
        name: `Period ${period}`,
        line: { dash: 'solid', width: 2 }
      });

      // Add confidence bands
      data.push({
        x: Array.from({ length: period }, (_, i) => i),
        y: seasonalData.upper,
        type: 'line',
        name: `${options.confidenceLevel * 100}% CI`,
        line: { dash: 'dot', width: 1 },
        opacity: 0.3
      });

      data.push({
        x: Array.from({ length: period }, (_, i) => i),
        y: seasonalData.lower,
        type: 'line',
        line: { dash: 'dot', width: 1 },
        opacity: 0.3
      });
    });

    const layout: PlotLayout = {
      title: 'Seasonal Pattern Analysis',
      xaxis: {
        title: 'Season Position',
        showgrid: options.showGrid
      },
      yaxis: {
        title: 'Average Residual',
        showgrid: options.showGrid
      },
      showlegend: options.showLegend,
      width: options.width,
      height: options.height,
      paper_bgcolor: options.theme === 'light' ? '#ffffff' : '#1a1a1a',
      plot_bgcolor: options.theme === 'light' ? '#ffffff' : '#1a1a1a'
    };

    return { data, layout };
  }

  private static movingAverage(data: number[], window: number): number[] {
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

  private static findPeaks(data: number[]): Array<{ index: number; value: number }> {
    const peaks: Array<{ index: number; value: number }> = [];
    
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        peaks.push({ index: i, value: data[i] });
      }
    }

    return peaks.sort((a, b) => b.value - a.value);
  }

  private static createSeasonalSubseries(data: number[], period: number): {
    means: number[];
    upper: number[];
    lower: number[];
  } {
    const seasonalGroups: number[][] = Array.from(
      { length: period },
      () => []
    );

    // Group data by season
    data.forEach((value, index) => {
      seasonalGroups[index % period].push(value);
    });

    // Calculate statistics for each season
    const means = seasonalGroups.map(group => StatisticalUtils.mean(group));
    const stds = seasonalGroups.map(group => StatisticalUtils.standardDeviation(group));
    
    const criticalValue = StatisticalUtils.normalInverseCDF(0.975);
    const upper = means.map((m, i) => m + criticalValue * stds[i]);
    const lower = means.map((m, i) => m - criticalValue * stds[i]);

    return { means, upper, lower };
  }

  private static getMinMax(data: number[]): { min: number; max: number } {
    return {
      min: Math.min(...data),
      max: Math.max(...data)
    };
  }

  // ... existing methods from TimeSeriesPlots ...
} 