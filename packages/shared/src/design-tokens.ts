export const colorTokens = {
  bg: {
    app: "#07090D",
    canvas: "#0B0F14",
    surface: "#141820",
    surfaceAlt: "#1A1F28",
    elevated: "#202634",
  },
  text: {
    primary: "#F4F7FB",
    secondary: "#A6AFBC",
    muted: "#788395",
    inverse: "#06090D",
  },
  brand: {
    primary: "#CBFF1A",
    primaryHover: "#D7FF48",
    primaryPressed: "#B4E600",
    primarySoft: "#243000",
  },
  state: {
    success: "#19C37D",
    warning: "#F4B400",
    danger: "#FF4D4F",
    info: "#4EA1FF",
  },
  border: {
    subtle: "#252B35",
    strong: "#323B49",
    focus: "#CBFF1A",
  },
} as const;

export const spacingTokens = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radiusTokens = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const shadowTokens = {
  low: "0 2px 8px rgba(0, 0, 0, 0.28)",
  mid: "0 8px 24px rgba(0, 0, 0, 0.32)",
  high: "0 18px 40px rgba(0, 0, 0, 0.4)",
  glowBrand: "0 0 0 1px rgba(203, 255, 26, 0.35), 0 8px 30px rgba(203, 255, 26, 0.2)",
} as const;

export const typographyTokens = {
  family: {
    sans: "'Inter', 'SF Pro Text', 'Segoe UI', sans-serif",
    display: "'Inter', 'SF Pro Display', 'Segoe UI', sans-serif",
  },
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 40,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.15,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

export const componentTokens = {
  button: {
    heightSm: 36,
    heightMd: 44,
    heightLg: 52,
  },
  input: {
    height: 44,
  },
  nav: {
    desktopSidebarWidth: 240,
    mobileTabBarHeight: 64,
  },
  card: {
    minHeight: 120,
  },
} as const;

export const gymnasiaTokens = {
  color: colorTokens,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadow: shadowTokens,
  typography: typographyTokens,
  component: componentTokens,
} as const;

export type GymnasiaTokens = typeof gymnasiaTokens;
