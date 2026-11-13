import { memo } from 'react';

/** The Fynro mark. Plain <img>: tiny static asset already cached by the service worker. */
export const Logo = memo(function Logo({ size = 34, radius = 10 }: { size?: number; radius?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/logo.png" alt="Fynro" width={size} height={size} draggable={false} style={{ width: size, height: size, borderRadius: radius, flex: 'none', display: 'block' }} />;
});
