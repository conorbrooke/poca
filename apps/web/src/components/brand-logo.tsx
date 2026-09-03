import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
  alt?: string;
};

export function BrandLogo({
  size = 36,
  className,
  alt = "",
}: BrandLogoProps) {
  return (
    <Image
      src="/poca-mark.png"
      alt={alt}
      width={size}
      height={size}
      className={className ?? "app-brand-logo"}
      priority
    />
  );
}
