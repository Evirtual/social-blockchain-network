import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  filled?: boolean;
};

function BaseIcon({ size = 18, filled, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={props["aria-label"] ? undefined : true}
      focusable="false"
      style={{ display: "block" }}
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function IconSun(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
      <circle cx="12" cy="12" r="4" />
    </BaseIcon>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </BaseIcon>
  );
}

export function IconX(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </BaseIcon>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </BaseIcon>
  );
}

export function IconFlame(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 22c4.5 0 8-3.4 8-7.7 0-3.5-2.6-5.6-4.6-8.6-.7-1.1-1.1-2.4-1.4-3.7-1.7 1.4-2.7 3.6-2.7 5.9 0 1.7.5 3.2 1.4 4.4-1.9-.2-3.6-1.5-4.3-3.2C6.7 11.4 4 13.2 4 16.1 4 19.6 7.4 22 12 22z" />
    </BaseIcon>
  );
}

export function IconHeart(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20.8 4.6c-1.7-1.7-4.5-1.7-6.2 0L12 7.2 9.4 4.6c-1.7-1.7-4.5-1.7-6.2 0-1.7 1.7-1.7 4.5 0 6.2L12 19.6l8.8-8.8c1.7-1.7 1.7-4.5 0-6.2z" />
    </BaseIcon>
  );
}

export function IconRepeat(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </BaseIcon>
  );
}

export function IconBookmark(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 3h12a1 1 0 0 1 1 1v18l-7-4-7 4V4a1 1 0 0 1 1-1z" />
    </BaseIcon>
  );
}

export function IconMessage(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </BaseIcon>
  );
}

export function IconCoin(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <ellipse cx="12" cy="12" rx="8" ry="4" />
      <path d="M4 12v4c0 2.2 3.6 4 8 4s8-1.8 8-4v-4" />
      <path d="M4 12V8c0-2.2 3.6-4 8-4s8 1.8 8 4v4" />
    </BaseIcon>
  );
}
