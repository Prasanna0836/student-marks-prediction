import React, { useState, useMemo } from 'react';
import { Sliders, Settings, HelpCircle, AlertCircle, Award, CheckSquare, Square } from 'lucide-react';
import { predictSingle, trainMultipleLinearRegression } from '../utils/regression';

const getStudyStatus = (hours) => {
  if (hours < 3) return { label: 'Very Low', color: '#ef4444', bgColor: '#fef2f2' };
  if (hours < 6) return { label: 'Moderate', color: '#3b82f6', bgColor: '#eff6ff' };
  return { label: 'High', color: '#10b981', bgColor: '#ecfdf5' };
};

const getAttendanceStatus = (pct) => {
  if (pct < 75) return { label: 'Critical', color: '#ef4444', bgColor: '#fef2f2' };
  if (pct < 90) return { label: 'Warning', color: '#f59e0b', bgColor: '#fffbeb' };
  return { label: 'Excellent', color: '#10b981', bgColor: '#ecfdf5' };
};

const getGlowStyle = (clsName) => {
  const cls = clsName.toLowerCase();
  if (cls === 'excellent') return '0 0 25px rgba(245, 158, 11, 0.45)';
  if (cls === 'good') return '0 0 25px rgba(16, 185, 129, 0.45)';
  if (cls === 'pass') return '0 0 25px rgba(59, 130, 246, 0.45)';
  return '0 0 25px rgba(239, 68, 68, 0.45)';
};

export default function Dashboard({ students, model, setModel }) {
  // All possible features
  const featureMeta = {
    G1: { label: 'CIE 1', min: 0, max: 40, step: 1, default: 22, unit: '/ 40' },
    G2: { label: 'CIE 2', min: 0, max: 40, step: 1, default: 22, unit: '/ 40' }
  };

  // State for feature selection
  const [selectedFeatures, setSelectedFeatures] = useState(['G1', 'G2']);
  
  // State for student inputs
  const [inputs, setInputs] = useState({
    G1: 22,
    G2: 22
  });

  // Handle inputs slider change
  const handleSliderChange = (feat, val) => {
    setInputs(prev => ({
      ...prev,
      [feat]: Number(val)
    }));
  };

  // Toggle features in regression
  const handleFeatureToggle = (feat) => {
    let nextFeatures;
    if (selectedFeatures.includes(feat)) {
      if (selectedFeatures.length === 1) return; // Must have at least 1 feature
      nextFeatures = selectedFeatures.filter(f => f !== feat);
    } else {
      nextFeatures = [...selectedFeatures, feat];
    }
    setSelectedFeatures(nextFeatures);
    
    // Retrain model on fly
    const retrained = trainMultipleLinearRegression(students, nextFeatures);
    if (retrained) {
      setModel(retrained);
    }
  };

  // Get average values of features in dataset
  const datasetAverages = useMemo(() => {
    if (!students || students.length === 0) return {};
    const keys = Object.keys(featureMeta);
    const avgs = {};
    keys.forEach(key => {
      const sum = students.reduce((s, row) => s + (row[key] || 0), 0);
      avgs[key] = sum / students.length;
    });
    // Add target average
    const targetSum = students.reduce((s, row) => s + (row.G3 || 0), 0);
    avgs.G3 = targetSum / students.length;
    return avgs;
  }, [students]);

  // State for holistic predictor inputs
  const [holisticInputs, setHolisticInputs] = useState({
    studyHours: 5, // Daily study hours (1-10)
    famsup: 'yes',
    attendance: 98 // Attendance percentage (50-100)
  });

  // Compute prediction and classification for the G1/G2 main model
  const { prediction, classification } = useMemo(() => {
    if (!model) return { prediction: 0, classification: 'Fail' };

    const pred = predictSingle(inputs, model.intercept, model.coefficients);
    
    // Classify G3 grade
    let className = 'Fail';
    if (pred >= 80) className = 'Excellent';
    else if (pred >= 60) className = 'Good';
    else if (pred >= 50) className = 'Pass';

    return {
      prediction: pred,
      classification: className
    };
  }, [inputs, model]);

  // Train the holistic regression model: weighted normalized scale prioritizing internal marks
  const holisticModel = useMemo(() => {
    const getDailyStudyHours = (code) => {
      if (code === 1) return 2.0;
      if (code === 2) return 4.5;
      if (code === 3) return 7.0;
      if (code === 4) return 9.0;
      return 5.0;
    };

    // 1. Prepare and normalize student records
    const prepared = students.map(s => {
      const absences = Number(s.absences) || 0;
      const attendancePct = Math.max(50, Math.min(100, ((180 - absences) / 180) * 100));
      const dailyStudyHours = typeof s.studytime === 'number' && s.studytime <= 4 ? getDailyStudyHours(s.studytime) : (Number(s.studytime) || 5.0);
      const famsup_encoded = s.famsup === 'yes' ? 1 : 0;
      
      // Normalize each feature to [0, 1] range:
      const nCie1 = s.G1 / 40;
      const nCie2 = s.G2 / 40;
      const nStudy = (dailyStudyHours - 1) / 9; // range 1 to 10
      const nFamsup = famsup_encoded; // range 0 to 1
      const nAttend = (attendancePct - 50) / 50; // range 50 to 100

      // Combined weighted feature: CIE 1 and CIE 2 get weight 2.0 each, others get 1.0 each.
      // Total weight = 2.0 + 2.0 + 1.0 + 1.0 + 1.0 = 7.0
      const jointFeature = (2.0 * nCie1 + 2.0 * nCie2 + 1.0 * nStudy + 1.0 * nFamsup + 1.0 * nAttend) / 7;

      return {
        ...s,
        dailyStudyHours,
        attendancePct,
        famsup_encoded,
        jointFeature
      };
    });

    // 2. Train OLS on the joint weighted feature: G3 = beta0 + betaJoint * jointFeature
    const trainedJoint = trainMultipleLinearRegression(prepared, ['jointFeature']);
    if (!trainedJoint) return null;

    const betaJoint = trainedJoint.coefficients.jointFeature;
    const beta0 = trainedJoint.intercept;

    // 3. Map back to raw coefficients
    const coeffCie1 = (2.0 * betaJoint) / (7 * 40);
    const coeffCie2 = (2.0 * betaJoint) / (7 * 40);
    const coeffStudy = (1.0 * betaJoint) / (7 * 9);
    const coeffFamsup = (1.0 * betaJoint) / (7 * 1);
    const coeffAttend = (1.0 * betaJoint) / (7 * 50);

    // Calculate raw constant offset:
    const constantOffset = - (betaJoint / 7) * ( (1/9) + (50/50) ); // from studyHours offset -1/9 and attendance offset -50/50
    const rawIntercept = beta0 + constantOffset;

    return {
      coefficients: {
        G1: coeffCie1,
        G2: coeffCie2,
        dailyStudyHours: coeffStudy,
        famsup_encoded: coeffFamsup,
        attendancePct: coeffAttend
      },
      intercept: rawIntercept,
      betaJoint: betaJoint
    };
  }, [students]);

  // Calculate holistic prediction
  const { holisticPrediction, holisticClassification } = useMemo(() => {
    if (!holisticModel) return { holisticPrediction: 0, holisticClassification: 'Fail' };
    const inputsToPredict = {
      G1: inputs.G1,
      G2: inputs.G2,
      dailyStudyHours: holisticInputs.studyHours,
      famsup_encoded: holisticInputs.famsup === 'yes' ? 1 : 0,
      attendancePct: holisticInputs.attendance
    };
    const pred = predictSingle(inputsToPredict, holisticModel.intercept, holisticModel.coefficients);
    const clamped = Math.max(0, Math.min(100, pred));
    
    let className = 'Fail';
    if (clamped >= 80) className = 'Excellent';
    else if (clamped >= 60) className = 'Good';
    else if (clamped >= 50) className = 'Pass';
    
    return {
      holisticPrediction: clamped,
      holisticClassification: className
    };
  }, [inputs, holisticInputs, holisticModel]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Performance Predictor</h1>
          <p className="page-subtitle">Predict student final marks and analyze contributing factors in real time.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Left Panel: Inputs & Configuration */}
        <div className="card" style={{ gridColumn: 'span 7' }}>
          <div className="card-title">
            <Sliders size={20} />
            Model Inputs & Features
          </div>

          <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
              Select Active Predictors in Regression Model:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {Object.entries(featureMeta).map(([feat, meta]) => {
                const isSelected = selectedFeatures.includes(feat);
                return (
                  <button
                    key={feat}
                    onClick={() => handleFeatureToggle(feat)}
                    className={`btn btn-secondary ${isSelected ? 'active' : ''}`}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      backgroundColor: isSelected ? 'var(--color-primary-light)' : 'white',
                      color: isSelected ? 'var(--color-primary)' : 'var(--text-secondary)',
                      borderColor: isSelected ? 'rgba(79, 70, 229, 0.2)' : 'var(--border-color)',
                    }}
                  >
                    {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              *Toggling features retrains the regression coefficients instantly in the browser.
            </p>
          </div>

          <form onSubmit={e => e.preventDefault()}>
            {Object.entries(featureMeta).map(([feat, meta]) => {
              const isSelected = selectedFeatures.includes(feat);
              if (!isSelected) return null;

              return (
                <div key={feat} className="form-group">
                  <label className="form-label">
                    <span>{meta.label}</span>
                    <span className="label-val">
                      {inputs[feat]}
                      <span style={{ fontSize: '0.75rem', fontWeight: '400', color: 'var(--text-muted)' }}>{meta.unit}</span>
                    </span>
                  </label>
                  <input
                    type="range"
                    min={meta.min}
                    max={meta.max}
                    step={meta.step}
                    value={inputs[feat]}
                    onChange={(e) => handleSliderChange(feat, e.target.value)}
                    className="slider-input"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>Min: {meta.min}</span>
                    <span>Dataset Avg: {datasetAverages[feat]?.toFixed(1)}</span>
                    <span>Max: {meta.max}</span>
                  </div>
                </div>
              );
            })}
            
            {selectedFeatures.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 0.5rem' }} />
                <p>Please select at least one predictor feature above.</p>
              </div>
            )}
          </form>
        </div>

        {/* Right Panel: Prediction Output */}
        <div className="card" style={{ gridColumn: 'span 5' }}>
          <div className="card-title">
            <Award size={20} />
            Prediction Result
          </div>

          <div className="prediction-box">
            <div className={`prediction-grade-circle ${classification.toLowerCase()}`}>
              <span className="pred-num">{prediction.toFixed(1)}</span>
              <span className="pred-max">/ 100</span>
            </div>
            <h3 className="prediction-label">Grade Class: {classification}</h3>
            <p className="prediction-desc">
              Predicted Semester End Examination (SEE) score using {selectedFeatures.length} variables.
            </p>
          </div>
        </div>

        {/* Bottom Panel: Prediction based on other factors including CIE 1 AND CIE 2 */}
        <div className="card" style={{ gridColumn: 'span 12', marginTop: '1rem' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Sliders size={20} style={{ color: 'var(--color-primary)' }} />
            Prediction based on other factors including CIE 1 AND CIE 2
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Predict Semester End marks (SEE) by combining Continuous Internal Evaluation grades (CIE 1/CIE 2) with daily study hours, family educational support, and school attendance rate.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Left Capsule: Holistic Inputs */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', margin: 0 }}>
                Behavioral Inputs
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Study Hours */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: '500' }}>
                    <span>Daily Study Hours</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        padding: '0.1rem 0.4rem', 
                        borderRadius: '4px', 
                        fontWeight: '700', 
                        color: getStudyStatus(holisticInputs.studyHours).color,
                        backgroundColor: getStudyStatus(holisticInputs.studyHours).bgColor
                      }}>
                        {getStudyStatus(holisticInputs.studyHours).label}
                      </span>
                      <strong>{holisticInputs.studyHours} hours/day</strong>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    className="slider-input"
                    value={holisticInputs.studyHours}
                    onChange={e => setHolisticInputs({...holisticInputs, studyHours: Number(e.target.value)})}
                    style={{
                      background: 'linear-gradient(90deg, #f87171 0%, #60a5fa 50%, #34d399 100%)',
                      height: '6px',
                      borderRadius: '3px',
                      outline: 'none',
                      WebkitAppearance: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <span>Average: 5 hours/day</span>
                    <span>Max: 10 hours</span>
                  </div>
                </div>

                {/* Family Support */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '500' }}>Family Educational Support</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['yes', 'no'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        className={`btn btn-secondary ${holisticInputs.famsup === opt ? 'active' : ''}`}
                        onClick={() => setHolisticInputs({...holisticInputs, famsup: opt})}
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          fontSize: '0.75rem',
                          backgroundColor: holisticInputs.famsup === opt ? 'var(--color-primary-light)' : 'white',
                          color: holisticInputs.famsup === opt ? 'var(--color-primary)' : 'var(--text-secondary)',
                          borderColor: holisticInputs.famsup === opt ? 'rgba(79, 70, 229, 0.2)' : 'var(--border-color)',
                          fontWeight: holisticInputs.famsup === opt ? '600' : '400'
                        }}
                      >
                        {opt === 'yes' ? 'Yes (Support Active)' : 'No Support'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Attendance Rate */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: '500' }}>
                    <span>School Attendance Rate</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        padding: '0.1rem 0.4rem', 
                        borderRadius: '4px', 
                        fontWeight: '700', 
                        color: getAttendanceStatus(holisticInputs.attendance).color,
                        backgroundColor: getAttendanceStatus(holisticInputs.attendance).bgColor
                      }}>
                        {getAttendanceStatus(holisticInputs.attendance).label}
                      </span>
                      <strong>{holisticInputs.attendance}% present</strong>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="1"
                    className="slider-input"
                    value={holisticInputs.attendance}
                    onChange={e => setHolisticInputs({...holisticInputs, attendance: Number(e.target.value)})}
                    style={{
                      background: 'linear-gradient(90deg, #f87171 0%, #fcd34d 50%, #34d399 100%)',
                      height: '6px',
                      borderRadius: '3px',
                      outline: 'none',
                      WebkitAppearance: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <span>Average: 80% attendance</span>
                    <span>Max: 100%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Capsule: Holistic Prediction Output */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: '600', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', margin: 0 }}>
                Prediction Outcomes
              </h4>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '0.75rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(${getGlowStyle(holisticClassification)})` }}>
                    {/* Background track circle */}
                    <circle
                      cx="45"
                      cy="45"
                      r="38"
                      fill="transparent"
                      stroke="rgba(226, 232, 240, 0.4)"
                      strokeWidth="5"
                    />
                    {/* Foreground progress circle */}
                    <circle
                      cx="45"
                      cy="45"
                      r="38"
                      fill="transparent"
                      stroke={
                        holisticClassification.toLowerCase() === 'excellent' ? '#f59e0b' :
                        holisticClassification.toLowerCase() === 'good' ? '#10b981' :
                        holisticClassification.toLowerCase() === 'pass' ? '#3b82f6' : '#ef4444'
                      }
                      strokeWidth="6"
                      strokeDasharray="238.7"
                      strokeDashoffset={238.7 * (1 - holisticPrediction / 100)}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}
                    />
                  </svg>
                  {/* Overlay text inside the circle */}
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.1' }}>{holisticPrediction.toFixed(1)}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>/ 100</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    Holistic SEE Prediction
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                    Grade Class: <span style={{ color: `var(--color-${holisticClassification.toLowerCase() === 'excellent' ? 'warning' : holisticClassification.toLowerCase() === 'good' ? 'success' : holisticClassification.toLowerCase() === 'pass' ? 'primary' : 'danger'})` }}>{holisticClassification}</span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    CIE-only baseline: <strong>{prediction.toFixed(1)}/100</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
