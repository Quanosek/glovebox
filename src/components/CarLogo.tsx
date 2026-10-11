"use client";

import { useEffect, useRef, useState } from "react";
import { logoHref } from "@/lib/cars";
import { Logo } from "./Logo";

/**
 * Official logo of the car's brand in its model year (docs/logos.md); the
 * app icon when no logo is known or it cannot be loaded.
 */
export function CarLogo({
  carId,
  brand,
  size,
  logo,
  fill = false,
  className,
}: {
  carId: string;
  brand: string;
  size: number;
  /**
   * Pixel size of the cached logo (`CarSummary.logo`): the image gets its
   * final width before it loads. Unknown logos reserve the square of the app
   * icon that replaces a missing one.
   */
  logo?: { width: number; height: number };
  /** Fill the parent box (object-contain), e.g. the padded car page frame. */
  fill?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A server-rendered image may fail before hydration attaches onError.
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(carId);
  }, [carId]);
  if (failed === carId) return <Logo size={size} className={className} />;
  // Wordmarks may be up to 3.5 times as wide as they are tall.
  const width = logo
    ? Math.round(Math.min((size * logo.width) / logo.height, size * 3.5))
    : size;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local route, no optimisation needed
    <img
      key={carId}
      ref={img}
      src={logoHref(carId)}
      alt={`Logo ${brand}`}
      width={fill ? undefined : width}
      height={size}
      style={fill ? { width: "100%", height: "100%" } : { width, height: size }}
      className={`object-contain ${className ?? ""}`}
      onError={() => setFailed(carId)}
    />
  );
}
