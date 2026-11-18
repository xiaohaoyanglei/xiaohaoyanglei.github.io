import type { SVGProps } from "react";

// Minimal stroke icons drawn for this site (no icon font, no brand marks).

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const MailIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
    <path d="m2.6 4.4 5.4 4.2 5.4-4.2" />
  </Icon>
);

export const ScholarIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M1.5 6.2 8 3l6.5 3.2L8 9.4z" />
    <path d="M4.2 7.6v3c1 1.2 2.3 1.8 3.8 1.8s2.8-.6 3.8-1.8v-3" />
    <path d="M14.5 6.2v3.6" />
  </Icon>
);

export const CodeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5.5 4.5-3.5 3.5 3.5 3.5" />
    <path d="m10.5 4.5 3.5 3.5-3.5 3.5" />
    <path d="m9.2 2.8-2.4 10.4" />
  </Icon>
);

export const DocumentIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 1.8h5.2L12.5 5v9.2H4z" />
    <path d="M9 1.8V5.2h3.5" />
    <path d="M6 8.2h4.5M6 10.8h4.5" />
  </Icon>
);

export const ExternalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 3.5H3.5v9h9V10" />
    <path d="M9 2.5h4.5V7" />
    <path d="M13.2 2.8 7.5 8.5" />
  </Icon>
);

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m3 8.5 3 3 7-7" />
  </Icon>
);

export const ArrowIcon = ({ direction, ...props }: IconProps & { direction: "left" | "right" | "up" }) => (
  <Icon {...props}>
    {direction === "left" ? <path d="M13 8H3m4-4.5L2.5 8 7 12.5" /> : null}
    {direction === "right" ? <path d="M3 8h10M9 3.5 13.5 8 9 12.5" /> : null}
    {direction === "up" ? <path d="M8 13V3M3.5 7 8 2.5 12.5 7" /> : null}
  </Icon>
);

export const ResampleIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.97" />
    <path d="M11.8 1.45v2.6H9.2" />
  </Icon>
);

export const PauseIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="5.5" />
  </Icon>
);
