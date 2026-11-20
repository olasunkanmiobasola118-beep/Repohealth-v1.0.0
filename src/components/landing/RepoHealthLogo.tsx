interface RepoHealthLogoProps {
  inverted?: boolean;
  showWordmark?: boolean;
}

export function RepoHealthLogo({ inverted = false, showWordmark = true }: RepoHealthLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 shrink-0"
        aria-hidden="true"
      >
        <rect
          x="2"
          y="2"
          width="20"
          height="20"
          rx="5"
          className={inverted ? 'fill-white/10 stroke-white/25' : 'fill-[#111116] stroke-[#111116]'}
          strokeWidth="1.25"
        />
        <path
          d="M5.5 12h3.2l2-4.5 2.6 9 2-4.5h3.2"
          stroke="#7656D6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark ? (
        <span
          className={`font-display font-bold text-[17px] tracking-tight ${
            inverted ? 'text-white' : 'text-[#111114]'
          }`}
        >
          Repo Health
        </span>
      ) : null}
    </span>
  );
}
