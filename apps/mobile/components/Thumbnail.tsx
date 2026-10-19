import { useState, type ReactNode } from "react";
import { Image, type ImageProps } from "react-native";

import { mobileTheme } from "../theme";

type ThumbnailProps = Omit<ImageProps, "source"> & {
  uri?: string | null;
  size?: number;
  fallback: ReactNode;
};

/** Domain wrappers choose the URI and fallback; this component owns image failure only. */
export function Thumbnail({ uri, size = 36, fallback, style, onError, ...props }: ThumbnailProps) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return <>{fallback}</>;
  return <Image {...props} source={{ uri }} onError={(event) => { setFailed(true); onError?.(event); }} style={[{ width: size, height: size, borderRadius: 8, backgroundColor: mobileTheme.color.bgSurface }, style]} />;
}
