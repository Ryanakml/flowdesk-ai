function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character] ?? character;
  });
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>'
    );
}

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: Array<{ type: "paragraph" | "list" | "code"; lines: string[] }> = [];
  let current: { type: "paragraph" | "list" | "code"; lines: string[] } | null = null;
  let inCode = false;

  const flush = () => {
    if (current?.lines.length) blocks.push(current);
    current = null;
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) flush();
      else {
        flush();
        current = { type: "code", lines: [] };
      }
      inCode = !inCode;
    } else if (inCode) {
      current?.lines.push(line);
    } else if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
      if (current?.type !== "list") flush();
      current ??= { type: "list", lines: [] };
      current.lines.push(line.replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
    } else if (line.trim() === "") {
      flush();
    } else {
      if (current?.type !== "paragraph") flush();
      current ??= { type: "paragraph", lines: [] };
      current.lines.push(line);
    }
  }
  flush();

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <pre
              key={index}
              className="my-2 overflow-x-auto rounded-md bg-background/70 p-2 text-xs"
            >
              <code>{block.lines.join("\n")}</code>
            </pre>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="my-1 list-disc space-y-0.5 pl-5">
              {block.lines.map((line, itemIndex) => (
                <li key={itemIndex} dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />
              ))}
            </ul>
          );
        }
        return (
          <p
            key={index}
            className="my-1"
            dangerouslySetInnerHTML={{ __html: inlineMarkdown(block.lines.join("\n")) }}
          />
        );
      })}
    </div>
  );
}
