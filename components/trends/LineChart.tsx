import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { colors } from '@/constants/colors';

interface DataPoint {
  date: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  showDots?: boolean;
  yAxisLabel?: string;
}

export function LineChart({ 
  data, 
  color = colors.primary, 
  height = 180,
  showDots = true,
  yAxisLabel,
}: LineChartProps) {
  if (data.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Not enough data</Text>
      </View>
    );
  }

  const width = 300;
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
  const getY = (value: number) => padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;

  // Build path
  const pathD = data.map((point, i) => {
    const x = getX(i);
    const y = getY(point.value);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Y-axis labels
  const yLabels = [minValue, (minValue + maxValue) / 2, maxValue].map(v => Math.round(v));

  // X-axis labels (first, middle, last)
  const xLabels = [
    { index: 0, label: formatDate(data[0].date) },
    { index: Math.floor(data.length / 2), label: formatDate(data[Math.floor(data.length / 2)].date) },
    { index: data.length - 1, label: formatDate(data[data.length - 1].date) },
  ];

  return (
    <View style={styles.container}>
      {yAxisLabel && <Text style={styles.yAxisLabel}>{yAxisLabel}</Text>}
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Grid lines */}
        {yLabels.map((val, i) => (
          <Line
            key={i}
            x1={padding.left}
            y1={getY(val)}
            x2={width - padding.right}
            y2={getY(val)}
            stroke={colors.gray200}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((val, i) => (
          <SvgText
            key={`y-${i}`}
            x={padding.left - 8}
            y={getY(val) + 4}
            fontSize={10}
            fill={colors.gray500}
            textAnchor="end"
          >
            {val}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {xLabels.map(({ index, label }) => (
          <SvgText
            key={`x-${index}`}
            x={getX(index)}
            y={height - 8}
            fontSize={10}
            fill={colors.gray500}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}

        {/* Line */}
        <Path d={pathD} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {showDots && data.map((point, i) => (
          <Circle
            key={i}
            cx={getX(i)}
            cy={getY(point.value)}
            r={4}
            fill={color}
            stroke="#fff"
            strokeWidth={2}
          />
        ))}
      </Svg>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.gray400,
    fontSize: 14,
  },
  yAxisLabel: {
    fontSize: 11,
    color: colors.gray500,
    marginBottom: 4,
  },
});
