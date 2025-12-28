import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
};

function Svg({ size = 22, children, ...props }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={props["aria-label"] ? undefined : true}
      focusable="false"
      style={{ display: "block" }}
      {...props}
    >
      {children}
    </svg>
  );
}

export function ChainLogo({ chainId, size = 22, ...props }: Props & { chainId: number }) {
  // Logos are rendered monochrome using `currentColor` so they fit the existing theme tokens.
  if (chainId === 1 || chainId === 11155111) {
    // Ethereum (diamond)
    return (
      <Svg size={size} {...props}>
        <path d="M12 2 6.2 12 12 9.3 17.8 12 12 2Z" fill="currentColor" fillOpacity={0.92} />
        <path d="M12 22 6.2 13.1 12 16.7 17.8 13.1 12 22Z" fill="currentColor" fillOpacity={0.92} />
        <path d="M6.2 12.6 12 15.9 17.8 12.6 12 10.1 6.2 12.6Z" fill="currentColor" fillOpacity={0.65} />
      </Svg>
    );
  }

  if (chainId === 8453 || chainId === 84532) {
    // Base (simple ring mark)
    return (
      <Svg size={size} {...props}>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="3" />
        <circle cx="12" cy="12" r="3.5" fill="var(--bg)" />
      </Svg>
    );
  }

  if (chainId === 56 || chainId === 97) {
    // BSC (hex + inner nodes)
    return (
      <Svg size={size} {...props}>
        <path
          d="M12 3.5 18.8 7.5v9L12 20.5 5.2 16.5v-9L12 3.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M12 7.2 14.7 9v3L12 13.8 9.3 12v-3L12 7.2Z"
          fill="currentColor"
          fillOpacity={0.9}
        />
        <circle cx="12" cy="6.2" r="1" fill="currentColor" />
        <circle cx="16.9" cy="9" r="1" fill="currentColor" />
        <circle cx="16.9" cy="15" r="1" fill="currentColor" />
        <circle cx="12" cy="17.8" r="1" fill="currentColor" />
        <circle cx="7.1" cy="15" r="1" fill="currentColor" />
        <circle cx="7.1" cy="9" r="1" fill="currentColor" />
      </Svg>
    );
  }

  // Local / default
  return (
    <Svg size={size} {...props}>
      <path
        d="M6.5 10.5a5.5 5.5 0 0 1 11 0v1.2c0 .8.3 1.3.8 1.8l.7.7c.3.3.2.8-.2.9-1.6.6-3.7 1.2-6.8 1.2s-5.2-.6-6.8-1.2c-.4-.1-.5-.6-.2-.9l.7-.7c.5-.5.8-1 .8-1.8v-1.2Z"
        fill="currentColor"
        fillOpacity={0.85}
      />
      <path d="M9.2 18.2c.5 1.1 1.6 1.8 2.8 1.8s2.3-.7 2.8-1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}
