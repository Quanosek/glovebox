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
  className,
}: {
  carId: string;
  brand: string;
  size: number;
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
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local route, no optimisation needed
    <img
      key={carId}
      ref={img}
      src={logoHref(carId)}
      alt={`Logo ${brand}`}
      height={size}
      style={{ height: size, maxWidth: size * 3.5 }}
      className={`w-auto object-contain ${className ?? ""}`}
      onError={() => setFailed(carId)}
    />
  );
}
