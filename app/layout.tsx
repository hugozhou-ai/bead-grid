import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const basePath = process.env.GITHUB_PAGES === "true" ? "/bead-grid" : "";
const title = "豆格 Bead Grid｜图片转拼豆图纸";
const description = "在浏览器本地把照片转换为可编辑、可统计、可导出的拼豆图纸。支持手机和电脑。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: `${siteUrl}/og.png`, width: 1731, height: 909, alt: "豆格钢笔手绘风图片转拼豆图纸工具" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="stylesheet" href={`${basePath}/fonts/lxgw-wenkai/regular.css`} />
        <link rel="stylesheet" href={`${basePath}/fonts/lxgw-wenkai/bold.css`} />
      </head>
      <body>{children}</body>
    </html>
  );
}
