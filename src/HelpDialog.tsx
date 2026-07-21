import { BookOpen, Search, X } from "lucide-react";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

import readme from "../README.md?raw";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

interface HelpSection {
  id: string;
  title: string;
  level: number;
  body: string;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseSections(markdown: string): HelpSection[] {
  const sections: HelpSection[] = [];
  let current: HelpSection | null = null;

  for (const line of markdown.split("\n")) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      if (current) sections.push(current);
      const title = heading[2].trim();
      current = {
        id: `${slug(title)}-${sections.length}`,
        title,
        level: heading[1].length,
        body: "",
      };
    } else if (current) {
      current.body += `${line}\n`;
    }
  }

  if (current) sections.push(current);
  return sections;
}

function highlight(text: string, query: string, key: string): ReactNode[] {
  const term = query.trim();
  if (!term) return [text];

  const nodes: ReactNode[] = [];
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let cursor = 0;
  let match = lowerText.indexOf(lowerTerm);

  while (match >= 0) {
    if (match > cursor) nodes.push(text.slice(cursor, match));
    nodes.push(<mark key={`${key}-${match}`}>{text.slice(match, match + term.length)}</mark>);
    cursor = match + term.length;
    match = lowerText.indexOf(lowerTerm, cursor);
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function renderInline(text: string, query: string, key: string): ReactNode[] {
  const token = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = token.exec(text))) {
    if (match.index > cursor) {
      nodes.push(...highlight(text.slice(cursor, match.index), query, `${key}-text-${cursor}`));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a key={`${key}-link-${match.index}`} href={match[3]} target="_blank" rel="noreferrer">
          {highlight(match[2], query, `${key}-link-label-${match.index}`)}
        </a>,
      );
    } else if (match[4]) {
      nodes.push(
        <code key={`${key}-code-${match.index}`}>
          {highlight(match[4], query, `${key}-code-text-${match.index}`)}
        </code>,
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={`${key}-strong-${match.index}`}>
          {highlight(match[5], query, `${key}-strong-text-${match.index}`)}
        </strong>,
      );
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(...highlight(text.slice(cursor), query, `${key}-tail-${cursor}`));
  }
  return nodes;
}

function tableCells(line: string) {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line: string) {
  return tableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderBlocks(body: string, query: string, sectionId: string) {
  const lines = body.replace(/\s+$/, "").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3);
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre key={`${sectionId}-pre-${index}`} data-language={language || undefined}>
          <code>{highlight(code.join("\n"), query, `${sectionId}-pre-code-${index}`)}</code>
        </pre>,
      );
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableDivider(lines[index + 1])) {
      const header = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="help-table-wrap" key={`${sectionId}-table-${index}`}>
          <table>
            <thead>
              <tr>
                {header.map((cell, cellIndex) => (
                  <th key={cellIndex}>{renderInline(cell, query, `${sectionId}-th-${cellIndex}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      {renderInline(cell, query, `${sectionId}-td-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*-\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`${sectionId}-ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, query, `${sectionId}-li-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`${sectionId}-ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, query, `${sectionId}-oli-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={`${sectionId}-quote-${index}`}>
          {renderInline(quote.join(" "), query, `${sectionId}-quote-text-${index}`)}
        </blockquote>,
      );
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !/^\s*(-|\d+\.|>)\s+/.test(lines[index]) &&
      !(index + 1 < lines.length && lines[index].includes("|") && isTableDivider(lines[index + 1]))
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(
      <p key={`${sectionId}-p-${index}`}>
        {renderInline(paragraph.join(" "), query, `${sectionId}-p-text-${index}`)}
      </p>,
    );
  }

  return blocks;
}

const sections = parseSections(readme);

export default function HelpDialog({ open, onClose }: HelpDialogProps) {
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  const visibleSections = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sections;
    return sections.filter((section) =>
      `${section.title}\n${section.body}`.toLowerCase().includes(term),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    window.setTimeout(() => searchInput.current?.focus(), 0);

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose, open]);

  if (!open) return null;

  function showSection(id: string) {
    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="config-dialog__header">
          <div>
            <span className="panel__kicker"><BookOpen size={15} /> User guide</span>
            <h2 id="help-title">Tax Assistant Help</h2>
            <p>The repository README, available offline inside the app.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close help">
            <X size={19} />
          </button>
        </header>

        <div className="help-toolbar">
          <label className="help-search">
            <Search size={16} />
            <input
              ref={searchInput}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the user guide"
              aria-label="Search the user guide"
            />
            <kbd>⌘ F</kbd>
          </label>
          <span>
            {query.trim()
              ? `${visibleSections.length} matching ${visibleSections.length === 1 ? "section" : "sections"}`
              : `${sections.length} sections`}
          </span>
        </div>

        <div className="help-dialog__body">
          <nav className="help-outline" aria-label="Help topics">
            <strong>Contents</strong>
            {visibleSections.map((section) => (
              <button
                key={section.id}
                className={`help-outline__level-${section.level}`}
                onClick={() => showSection(section.id)}
              >
                {highlight(section.title, query, `outline-${section.id}`)}
              </button>
            ))}
          </nav>

          <article className="help-document">
            {visibleSections.length === 0 ? (
              <div className="help-empty">
                <Search size={24} />
                <h3>No help topics found</h3>
                <p>Try a broader word, such as CSV, configuration, or import.</p>
              </div>
            ) : (
              visibleSections.map((section) => {
                const Heading = section.level === 1 ? "h1" : section.level === 2 ? "h2" : "h3";
                return (
                  <section id={`help-${section.id}`} key={section.id}>
                    <Heading>{highlight(section.title, query, `heading-${section.id}`)}</Heading>
                    {renderBlocks(section.body, query, section.id)}
                  </section>
                );
              })
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
