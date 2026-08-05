import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="not-found-page" tabIndex={-1}>
      <p className="not-found-code">404</p>
      <h1>没有找到这个工具</h1>
      <p>它可能尚未接入，或入口地址已经更新。</p>
      <Link className="action action-primary" href="/">返回 AI 工作台</Link>
    </main>
  );
}
