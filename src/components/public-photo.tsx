import Image, { getImageProps } from "next/image";
import { photoQuality } from "@/lib/photo-quality";

const mobilePhotos: Record<string, string> = {
  "/images/living-room.webp": "living-room",
  "/images/home-detail.webp": "home-detail",
  "/images/kitchen-detail.webp": "kitchen-detail",
  "/images/bathroom-detail.webp": "bathroom-detail",
};
const mobileWidths = [384, 512, 640, 750, 828, 1080, 1200, 1440, 1600, 1920];
type Props = {
  src: string;
  alt: string;
  sizes: string;
  mobilePanelSizes?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  unoptimized?: boolean;
};

export function PublicPhoto({ mobilePanelSizes, ...props }: Props) {
  const name = mobilePhotos[props.src];
  const common = { ...props, fill: true, quality: photoQuality };
  if (!name || !mobilePanelSizes || props.unoptimized)
    return <Image {...common} alt={props.alt} />;
  const { props: imageProps } = getImageProps(common);
  const srcSet = (format: string) =>
    mobileWidths
      .map((width) => `/images/mobile/${name}-${width}.${format} ${width}w`)
      .join(", ");
  return (
    <picture>
      <source
        media="(max-width: 540px)"
        type="image/avif"
        srcSet={srcSet("avif")}
        sizes={mobilePanelSizes}
      />
      <source
        media="(max-width: 540px)"
        type="image/webp"
        srcSet={srcSet("webp")}
        sizes={mobilePanelSizes}
      />
      {/* Next's getImageProps supplies optimized desktop sources; mobile variants are pre-encoded. */}
      <img {...imageProps} alt={props.alt} />
    </picture>
  );
}
