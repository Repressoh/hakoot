interface ChoiceShapeIconProps {
  className?: string;
  index: number;
  size?: number;
}

export function ChoiceShapeIcon({
  index,
  size = 20,
  className,
}: ChoiceShapeIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      viewBox="0 0 20 20"
      width={size}
    >
      {index === 0 && <polygon points="10,2 18,17 2,17" />}
      {index === 1 && <polygon points="10,1 19,10 10,19 1,10" />}
      {index === 2 && <circle cx="10" cy="10" r="8" />}
      {index === 3 && <rect height="15" rx="2" width="15" x="2.5" y="2.5" />}
    </svg>
  );
}
