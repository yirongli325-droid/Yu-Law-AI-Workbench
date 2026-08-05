import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "虞律团队 AI 工作台",
  description: "团队专属的 AI 工具与 Skill 统一入口",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        {children}
      </body>
    </html>
  );
}
