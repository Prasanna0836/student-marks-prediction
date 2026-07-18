/**
 * Gaussian Elimination with partial pivoting to solve Ax = B.
 * A is an n x n matrix, B is an n-dimensional vector.
 * Returns the solution vector x.
 */
function solveLinearSystem(A, B) {
  const n = A.length;
  // Create augmented matrix [A|B]
  const M = new Array(n);
  for (let i = 0; i < n; i++) {
    M[i] = [...A[i], B[i]];
  }

  for (let i = 0; i < n; i++) {
    // Search for maximum in this column
    let maxEl = Math.abs(M[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > maxEl) {
        maxEl = Math.abs(M[k][i]);
        maxRow = k;
      }
    }

    // Swap maximum row with current row
    const temp = M[maxRow];
    M[maxRow] = M[i];
    M[i] = temp;

    if (Math.abs(M[i][i]) < 1e-12) {
      // Singular matrix or line of zeros
      return null;
    }

    // Make all rows below this one 0 in current column
    for (let k = i + 1; k < n; k++) {
      const c = -M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        if (i === j) {
          M[k][j] = 0;
        } else {
          M[k][j] += c * M[i][j];
        }
      }
    }
  }

  // Solve equation Mx = B for an upper triangular matrix
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n] / M[i][i];
    for (let k = i - 1; k >= 0; k--) {
      M[k][n] -= M[k][i] * x[i];
    }
  }
  return x;
}

/**
 * Computes Multiple Linear Regression on the dataset.
 * @param {Array<Object>} data - Array of student records.
 * @param {Array<string>} featureKeys - Array of keys representing features (e.g. ['G1', 'G2']).
 * @param {string} targetKey - The column to predict (usually 'G3').
 * @returns {Object|null} Object containing beta coefficients, intercept, predictions, and metrics.
 */
export function trainMultipleLinearRegression(data, featureKeys, targetKey = 'G3') {
  const n = data.length;
  if (n === 0) return null;

  const originalFeatures = featureKeys;
  const originalK = featureKeys.length;

  // Enforce equal weights for G1 and G2 if both are present
  const enforceEqual = featureKeys.includes('G1') && featureKeys.includes('G2');
  let effectiveFeatureKeys = [...featureKeys];
  let trainingData = data;

  if (enforceEqual) {
    effectiveFeatureKeys = featureKeys.filter(k => k !== 'G1' && k !== 'G2');
    effectiveFeatureKeys.push('G1_G2_avg');
    trainingData = data.map(item => ({
      ...item,
      G1_G2_avg: ((item.G1 || 0) + (item.G2 || 0)) / 2
    }));
  }

  const k = effectiveFeatureKeys.length;
  // X matrix will have k + 1 columns (1 for intercept, and k features)
  // Construct X and Y arrays
  const X = [];
  const Y = [];
  for (let i = 0; i < n; i++) {
    const row = [1]; // Intercept term
    for (let j = 0; j < k; j++) {
      const val = trainingData[i][effectiveFeatureKeys[j]];
      row.push(typeof val === 'number' ? val : 0);
    }
    X.push(row);
    
    const targetVal = trainingData[i][targetKey];
    Y.push(typeof targetVal === 'number' ? targetVal : 0);
  }

  const numCols = k + 1;

  // Compute X^T * X (size: numCols x numCols) and X^T * Y (size: numCols)
  const XtX = Array.from({ length: numCols }, () => new Array(numCols).fill(0));
  const XtY = new Array(numCols).fill(0);

  for (let i = 0; i < numCols; i++) {
    for (let j = 0; j < numCols; j++) {
      let sum = 0;
      for (let r = 0; r < n; r++) {
        sum += X[r][i] * X[r][j];
      }
      XtX[i][j] = sum;
    }
    
    let sumY = 0;
    for (let r = 0; r < n; r++) {
      sumY += X[r][i] * Y[r];
    }
    XtY[i] = sumY;
  }

  // Solve for beta coefficients
  const beta = solveLinearSystem(XtX, XtY);
  if (!beta) {
    // If XtX is singular, fall back to simple average or dummy coefficients
    console.warn("Matrix is singular, using average prediction model.");
    const avgY = Y.reduce((s, v) => s + v, 0) / n;
    return {
      intercept: avgY,
      coefficients: featureKeys.reduce((acc, feat) => {
        acc[feat] = 0;
        return acc;
      }, {}),
      metrics: { r2: 0, mse: 0, rmse: 0, mae: 0, n_samples: n }
    };
  }

  const intercept = beta[0];
  const coefficients = {};
  for (let j = 0; j < k; j++) {
    const feat = effectiveFeatureKeys[j];
    if (feat === 'G1_G2_avg') {
      const val = beta[j + 1];
      coefficients['G1'] = val / 2;
      coefficients['G2'] = val / 2;
    } else {
      coefficients[feat] = beta[j + 1];
    }
  }

  // Calculate predictions and error metrics
  let sumY = 0;
  for (let i = 0; i < n; i++) sumY += Y[i];
  const yMean = sumY / n;

  let ssTot = 0;
  let ssRes = 0;
  let absErrorSum = 0;
  const residuals = [];
  const predictedValues = [];

  for (let i = 0; i < n; i++) {
    let predVal = intercept;
    for (let j = 0; j < originalK; j++) {
      const featKey = originalFeatures[j];
      const featVal = data[i][featKey];
      predVal += coefficients[featKey] * (typeof featVal === 'number' ? featVal : 0);
    }
    
    // Clamp predicted grade between 0 and 100 (Final exam marks limit)
    const clampedPred = Math.max(0, Math.min(100, predVal));
    predictedValues.push(clampedPred);

    const actual = Y[i];
    const residual = actual - clampedPred;
    residuals.push(residual);

    ssTot += Math.pow(actual - yMean, 2);
    ssRes += Math.pow(actual - clampedPred, 2);
    absErrorSum += Math.abs(residual);
  }

  const mse = ssRes / n;
  const rmse = Math.sqrt(mse);
  const mae = absErrorSum / n;
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return {
    intercept,
    coefficients,
    metrics: {
      mse,
      rmse,
      mae,
      r2,
      n_samples: n
    },
    predictedValues,
    residuals
  };
}

/**
 * Predicts target value for a single instance.
 * @param {Object} input - Object containing feature values (e.g. { G1: 12, G2: 15 }).
 * @param {number} intercept - Intercept of regression.
 * @param {Object} coefficients - Coefficients mapping keys to multipliers.
 * @returns {number} Predicted grade in [0, 20] range.
 */
export function predictSingle(input, intercept, coefficients) {
  let pred = intercept;
  for (const [key, coeff] of Object.entries(coefficients)) {
    const val = input[key];
    pred += coeff * (typeof val === 'number' ? val : 0);
  }
  return Math.max(0, Math.min(100, pred));
}

/**
 * Calculates correlation coefficient (r) between two keys in data.
 */
export function calculateCorrelation(data, keyX, keyY) {
  const n = data.length;
  if (n === 0) return 0;

  let sumX = 0, sumY = 0, sumXY = 0;
  let sumXSq = 0, sumYSq = 0;

  for (let i = 0; i < n; i++) {
    const valX = data[i][keyX] || 0;
    const valY = data[i][keyY] || 0;

    sumX += valX;
    sumY += valY;
    sumXY += valX * valY;
    sumXSq += valX * valX;
    sumYSq += valY * valY;
  }

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumXSq - sumX * sumX) * (n * sumYSq - sumY * sumY));
  
  if (den === 0) return 0;
  return num / den;
}
