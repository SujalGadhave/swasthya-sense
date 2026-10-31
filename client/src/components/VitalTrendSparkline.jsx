import React from 'react';

/**
 * Pure SVG Sparkline Component for Visualizing 3-Point Vital Trends (e.g. Rule R5).
 * Built with zero external charting dependencies to adhere strictly to hackathon constraints.
 *
 * @param {Object} props
 * @param {number[]} props.readings - Sequential vital readings (e.g. [128, 136, 145])
 * @param {number} [props.threshold=140] - Clinical alert threshold line
 * @param {string} [props.unit='mmHg'] - Unit of measurement
 * @param {string} [props.label='Systolic Blood Pressure'] - Display label
 */
export default function VitalTrendSparkline({
  readings = [],
  threshold = 140,
  unit = 'mmHg',
  label = 'Systolic Blood Pressure',
}) {
  if (!Array.isArray(readings) || readings.length < 2) {
    return null;
  }

  const width = 260;
  const height = 80;
  const paddingX = 35;
  const paddingTop = 20;
  const paddingBottom = 22;

  const minVal = Math.min(...readings, threshold ? threshold - 10 : readings[0]);
  const maxVal = Math.max(...readings, threshold ? threshold + 10 : readings[readings.length - 1]);
  const range = maxVal - minVal || 1;

  // Scale Y coordinate (higher value -> lower Y in SVG)
  const getY = (val) => {
    const normalized = (val - minVal) / range;
    return height - paddingBottom - normalized * (height - paddingTop - paddingBottom);
  };

  // Scale X coordinate
  const getX = (index) => {
    return paddingX + (index / (readings.length - 1)) * (width - 2 * paddingX);
  };

  // Build SVG path
  const points = readings.map((val, idx) => ({ x: getX(idx), y: getY(val), val }));
  const pathD = points.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ''
  );

  const thresholdY = threshold ? getY(threshold) : null;
  const isRising = readings.every((v, i, arr) => i === 0 || v > arr[i - 1]);
  const netDelta = readings[readings.length - 1] - readings[0];

  return (
    <div className="sparkline-container">
      <div className="sparkline-header">
        <span className="sparkline-title">📈 {label} 3-Visit Trend</span>
        {isRising && (
          <span className="trend-badge badge-rising">
            ▲ Rising Trend (+{netDelta} {unit})
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="sparkline-svg"
        aria-label={`${label} trend: ${readings.join(', ')} ${unit}`}
      >
        {/* Background Grid Lines */}
        <line
          x1={paddingX}
          y1={paddingTop}
          x2={width - paddingX}
          y2={paddingTop}
          stroke="#e2e8f0"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
        <line
          x1={paddingX}
          y1={height - paddingBottom}
          x2={width - paddingX}
          y2={height - paddingBottom}
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        {/* Clinical Alert Threshold Line */}
        {thresholdY !== null && (
          <g className="threshold-group">
            <line
              x1={paddingX - 10}
              y1={thresholdY}
              x2={width - paddingX + 10}
              y2={thresholdY}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="4,3"
            />
            <text
              x={width - paddingX + 12}
              y={thresholdY + 3}
              fill="#dc2626"
              fontSize="9"
              fontWeight="700"
            >
              {threshold}
            </text>
          </g>
        )}

        {/* Shaded Area under Curve */}
        <polygon
          points={`
            ${points[0].x},${height - paddingBottom}
            ${points.map((p) => `${p.x},${p.y}`).join(' ')}
            ${points[points.length - 1].x},${height - paddingBottom}
          `}
          fill={isRising ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.1)'}
        />

        {/* Trend Polyline */}
        <path
          d={pathD}
          fill="none"
          stroke={isRising ? '#dc2626' : '#2563eb'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data Point Circles and Value Labels */}
        {points.map((pt, idx) => (
          <g key={idx}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r="4.5"
              fill="#ffffff"
              stroke={isRising ? '#dc2626' : '#2563eb'}
              strokeWidth="2.5"
            />
            <text
              x={pt.x}
              y={pt.y - 7}
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              fill={pt.val >= threshold ? '#dc2626' : '#1e293b'}
            >
              {pt.val}
            </text>
            <text
              x={pt.x}
              y={height - 6}
              textAnchor="middle"
              fontSize="8.5"
              fontWeight="600"
              fill="#64748b"
            >
              Visit {idx + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
