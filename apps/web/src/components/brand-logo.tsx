type BrandLogoProps = {
  size?: number;
  className?: string;
  alt?: string;
};

export function BrandLogo({
  size = 36,
  className,
  alt = "Póca",
}: BrandLogoProps) {
  return (
    // Auth middleware can intercept /_next/image, so load the file directly.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/poca-mark.png"
      alt={alt}
      width={size}
      height={size}
      className={className ?? "app-brand-logo"}
      style={{ width: size, height: size }}
      decoding="async"
    />
  );
}
