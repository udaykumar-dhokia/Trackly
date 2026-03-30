"use client";

import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type CodeChildProps = {
  children?: React.ReactNode;
  className?: string;
};

function normalizeLanguage(rawLanguage: string) {
  const language = rawLanguage.toLowerCase();

  if (language.includes("tsx")) return "tsx";
  if (language.includes("typescript") || language === "ts") return "typescript";
  if (language.includes("jsx")) return "jsx";
  if (language.includes("javascript") || language === "js") return "javascript";
  if (language.includes("python") || language === "py") return "python";
  if (language.includes("bash") || language.includes("shell") || language.includes("sh")) return "bash";
  if (language.includes("json")) return "json";
  if (language.includes("yaml") || language.includes("yml")) return "yaml";
  if (language.includes("sql")) return "sql";
  if (language.includes("text")) return "text";

  return language || "text";
}

function readCodeChildren(children: React.ReactNode) {
  return React.Children.toArray(children).join("");
}

export default function ArticleCodeBlock(props: React.ComponentProps<"pre">) {
  const [copied, setCopied] = useState(false);
  const child = React.Children.only(props.children) as React.ReactElement<CodeChildProps>;

  if (!React.isValidElement<CodeChildProps>(child)) {
    return <pre {...props} />;
  }

  const rawLanguage = child.props.className?.replace("language-", "") ?? "text";
  const language = normalizeLanguage(rawLanguage);
  const code = readCodeChildren(child.props.children).replace(/\n$/, "");

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-white/10 bg-[#09090b] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between border-b border-white/8 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
            {language}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 transition hover:border-white/20 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          background: "transparent",
          margin: 0,
          padding: "1rem",
          fontSize: "13px",
          lineHeight: "1.7",
        }}
        codeTagProps={{
          style: {
            fontFamily: "var(--font-mono)",
          },
        }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
