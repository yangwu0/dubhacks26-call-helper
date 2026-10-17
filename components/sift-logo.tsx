type SiftLogoProps = {
  size?: "sm" | "md";
  showWordmark?: boolean;
  className?: string;
};

const sizes = {
  sm: { box: "size-9 text-lg", word: "text-base" },
  md: { box: "size-10 text-xl", word: "text-lg" },
} as const;

export function SiftLogo({ size = "md", showWordmark = false, className = "" }: SiftLogoProps) {
  const s = sizes[size];

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-primary font-display font-bold leading-none text-primary-content ${s.box}`}
        aria-hidden
      >
        S
      </span>
      {showWordmark ? (
        <span className={`font-display font-bold leading-tight text-base-content ${s.word}`}>Sift</span>
      ) : null}
    </span>
  );
}
