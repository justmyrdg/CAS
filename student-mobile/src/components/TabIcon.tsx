import Svg, { Path, Rect, Circle } from 'react-native-svg';

type Name = 'classes' | 'progress' | 'profile' | 'camera';

export default function TabIcon({ name, color, size = 20 }: { name: Name; color: string; size?: number }) {
  if (name === 'camera') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M4 8a2 2 0 012-2h1.6l1.4-2h6l1.4 2H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2z"
          stroke={color}
          strokeWidth={1.8}
          fill="none"
          strokeLinejoin="round"
        />
        <Circle cx={12} cy={12.5} r={3.6} stroke={color} strokeWidth={1.8} fill="none" />
      </Svg>
    );
  }
  if (name === 'classes') {
    return (
      <Svg width={20} height={20} viewBox="0 0 20 20">
        <Path
          d="M4 3h8a2 2 0 012 2v12l-6-3-6 3V5a2 2 0 012-2z"
          stroke={color}
          strokeWidth={1.7}
          fill="none"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (name === 'progress') {
    return (
      <Svg width={20} height={20} viewBox="0 0 20 20">
        <Rect x={3} y={10} width={3} height={7} fill={color} />
        <Rect x={8.5} y={6} width={3} height={11} fill={color} />
        <Rect x={14} y={2} width={3} height={15} fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx={10} cy={6.5} r={3.5} stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="M3 17c0-3.5 3.1-6 7-6s7 2.5 7 6" stroke={color} strokeWidth={1.7} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
