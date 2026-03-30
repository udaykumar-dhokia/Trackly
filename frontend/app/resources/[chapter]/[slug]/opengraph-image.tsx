import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getResourceArticle, getResourceBannerImage } from "@/lib/resources";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

type OgImageProps = {
  params: Promise<{
    chapter: string;
    slug: string;
  }>;
};

export default async function OgImage({ params }: OgImageProps) {
  const { chapter, slug } = await params;
  const article = getResourceArticle(chapter, slug);

  if (!article) {
    notFound();
  }

  const banner = getResourceBannerImage(article);

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
          alt={article.title}
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
              "linear-gradient(180deg, rgba(9,9,11,0.18) 0%, rgba(9,9,11,0.82) 100%)",
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
            {article.chapterTitle}
          </div>
          <div
            style={{
              display: "flex",
              maxWidth: "88%",
              fontSize: 58,
              lineHeight: 1.08,
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            {article.title}
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
            {article.description}
          </div>
        </div>
      </div>
    ),
    size
  );
}
