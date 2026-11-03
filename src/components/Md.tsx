import { Fragment, type ReactNode } from "react";

function inline(s: string, k: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) return <strong key={`${k}${i}`}>{p.slice(2, -2)}</strong>;
    if (p.length > 2 && p.startsWith("`") && p.endsWith("`")) return <code key={`${k}${i}`} className="icode">{p.slice(1, -1)}</code>;
    return <Fragment key={`${k}${i}`}>{p}</Fragment>;
  });
}

function Plain({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        if (line.trim() === "") return <div key={i} className="gap" />;
        const head = /^#{1,4}\s+(.*)$/.exec(line);
        if (head) return <p key={i} className="mdh">{inline(head[1], `h${i}`)}</p>;
        const li = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
        if (li) return <p key={i} className="mdli">• {inline(li[1], `b${i}`)}</p>;
        return <p key={i}>{inline(line, `l${i}`)}</p>;
      })}
    </>
  );
}

/** Chhota markdown: **bold**, `code`, ``` blocks, headings, bullets. */
export function Md({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /```[\w+#-]*\n?([\s\S]*?)```/g;
  let last = 0;
  let n = 0;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    if (m.index > last) out.push(<Plain key={n++} text={text.slice(last, m.index)} />);
    out.push(<pre key={n++} className="code"><code>{m[1].replace(/\n$/, "")}</code></pre>);
    last = m.index + m[0].length;
    m = re.exec(text);
  }
  if (last < text.length) out.push(<Plain key={n++} text={text.slice(last)} />);
  return <>{out}</>;
}
