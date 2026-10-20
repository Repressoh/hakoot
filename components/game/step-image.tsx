import Image from "next/image";

/** A step's image as the Convex queries return it. */
export interface StepImageView {
  alt: string;
  height: number;
  url: string;
  width: number;
}

interface Props {
  image: StepImageView;
  /** The tallest the image may be, as a CSS length. */
  maxHeight?: string;
}

/**
 * A step's image, centered, never wider than its container or its own size, nor taller than
 * `maxHeight`. The box is sized from the stored size, so the content below doesn't jump when the
 * image loads.
 */
export function StepImage({ image, maxHeight = "60vh" }: Props) {
  const aspectRatio = image.width / image.height;
  return (
    <Image
      alt={image.alt}
      className="mx-auto h-auto rounded-xl"
      height={image.height}
      src={image.url}
      style={{
        aspectRatio,
        width: `min(100%, ${image.width}px, calc(${maxHeight} * ${aspectRatio}))`,
      }}
      // Served as uploaded: the editor already shrinks large photos, and
      // Convex storage URLs need no image optimizer in front of them.
      unoptimized
      width={image.width}
    />
  );
}
