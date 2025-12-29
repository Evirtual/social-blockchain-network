import type { CSSProperties, ImgHTMLAttributes } from "react";

import basePng from "../../../assets/chain-logos/base.png";
import bscPng from "../../../assets/chain-logos/bsc.png";
import ethPng from "../../../assets/chain-logos/eth.png";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "width" | "height" | "src" | "alt"> & {
  size?: number;
};

function Svg({ size = 22, children }: { size?: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

function LogoImg({ src, size = 22, style, ...props }: Props & { src: string }) {
  const ariaLabel = (props as any)?.["aria-label"] as string | undefined;
  const mergedStyle: CSSProperties = {
    display: "block",
    width: size,
    height: size,
    objectFit: "contain",
    ...(style ?? {})
  };

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={ariaLabel ?? ""}
      aria-hidden={ariaLabel ? undefined : true}
      draggable={false}
      style={mergedStyle}
      {...props}
    />
  );
}

export function ChainLogo({ chainId, size = 22, ...props }: Props & { chainId: number }) {
  if (chainId === 1 || chainId === 11155111) {
    return <LogoImg src={ethPng} size={size} {...props} />;
  }

  if (chainId === 8453 || chainId === 84532) {
    return <LogoImg src={basePng} size={size} {...props} />;
  }

  if (chainId === 56 || chainId === 97) {
    return <LogoImg src={bscPng} size={size} {...props} />;
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
