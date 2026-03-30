import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import {
  getResourceBannerImage,
  getResourceChapter,
} from "@/lib/resources";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

type ChapterOgImageProps = {
  params: Promise<{
    chapter: string;
  }>;
};

export default async function ChapterOgImage({ params }: ChapterOgImageProps) {
  const { chapter } = await params;
  const chapterData = getResourceChapter(chapter);

  if (!chapterData) {
    notFound();
  }

  const banner = chapterData.articles[0]
    ? getResourceBannerImage(chapterData.articles[0])
    : "/demo.png";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          background: "#09090b",
          color: "white",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner}
          alt={chapterData.title}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(9,9,11,0.16) 0%, rgba(9,9,11,0.86) 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            width: "100%",
            padding: "54px 64px",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 20,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.72)",
              fontWeight: 700,
            }}
          >
            Trackly Resources
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: "88%",
              fontSize: 62,
              lineHeight: 1.08,
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            {chapterData.title}
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: "74%",
              fontSize: 24,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.84)",
            }}
          >
            {chapterData.description}
          </div>
        </div>
      </div>
    ),
    size
  );
}
