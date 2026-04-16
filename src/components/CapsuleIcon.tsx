import React from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';

interface CapsuleIconProps {
  size?: number;
  color: string;
  /** When true, envelope fill is solid (active tab). */
  filled?: boolean;
}

/**
 * Custom Capsule icon — an envelope fused with a clock face in the corner.
 * Designed on a 24x24 grid to match Ionicons.
 */
export default function CapsuleIcon({ size = 24, color, filled = false }: CapsuleIconProps) {
  const stroke = color;
  const strokeWidth = 1.8;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Envelope body (rounded rect) */}
      <Path
        d="M3 7 Q3 5 5 5 L19 5 Q21 5 21 7 L21 17 Q21 19 19 19 L5 19 Q3 19 3 17 Z"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill={filled ? `${color}22` : 'none'}
        strokeLinejoin="round"
      />

      {/* Envelope flap — V shape from top corners to middle */}
      <Path
        d="M3.8 6.6 L12 12.2 L20.2 6.6"
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Clock face — top-right corner, slightly overlapping envelope */}
      <Circle
        cx={17.5}
        cy={17}
        r={4.5}
        fill={filled ? color : stroke === color ? '#0A0A0A' : '#0A0A0A'}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />

      {/* Clock hands — pointing to ~10 and 2 */}
      <Line
        x1={17.5}
        y1={17}
        x2={17.5}
        y2={14.8}
        stroke={filled ? '#0A0A0A' : stroke}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <Line
        x1={17.5}
        y1={17}
        x2={19.1}
        y2={17}
        stroke={filled ? '#0A0A0A' : stroke}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}
