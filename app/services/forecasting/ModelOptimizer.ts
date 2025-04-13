import { StatisticalUtils } from './StatisticalUtils';

interface OptimizationResult {
  parameters: number[];
  logLikelihood: number;
  covariance: number[][];
  iterations: number;
  converged: boolean;
}

export class ModelOptimizer {
  static estimateParameters(
    data: number[],
    numParams: number,
    logLikelihoodFn: (params: number[]) => number,
    options: {
      maxIterations?: number;
      tolerance?: number;
      initialParams?: number[];
    } = {}
  ): OptimizationResult {
    const {
      maxIterations = 1000,
      tolerance = 1e-6,
      initialParams = new Array(numParams).fill(0)
    } = options;

    let params = [...initialParams];
    let iteration = 0;
    let converged = false;
    let prevLogLik = -Infinity;
    let stepSize = 0.01;

    while (iteration < maxIterations) {
      // Calculate gradient and Hessian
      const gradient = this.calculateGradient(params, logLikelihoodFn);
      const hessian = this.calculateHessian(params, logLikelihoodFn);
      
      // Calculate step using Newton-Raphson with regularization
      const step = this.solveNewtonStep(gradient, hessian, stepSize);
      const newParams = params.map((p, i) => p + step[i]);
      
      // Calculate new log-likelihood
      const newLogLik = logLikelihoodFn(newParams);
      
      // Check if improvement
      if (newLogLik > prevLogLik) {
        params = newParams;
        stepSize = Math.min(stepSize * 1.2, 1.0);  // Increase step size
      } else {
        stepSize *= 0.5;  // Reduce step size
      }
      
      // Check convergence
      if (Math.abs(newLogLik - prevLogLik) < tolerance) {
        converged = true;
        break;
      }
      
      prevLogLik = newLogLik;
      iteration++;
    }

    // Calculate parameter covariance matrix
    const hessian = this.calculateHessian(params, logLikelihoodFn);
    const covariance = this.invertMatrix(hessian);

    return {
      parameters: params,
      logLikelihood: logLikelihoodFn(params),
      covariance,
      iterations: iteration,
      converged
    };
  }

  private static calculateGradient(
    params: number[],
    logLikelihoodFn: (params: number[]) => number
  ): number[] {
    const h = 1e-8;
    const baseLogLik = logLikelihoodFn(params);
    
    return params.map((_, i) => {
      const paramsPlus = [...params];
      paramsPlus[i] += h;
      const logLikPlus = logLikelihoodFn(paramsPlus);
      return (logLikPlus - baseLogLik) / h;
    });
  }

  private static calculateHessian(
    params: number[],
    logLikelihoodFn: (params: number[]) => number
  ): number[][] {
    const n = params.length;
    const h = 1e-6;
    const hessian: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    
    // Calculate diagonal elements
    for (let i = 0; i < n; i++) {
      const paramsPlus = [...params];
      const paramsMinus = [...params];
      paramsPlus[i] += h;
      paramsMinus[i] -= h;
      
      const logLikPlus = logLikelihoodFn(paramsPlus);
      const logLikMinus = logLikelihoodFn(paramsMinus);
      const logLikBase = logLikelihoodFn(params);
      
      hessian[i][i] = (logLikPlus - 2 * logLikBase + logLikMinus) / (h * h);
    }
    
    // Calculate off-diagonal elements
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const paramsPlus = [...params];
        paramsPlus[i] += h;
        paramsPlus[j] += h;
        
        const logLikPlusPlus = logLikelihoodFn(paramsPlus);
        const logLikBase = logLikelihoodFn(params);
        
        paramsPlus[j] -= 2 * h;
        const logLikPlusMinus = logLikelihoodFn(paramsPlus);
        
        paramsPlus[i] -= 2 * h;
        const logLikMinusMinus = logLikelihoodFn(paramsPlus);
        
        paramsPlus[j] += 2 * h;
        const logLikMinusPlus = logLikelihoodFn(paramsPlus);
        
        hessian[i][j] = hessian[j][i] = (
          logLikPlusPlus - logLikPlusMinus - logLikMinusPlus + logLikMinusMinus
        ) / (4 * h * h);
      }
    }
    
    return hessian;
  }

  private static solveNewtonStep(
    gradient: number[],
    hessian: number[][],
    stepSize: number
  ): number[] {
    const n = gradient.length;
    
    // Add regularization to Hessian diagonal
    const regularizedHessian = hessian.map((row, i) => 
      row.map((val, j) => i === j ? val + 1e-6 : val)
    );
    
    // Solve system using LU decomposition
    const solution = this.solveLU(regularizedHessian, gradient);
    
    // Apply step size
    return solution.map(s => -s * stepSize);
  }

  private static solveLU(A: number[][], b: number[]): number[] {
    const n = A.length;
    const L: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    const U: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    
    // LU decomposition
    for (let i = 0; i < n; i++) {
      L[i][i] = 1;
      
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < i; k++) {
          sum += L[i][k] * U[k][j];
        }
        
        if (i <= j) {
          U[i][j] = A[i][j] - sum;
        } else {
          L[i][j] = (A[i][j] - sum) / U[j][j];
        }
      }
    }
    
    // Forward substitution (Ly = b)
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < i; j++) {
        sum += L[i][j] * y[j];
      }
      y[i] = b[i] - sum;
    }
    
    // Backward substitution (Ux = y)
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += U[i][j] * x[j];
      }
      x[i] = (y[i] - sum) / U[i][i];
    }
    
    return x;
  }

  private static invertMatrix(matrix: number[][]): number[][] {
    const n = matrix.length;
    const result: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    
    // Create augmented matrix [A|I]
    const augmented: number[][] = matrix.map((row, i) => [
      ...row,
      ...Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
    ]);
    
    // Gaussian elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxEl = Math.abs(augmented[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > maxEl) {
          maxEl = Math.abs(augmented[k][i]);
          maxRow = k;
        }
      }
      
      // Swap maximum row with current row
      if (maxRow !== i) {
        [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      }
      
      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        const c = -augmented[k][i] / augmented[i][i];
        for (let j = i; j < 2 * n; j++) {
          if (i === j) {
            augmented[k][j] = 0;
          } else {
            augmented[k][j] += c * augmented[i][j];
          }
        }
      }
    }
    
    // Back substitution
    for (let i = n - 1; i >= 0; i--) {
      for (let k = i - 1; k >= 0; k--) {
        const c = -augmented[k][i] / augmented[i][i];
        for (let j = 0; j < 2 * n; j++) {
          augmented[k][j] += c * augmented[i][j];
        }
      }
    }
    
    // Normalize rows
    for (let i = 0; i < n; i++) {
      const c = 1 / augmented[i][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] *= c;
      }
    }
    
    // Extract right half of augmented matrix
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result[i][j] = augmented[i][j + n];
      }
    }
    
    return result;
  }
} 