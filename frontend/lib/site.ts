export const SITE_NAME = "Trackly";
export const SITE_URL = "https://tracklyai.in";
export const DEFAULT_OG_IMAGE = "/preview.png";

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}
