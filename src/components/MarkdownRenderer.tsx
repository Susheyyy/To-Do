import { useMemo } from "react";


export function MarkdownRenderer({ content }: { content: string }) {
  const rendered = useMemo(() => {
    if (!content) return "";

    
    let html = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    
    html = html.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--color-accent, #6366f1); text-decoration: underline;">$1</a>'
    );

    
    html = html.replace(
      /`([^`]+)`/g,
      '<code style="background: rgba(255,255,255,0.08); padding: 2px 5px; border-radius: 4px; font-size: 0.88em; font-family: monospace;">$1</code>'
    );

    
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

    
    html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li style="margin-left: 18px;">$1</li>');

    
    html = html.replace(/\n/g, "<br/>");
    html = html.replace(/<\/li><br\/>/g, "</li>");

    return html;
  }, [content]);

  return (
    <div
      className="markdown-content"
      style={{
        fontSize: "13px",
        lineHeight: "1.6",
        color: "var(--color-text-primary, #ffffff)",
        wordBreak: "break-word",
      }}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

