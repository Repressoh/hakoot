"use client";

import Image from "next/image";
import { type CSSProperties, Suspense, use } from "react";
import { stepImageSource } from "./step-image-source";

/** A step's image as the Convex queries return it. */
export interface StepImageView {
  alt: string;
  height: number;
  /** The key its file is encrypted with. */
  key: string;
  type: string;
  /** Where its encrypted file is. */
  url: string;
  width: number;
}

interface Props {
  image: StepImageView;
  /** The tallest the image may be, as a CSS length. */
  maxHeight?: string;
}

const BOX_CLASS = "mx-auto h-auto rounded-xl";

interface DecryptedImageProps {
  image: StepImageView;
  style: CSSProperties;
}

/** The image, once its file is downloaded and decrypted; an empty box of its size if that fails. */
function DecryptedImage({ image, style }: DecryptedImageProps) {
  const src = use(stepImageSource(image));
  if (!src) {
    return (
      <div
        aria-label={image.alt || undefined}
        className={`${BOX_CLASS} bg-muted`}
        role="img"
        style={style}
      />
    );
  }
  return (
    <Image
      alt={image.alt}
      className={BOX_CLASS}
      height={image.height}
      src={src}
      style={style}
      // A decrypted data URL: there is nothing for an image optimizer to
      // fetch, and the editor already shrinks large photos.
      unoptimized
      width={image.width}
    />
  );
}

/**
 * A step's image, centered, never wider than its container or its own size, nor taller than
 * `maxHeight`. The box is sized from the stored size, so the content below doesn't jump while the
 * image downloads and is decrypted.
 */
export function StepImage({ image, maxHeight = "60vh" }: Props) {
  const aspectRatio = image.width / image.height;
  const style = {
    aspectRatio,
    width: `min(100%, ${image.width}px, calc(${maxHeight} * ${aspectRatio}))`,
  };
  return (
    <Suspense
      fallback={
        <div
          aria-hidden
          className={`${BOX_CLASS} animate-pulse bg-muted`}
          style={style}
        />
      }
    >
      <DecryptedImage image={image} style={style} />
    </Suspense>
  );
}
