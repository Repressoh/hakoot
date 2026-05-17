interface ShapeProps {
  className?: string;
  size?: number;
}

function TriangleShape({ size = 20, className }: ShapeProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      viewBox="0 0 20 20"
      width={size}
    >
      <polygon points="10,2 18,17 2,17" />
    </svg>
  );
}

function DiamondShape({ size = 20, className }: ShapeProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      viewBox="0 0 20 20"
      width={size}
    >
      <polygon points="10,1 19,10 10,19 1,10" />
    </svg>
  );
}

function CircleShape({ size = 20, className }: ShapeProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      viewBox="0 0 20 20"
      width={size}
    >
      <circle cx="10" cy="10" r="8" />
    </svg>
  );
}

function SquareShape({ size = 20, className }: ShapeProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      viewBox="0 0 20 20"
      width={size}
    >
      <rect height="15" rx="2" width="15" x="2.5" y="2.5" />
    </svg>
  );
}

export const CHOICE_SHAPES = [
  TriangleShape,
  DiamondShape,
  CircleShape,
  SquareShape,
] as const;
