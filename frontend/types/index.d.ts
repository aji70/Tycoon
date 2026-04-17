import React from "react";
import { StaticImageData } from "next/image";

export type LogoTypes = {
  className: string;
  image: StaticImageData;
  href: string;
  /** Intrinsic width/height for next/image (defaults tuned for navbar PNG). */
  width?: number;
  height?: number;
  sizes?: string;
  imageClassName?: string;
};