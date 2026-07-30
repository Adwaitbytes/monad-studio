"use client";

import React from "react";

/**
 * Renders the small subset of Markdown the assistant actually emits.
 *
 * The panel previously printed raw text, so headings arrived as "## Security
 * Audit Report" and emphasis as "**Risk Level:**". A full Markdown library is
 * far more than this needs, and everything here is escaped by React rather than
 * injected as HTML.
 */

type Props = { content: string; isDark: boolean };

/** Splits a line into bold, inline-code and plain runs. */
function renderInline(text: string, isDark: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];

    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className={isDark ? "text-white" : "text-gray-900"}>
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <code
          key={key++}
          className={`px-1 py-0.5 rounded text-[11px] font-mono ${
            isDark ? "bg-purple-500/15 text-purple-300" : "bg-purple-50 text-purple-700"
          }`}
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ content, isDark }: Props) {
  const blocks: React.ReactNode[] = [];
  const lines = content.split("\n");
  let list: string[] = [];
  let code: string[] | null = null;
  let key = 0;

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={key++} className="space-y-1 my-2">
        {list.map((item, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed">
            <span className={isDark ? "text-purple-400" : "text-purple-500"}>•</span>
            <span className={isDark ? "text-gray-300" : "text-gray-700"}>
              {renderInline(item, isDark)}
            </span>
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (code === null) {
        flushList();
        code = [];
      } else {
        blocks.push(
          <pre
            key={key++}
            className={`my-2 p-2.5 rounded-lg overflow-x-auto text-[11px] font-mono ${
              isDark ? "bg-black/40 border border-white/10" : "bg-gray-50 border border-gray-200"
            }`}
          >
            <code className={isDark ? "text-gray-300" : "text-gray-800"}>{code.join("\n")}</code>
          </pre>
        );
        code = null;
      }
      continue;
    }

    if (code !== null) {
      code.push(line);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const depth = heading[1].length;
      const size = depth <= 2 ? "text-sm" : "text-xs";
      blocks.push(
        <p
          key={key++}
          className={`${size} font-bold mt-3 mb-1.5 ${isDark ? "text-white" : "text-gray-900"}`}
        >
          {renderInline(heading[2], isDark)}
        </p>
      );
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }

    if (!line.trim()) {
      flushList();
      continue;
    }

    flushList();
    blocks.push(
      <p
        key={key++}
        className={`text-xs leading-relaxed my-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}
      >
        {renderInline(line, isDark)}
      </p>
    );
  }

  flushList();
  if (code?.length) {
    blocks.push(
      <pre
        key={key++}
        className={`my-2 p-2.5 rounded-lg overflow-x-auto text-[11px] font-mono ${
          isDark ? "bg-black/40 border border-white/10" : "bg-gray-50 border border-gray-200"
        }`}
      >
        <code className={isDark ? "text-gray-300" : "text-gray-800"}>{code.join("\n")}</code>
      </pre>
    );
  }

  return <div>{blocks}</div>;
}
