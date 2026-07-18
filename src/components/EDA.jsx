import React, { useState, useMemo } from 'react';
import { BarChart, Grid, TrendingUp, Users } from 'lucide-react';
import { calculateCorrelation } from '../utils/regression';

const getDisplayKey = (key) => {
  if (key === 'G1') return 'CIE 1';
  if (key === 'G2') return 'CIE 2';
  if (key === 'G3') return 'SEE';
  return key;
};

export default function EDA({ students, model }) {
  const [histogramVar, setHistogramVar] = useState('G3');
  const [scatterXVar, setScatterXVar] = useState('G2');
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  // Variables in our dataset
  const variableMeta = {
    G1: { label: 'CIE 1', min: 0, max: 40 },
    G2: { label: 'CIE 2', min: 0, max: 40 },
    G3: { label: 'Semester End Examination (SEE)', min: 0, max: 100 }
  };

  // 1. Key Statistics
  const stats = useMemo(() => {
    if (!students || students.length === 0) return {};
    const n = students.length;
    
    const mean = (key) => students.reduce((s, r) => s + (r[key] || 0), 0) / n;
    
    return {
      n,
      avgG1: mean('G1'),
      avgG2: mean('G2'),
      avgG3: mean('G3'),
      corrG1G3: calculateCorrelation(students, 'G1', 'G3'),
      corrG2G3: calculateCorrelation(students, 'G2', 'G3')
    };
  }, [students]);

  // 2. Histogram calculations
  const histogramData = useMemo(() => {
    if (!students || students.length === 0) return [];
    
    const meta = variableMeta[histogramVar];
    // For G1 and G2 (max 40), we group by 2 to make 21 bins
    if (histogramVar === 'G1' || histogramVar === 'G2') {
      const numBins = 21; // 0-1, 2-3, ..., 38-39, 40
      const counts = new Array(numBins).fill(0);
      students.forEach(s => {
        const val = s[histogramVar] || 0;
        const binIdx = Math.min(Math.floor(val / 2), numBins - 1);
        counts[binIdx]++;
      });
      return counts.map((count, idx) => {
        const start = idx * 2;
        const end = Math.min(40, start + 1);
        return {
          label: idx === numBins - 1 ? '40' : `${start}-${end}`,
          value: count
        };
      });
    }

    // For G3 (max 100), we group by 5 to make 21 bins
    if (histogramVar === 'G3') {
      const numBins = 21; // 0-4, 5-9, ..., 95-99, 100
      const counts = new Array(numBins).fill(0);
      students.forEach(s => {
        const val = s.G3 || 0;
        const binIdx = Math.min(Math.floor(val / 5), numBins - 1);
        counts[binIdx]++;
      });
      return counts.map((count, idx) => {
        const start = idx * 5;
        const end = Math.min(100, start + 4);
        return {
          label: idx === numBins - 1 ? '100' : `${start}-${end}`,
          value: count
        };
      });
    }

    return [];
  }, [students, histogramVar]);

  // 3. Scatter Plot calculations (X vs G3)
  const scatterData = useMemo(() => {
    if (!students || students.length === 0) return { points: [], regressionLine: null };

    // Get simple linear regression for selected X vs G3
    // Y = G3
    const n = students.length;
    let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
    
    const points = students.map((s, idx) => {
      const x = s[scatterXVar];
      const y = s.G3;
      sumX += x;
      sumY += y;
      sumXX += x * x;
      sumXY += x * y;
      return { x, y, id: idx };
    });

    // Solve Y = b0 + b1 * X
    const denom = n * sumXX - sumX * sumX;
    let b1 = 0;
    let b0 = 0;
    if (denom !== 0) {
      b1 = (n * sumXY - sumX * sumY) / denom;
      b0 = (sumY - b1 * sumX) / n;
    } else {
      b0 = sumY / n;
    }

    // Determine limits of X-axis
    const xMin = variableMeta[scatterXVar].min;
    const xMax = variableMeta[scatterXVar].max;

    return {
      points,
      xMin,
      xMax,
      regression: { b0, b1 }
    };
  }, [students, scatterXVar]);

  // Heatmap Data (Correlation Matrix)
  const heatmapVariables = ['G1', 'G2', 'G3'];
  const heatmapData = useMemo(() => {
    const matrix = [];
    for (let i = 0; i < heatmapVariables.length; i++) {
      for (let j = 0; j < heatmapVariables.length; j++) {
        const var1 = heatmapVariables[i];
        const var2 = heatmapVariables[j];
        const r = calculateCorrelation(students, var1, var2);
        matrix.push({
          var1,
          var2,
          r,
          label1: variableMeta[var1].label,
          label2: variableMeta[var2].label
        });
      }
    }
    return matrix;
  }, [students]);

  // Actual vs Predicted points calculation for model validation
  const scatterPoints = useMemo(() => {
    if (!model || !model.predictedValues) return [];
    return model.predictedValues.map((pred, idx) => ({
      pred,
      actual: model.residuals ? pred + model.residuals[idx] : pred,
      id: idx
    }));
  }, [model]);

  // Color helper for Correlation Heatmap
  const getCorrelationColor = (r) => {
    // We want deep indigo for positive, neutral gray/white for 0, deep red/rose for negative
    if (r >= 0) {
      // Map [0, 1] to light-indigo to dark-indigo
      const opacity = r.toFixed(2);
      return `rgba(79, 70, 229, ${opacity})`;
    } else {
      // Map [-1, 0] to dark-red to light-red
      const opacity = Math.abs(r).toFixed(2);
      return `rgba(239, 68, 68, ${opacity})`;
    }
  };

  const getCorrelationTextColor = (r) => {
    // If background is dark (high absolute correlation), use white text
    return Math.abs(r) > 0.4 ? '#ffffff' : '#1e293b';
  };

  const getCorrelationExplanation = (cell) => {
    if (!cell) return 'Click on any cell in the heatmap matrix below to view a detailed statistical explanation of the relationship.';
    
    const { var1, var2, r } = cell;
    if (var1 === var2) {
      return `<strong>Self-Correlation (${getDisplayKey(var1)} vs ${getDisplayKey(var2)}):</strong> A variable always correlates perfectly with itself, resulting in a coefficient of <strong>r = 1.00</strong>.`;
    }

    const absR = Math.abs(r);
    let strength = 'very weak';
    if (absR >= 0.7) strength = 'strong';
    else if (absR >= 0.4) strength = 'moderate';
    else if (absR >= 0.2) strength = 'weak';

    const direction = r >= 0 ? 'positive' : 'negative';
    const varLabel1 = variableMeta[var1].label;
    const varLabel2 = variableMeta[var2].label;

    let explanation = `The correlation between <strong>${varLabel1} (${getDisplayKey(var1)})</strong> and <strong>${varLabel2} (${getDisplayKey(var2)})</strong> is <strong>r = ${r.toFixed(3)}</strong>, indicating a <strong>${strength} ${direction}</strong> relationship. `;

    const pairKey = [var1, var2].sort().join('-');
    if (pairKey === 'G1-G2') {
      explanation += `Students who scored well in CIE 1 very frequently maintained their grades in CIE 2. This strong consistency suggests early term academic habits are highly predictive of middle term results.`;
    } else if (pairKey === 'G2-G3') {
      explanation += `Performance in CIE 2 is extremely aligned with the Semester End Examination (SEE) mark. This shows that by mid-semester, student trajectories are highly set.`;
    } else if (pairKey === 'G1-G3') {
      explanation += `A high correlation showing that baseline entry grades (CIE 1) heavily dictate Semester End Examination (SEE) outcomes, though CIE 2 is slightly more predictive because it is closer in time to the final.`;
    } else {
      if (r >= 0.4) {
        explanation += `This means as ${varLabel1} increases, ${varLabel2} is highly likely to increase as well.`;
      } else if (r <= -0.4) {
        explanation += `This means as ${varLabel1} increases, ${varLabel2} is highly likely to decrease (an inverse relationship).`;
      } else {
        explanation += `This indicates a very loose relationship; changing one of these variables does not show a consistent or strong impact on the other.`;
      }
    }

    return explanation;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exploratory Data Analysis</h1>
          <p className="page-subtitle">Understand the patterns, distributions, and correlations in the dataset.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stat-card-container">
        <div className="stat-card">
          <div className="stat-icon-wrapper primary">
            <Users size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Total Sample Size</span>
            <span className="stat-value">{stats.n} Students</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>Math Cohort (UCI Dataset)</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper info">
            <TrendingUp size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Average SEE Score</span>
            <span className="stat-value">{stats.avgG3?.toFixed(1)} / 100</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--color-success)', fontWeight: '600', marginTop: '0.2rem', display: 'block' }}>Avg: Passing (C)</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper success">
            <BarChart size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">CIE 2 vs SEE Corr</span>
            <span className="stat-value">+{stats.corrG2G3?.toFixed(3)}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: '600', marginTop: '0.2rem', display: 'block' }}>r = +0.90 (Very Strong)</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon-wrapper warning">
            <Grid size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">CIE 1 vs SEE Corr</span>
            <span className="stat-value">+{stats.corrG1G3?.toFixed(3)}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--color-info)', fontWeight: '600', marginTop: '0.2rem', display: 'block' }}>r = +0.80 (Strong)</span>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        
        {/* Histograms Panel */}
        <div className="card" style={{ gridColumn: 'span 6' }}>
          <div className="card-title">
            <BarChart size={20} />
            Data Distributions
          </div>
          
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
            {['G1', 'G2', 'G3'].map(v => (
              <button
                key={v}
                onClick={() => setHistogramVar(v)}
                className={`btn btn-secondary ${histogramVar === v ? 'active' : ''}`}
                style={{
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.75rem',
                  backgroundColor: histogramVar === v ? 'var(--color-primary-light)' : 'white',
                  color: histogramVar === v ? 'var(--color-primary)' : 'var(--text-secondary)',
                  borderColor: histogramVar === v ? 'rgba(79, 70, 229, 0.2)' : 'var(--border-color)',
                }}
              >
                {getDisplayKey(v)}
              </button>
            ))}
          </div>

          <div style={{ height: '260px', width: '100%', position: 'relative' }}>
            {/* Draw Histogram as SVG */}
            {histogramData.length > 0 && (
              <svg viewBox="0 0 400 240" className="chart-svg">
                <defs>
                  <linearGradient id="histogramGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="var(--color-primary)" />
                  </linearGradient>
                </defs>
                {/* Axes and Grid lines */}
                {(() => {
                  const maxCount = Math.max(...histogramData.map(d => d.value), 1);
                  const padLeft = 30;
                  const padBottom = 30;
                  const padTop = 10;
                  const chartW = 360;
                  const chartH = 200;
                  const barW = (chartW / histogramData.length) * 0.8;
                  const gap = (chartW / histogramData.length) * 0.2;

                  return (
                    <g>
                      {/* Grid lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                        const y = padTop + chartH * (1 - p);
                        const labelVal = Math.round(maxCount * p);
                        return (
                          <g key={idx}>
                            <line x1={padLeft} y1={y} x2={padLeft + chartW} y2={y} className="chart-grid-line" />
                            <text x={padLeft - 5} y={y + 3} className="chart-text" textAnchor="end">{labelVal}</text>
                          </g>
                        );
                      })}
                      
                      {/* Bars */}
                      {histogramData.map((d, idx) => {
                        const x = padLeft + idx * (barW + gap) + gap / 2;
                        const barH = (d.value / maxCount) * chartH;
                        const y = padTop + chartH - barH;

                        return (
                          <g key={idx}>
                            <rect
                              x={x}
                              y={y}
                              width={barW}
                              height={barH}
                              className="histogram-bar"
                              style={{ fill: 'url(#histogramGrad)' }}
                              title={`${d.label}: ${d.value}`}
                            />
                            {/* Bar value text on top if there's height */}
                            {barH > 15 && (
                              <text
                                x={x + barW / 2}
                                y={y - 4}
                                className="histogram-bar-val"
                              >
                                {d.value}
                              </text>
                            )}
                            {/* X Labels */}
                            <text
                              x={x + barW / 2}
                              y={padTop + chartH + 15}
                              className="chart-text"
                              textAnchor="middle"
                              style={{ fontSize: histogramData.length > 10 ? '7px' : '9px' }}
                            >
                              {d.label}
                            </text>
                          </g>
                        );
                      })}
                      
                      {/* X Axis Label */}
                      <text
                        x={padLeft + chartW / 2}
                        y={padTop + chartH + 28}
                        className="chart-text"
                        textAnchor="middle"
                        style={{ fontWeight: '600' }}
                      >
                        {variableMeta[histogramVar].label} Value
                      </text>
                    </g>
                  );
                })()}
              </svg>
            )}
          </div>
        </div>

        {/* Scatter Plot Panel */}
        <div className="card" style={{ gridColumn: 'span 6' }}>
          <div className="card-title">
            <TrendingUp size={20} />
            Bivariate Relationship (vs Final Mark G3)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Select Predictor Variable (X):</span>
            {['G1', 'G2'].map(v => (
              <button
                key={v}
                onClick={() => setScatterXVar(v)}
                className={`btn btn-secondary ${scatterXVar === v ? 'active' : ''}`}
                style={{
                  padding: '0.3rem 0.5rem',
                  fontSize: '0.7rem',
                  backgroundColor: scatterXVar === v ? 'var(--color-primary-light)' : 'white',
                  color: scatterXVar === v ? 'var(--color-primary)' : 'var(--text-secondary)',
                  borderColor: scatterXVar === v ? 'rgba(79, 70, 229, 0.2)' : 'var(--border-color)',
                }}
              >
                {v}
              </button>
            ))}
          </div>

          <div style={{ height: '260px', width: '100%', position: 'relative' }}>
            {/* Draw Scatter plot as SVG */}
            {(() => {
              const padLeft = 30;
              const padBottom = 30;
              const padTop = 10;
              const chartW = 360;
              const chartH = 200;

              const xMin = scatterData.xMin;
              const xMax = scatterData.xMax;
              const yMin = 0;
              const yMax = 100;

              const getXPixel = (x) => padLeft + ((x - xMin) / (xMax - xMin)) * chartW;
              const getYPixel = (y) => padTop + chartH - ((y - yMin) / (yMax - yMin)) * chartH;

              // Regression Line end points
              const regX1 = xMin;
              const regY1 = Math.max(0, Math.min(100, scatterData.regression.b0 + scatterData.regression.b1 * xMin));
              const regX2 = xMax;
              const regY2 = Math.max(0, Math.min(100, scatterData.regression.b0 + scatterData.regression.b1 * xMax));

              return (
                <svg viewBox="0 0 400 240" className="chart-svg">
                  <defs>
                    <linearGradient id="scatterLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                    <radialGradient id="dotGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#4f46e5" />
                    </radialGradient>
                  </defs>
                  {/* Grid lines (Y-axis grid) */}
                  {[0, 25, 50, 75, 100].map((yVal, idx) => {
                    const yPixel = getYPixel(yVal);
                    return (
                      <g key={idx}>
                        <line x1={padLeft} y1={yPixel} x2={padLeft + chartW} y2={yPixel} className="chart-grid-line" />
                        <text x={padLeft - 5} y={yPixel + 3} className="chart-text" textAnchor="end">{yVal}</text>
                      </g>
                    );
                  })}

                  {/* X Axis division lines */}
                  {(() => {
                    const steps = Array.from({ length: xMax - xMin + 1 }, (_, i) => xMin + i);
                    // Filter steps to keep readable ticks
                    const readableSteps = steps.filter((s, i) => {
                      if (xMax - xMin > 10) return s % 5 === 0;
                      return true;
                    });
                    return readableSteps.map((xVal, idx) => {
                      const xPixel = getXPixel(xVal);
                      return (
                        <g key={idx}>
                          <line x1={xPixel} y1={padTop} x2={xPixel} y2={padTop + chartH} className="chart-grid-line" />
                          <text x={xPixel} y={padTop + chartH + 15} className="chart-text" textAnchor="middle">{xVal}</text>
                        </g>
                      );
                    });
                  })()}

                  {/* Scatter Dots */}
                  {scatterData.points.map((p) => {
                    const cx = getXPixel(p.x);
                    const cy = getYPixel(p.y);
                    return (
                      <circle
                        key={p.id}
                        cx={cx}
                        cy={cy}
                        r="3.5"
                        className="scatter-dot"
                        style={{ fill: 'url(#dotGrad)' }}
                        onMouseEnter={() => setHoveredPoint(p)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}

                  {/* Regression Line */}
                  <line
                    x1={getXPixel(regX1)}
                    y1={getYPixel(regY1)}
                    x2={getXPixel(regX2)}
                    y2={getYPixel(regY2)}
                    className="regression-line"
                    style={{ stroke: 'url(#scatterLineGrad)' }}
                  />

                  {/* Scatter Plot Labels */}
                  <text
                    x={padLeft + chartW / 2}
                    y={padTop + chartH + 28}
                    className="chart-text"
                    textAnchor="middle"
                    style={{ fontWeight: '600' }}
                  >
                    {variableMeta[scatterXVar].label} ({getDisplayKey(scatterXVar)}) (X)
                  </text>
                  <text
                    x="10"
                    y="100"
                    className="chart-text"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: '600' }}
                    textAnchor="middle"
                  >
                    Semester End Examination (SEE) (Y)
                  </text>

                  {/* Hover tooltip inside SVG */}
                  {hoveredPoint && (
                    <g>
                      {/* Highlight Ring */}
                      <circle
                        cx={getXPixel(hoveredPoint.x)}
                        cy={getYPixel(hoveredPoint.y)}
                        r="8"
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth="2"
                        style={{ opacity: 0.8 }}
                      />
                      
                      {/* Tooltip Card */}
                      <rect
                        x={Math.max(10, Math.min(270, getXPixel(hoveredPoint.x) - 60))}
                        y={Math.max(10, getYPixel(hoveredPoint.y) - 45)}
                        width="120"
                        height="35"
                        rx="6"
                        fill="rgba(15, 23, 42, 0.95)"
                        stroke="var(--color-primary-light)"
                        strokeWidth="1.5"
                        style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' }}
                      />
                      <text
                        x={Math.max(10, Math.min(270, getXPixel(hoveredPoint.x) - 60)) + 60}
                        y={Math.max(10, getYPixel(hoveredPoint.y) - 45) + 14}
                        fill="white"
                        fontSize="8.5"
                        fontWeight="600"
                        textAnchor="middle"
                      >
                        {getDisplayKey(scatterXVar)}: {hoveredPoint.x} / 40
                      </text>
                      <text
                        x={Math.max(10, Math.min(270, getXPixel(hoveredPoint.x) - 60)) + 60}
                        y={Math.max(10, getYPixel(hoveredPoint.y) - 45) + 26}
                        fill="white"
                        fontSize="8.5"
                        fontWeight="500"
                        textAnchor="middle"
                      >
                        SEE: {hoveredPoint.y} / 100
                      </text>
                    </g>
                  )}
                </svg>
              );
            })()}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            *The red line represents the simple linear regression of SEE on the selected feature.
          </div>
        </div>

        {/* Correlation Heatmap Panel */}
        <div className="card" style={{ gridColumn: 'span 6' }}>
          <div className="card-title">
            <Grid size={20} />
            Correlation Heatmap Matrix
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            This matrix shows the Pearson correlation coefficient (\(r\)) between different variables. 
            <strong> Indigo</strong> indicates positive correlation (as one increases, the other increases), 
            and <strong>Rose/Red</strong> indicates negative correlation (as one increases, the other decreases).
          </p>

          <div style={{ maxWidth: '650px', margin: '0 auto' }}>
            <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${heatmapVariables.length + 1}, 1fr)` }}>
              {/* Row Labels (horizontal header) */}
              <div className="heatmap-label-row" style={{ gridColumn: `span ${heatmapVariables.length + 1}`, gridTemplateColumns: `repeat(${heatmapVariables.length + 1}, 1fr)` }}>
                <div>Var</div>
                {heatmapVariables.map(v => <div key={v} title={variableMeta[v].label}>{getDisplayKey(v)}</div>)}
              </div>

              {/* Render Cells row by row */}
              {heatmapVariables.map((rowVar, i) => {
                return (
                  <React.Fragment key={rowVar}>
                    {/* Row Label (left header) */}
                    <div style={{
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'flex-start',
                      fontSize: '0.75rem', 
                      fontWeight: '600', 
                      color: 'var(--text-secondary)',
                      paddingLeft: '0.5rem'
                    }} title={variableMeta[rowVar].label}>
                      {getDisplayKey(rowVar)}
                    </div>
                    {/* Columns for this row */}
                    {heatmapVariables.map((colVar, j) => {
                      const cell = heatmapData.find(d => d.var1 === rowVar && d.var2 === colVar);
                      const r = cell ? cell.r : 0;
                      const bgColor = getCorrelationColor(r);
                      const txtColor = getCorrelationTextColor(r);

                      return (
                        <div
                          key={colVar}
                          className="heatmap-cell-wrapper"
                          style={{ 
                            backgroundColor: bgColor, 
                            color: txtColor,
                            borderRadius: '8px',
                            margin: '3px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            height: '50px'
                          }}
                          onClick={() => setSelectedCell(cell)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.06)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {r.toFixed(2)}
                          <div className="heatmap-cell-tooltip">
                            {getDisplayKey(rowVar)} vs {getDisplayKey(colVar)}: <strong>{r.toFixed(3)}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Heatmap Legend Scale */}
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Correlation Scale</span>
              <div style={{ 
                width: '300px', 
                height: '12px', 
                borderRadius: '6px', 
                background: 'linear-gradient(90deg, rgba(239, 68, 68, 1) 0%, rgba(248, 250, 252, 1) 50%, rgba(79, 70, 229, 1) 100%)',
                border: '1px solid var(--border-color)'
              }} />
              <div style={{ width: '300px', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                <span>-1.0 (Negative)</span>
                <span>0.0 (None)</span>
                <span>+1.0 (Positive)</span>
              </div>
            </div>

            {/* Correlation Interpretation Box */}
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              fontSize: '0.825rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
              textAlign: 'center'
            }}>
              <p dangerouslySetInnerHTML={{ __html: getCorrelationExplanation(selectedCell) }} />
            </div>
          </div>
        </div>

        {/* Actual vs. Predicted Plot Card */}
        <div className="card" style={{ gridColumn: 'span 6' }}>
          <div className="card-title">
            <TrendingUp size={20} />
            Actual vs. Predicted Plot
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            A visual validation of model fit. The diagonal line represents a perfect model where actual equals predicted. 
            Points close to the line indicate accurate predictions.
          </p>

          <div style={{ height: '260px', width: '100%', position: 'relative' }}>
            {(() => {
              if (!model || scatterPoints.length === 0) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No model data available.
                  </div>
                );
              }

              const padLeft = 30;
              const padBottom = 30;
              const padTop = 10;
              const chartW = 360;
              const chartH = 200;

              const getPixel = (val) => {
                // Both axes are from 0 to 100
                return {
                  x: padLeft + (val.pred / 100) * chartW,
                  y: padTop + chartH - (val.actual / 100) * chartH
                };
              };

              return (
                <svg viewBox="0 0 400 260" className="chart-svg">
                  {/* Grid lines */}
                  {[0, 25, 50, 75, 100].map((val, idx) => {
                    const y = padTop + chartH - (val / 100) * chartH;
                    const x = padLeft + (val / 100) * chartW;
                    return (
                      <g key={idx}>
                        {/* Horizontal Grid */}
                        <line x1={padLeft} y1={y} x2={padLeft + chartW} y2={y} className="chart-grid-line" />
                        <text x={padLeft - 5} y={y + 3} className="chart-text" textAnchor="end">{val}</text>
                        
                        {/* Vertical Grid */}
                        <line x1={x} y1={padTop} x2={x} y2={padTop + chartH} className="chart-grid-line" />
                        <text x={x} y={padTop + chartH + 15} className="chart-text" textAnchor="middle">{val}</text>
                      </g>
                    );
                  })}

                  {/* Scatter dots */}
                  {scatterPoints.map((pt) => {
                    const pixels = getPixel(pt);
                    return (
                      <circle
                        key={pt.id}
                        cx={pixels.x}
                        cy={pixels.y}
                        r="3"
                        className="scatter-dot"
                        style={{ fill: 'var(--color-primary)', fillOpacity: 0.35, stroke: 'none' }}
                      />
                    );
                  })}

                  {/* Perfect Fit Y=X line */}
                  <line
                    x1={padLeft}
                    y1={padTop + chartH}
                    x2={padLeft + chartW}
                    y2={padTop}
                    stroke="#10b981"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />

                  {/* Axis labels */}
                  <text
                    x={padLeft + chartW / 2}
                    y={padTop + chartH + 28}
                    className="chart-text"
                    textAnchor="middle"
                    style={{ fontWeight: '600' }}
                  >
                    Predicted SEE Grade (X)
                  </text>
                  <text
                    x="10"
                    y="110"
                    className="chart-text"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: '600' }}
                    textAnchor="middle"
                  >
                    Actual SEE Grade (Y)
                  </text>
                </svg>
              );
            })()}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            *The green dashed line represents the identity function (perfect prediction: y = ŷ).
          </div>
        </div>

      </div>
    </div>
  );
}
