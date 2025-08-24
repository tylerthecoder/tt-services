import { docs_v1 } from 'googleapis';

export interface GoogleDocRequest {
  title?: string;
  content: docs_v1.Schema$StructuralElement[];
}

export class MarkdownToGoogleDocConverter {
  /**
   * Converts Markdown text to Google Docs structured content
   */
  static convertToGoogleDoc(markdown: string, title?: string): GoogleDocRequest {
    const lines = markdown.split('\n');
    const content: docs_v1.Schema$StructuralElement[] = [];

    let i = 0;
    while (i < lines.length) {
      const result = this.processLine(lines, i);
      if (result.element) {
        content.push(result.element);
      }
      i = result.nextIndex;
    }

    return {
      title,
      content,
    };
  }

  private static processLine(
    lines: string[],
    index: number,
  ): { element: docs_v1.Schema$StructuralElement | null; nextIndex: number } {
    const line = lines[index];

    // Skip empty lines but create paragraph breaks
    if (!line.trim()) {
      return {
        element: this.createParagraph(''),
        nextIndex: index + 1,
      };
    }

    // Headers
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      return {
        element: this.createHeader(text, level),
        nextIndex: index + 1,
      };
    }

    // Lists
    const listMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (listMatch) {
      return this.processList(lines, index, false);
    }

    const numberedListMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (numberedListMatch) {
      return this.processList(lines, index, true);
    }

    // Tables
    if (line.includes('|') && line.trim().startsWith('|')) {
      return this.processTable(lines, index);
    }

    // Regular paragraph
    return {
      element: this.createParagraph(line),
      nextIndex: index + 1,
    };
  }

  private static processList(
    lines: string[],
    startIndex: number,
    isNumbered: boolean,
  ): { element: docs_v1.Schema$StructuralElement | null; nextIndex: number } {
    // For simplicity, we'll create individual paragraphs for each list item
    // A more complete implementation would handle proper list structures
    const line = lines[startIndex];
    const match = isNumbered
      ? line.match(/^(\s*)\d+\.\s+(.+)$/)
      : line.match(/^(\s*)[-*+]\s+(.+)$/);

    if (!match) {
      return { element: null, nextIndex: startIndex + 1 };
    }

    const indent = match[1].length;
    const text = match[2];

    // Create a bullet point paragraph
    return {
      element: this.createListItem(text, indent, isNumbered),
      nextIndex: startIndex + 1,
    };
  }

  private static processTable(
    lines: string[],
    startIndex: number,
  ): { element: docs_v1.Schema$StructuralElement | null; nextIndex: number } {
    const tableLines = [];
    let i = startIndex;

    // Collect all table lines
    while (i < lines.length && lines[i].includes('|')) {
      tableLines.push(lines[i]);
      i++;
    }

    // Skip header separator line (if present)
    const filteredLines = tableLines.filter((line) => !line.match(/^\s*\|[\s\-|]+\|\s*$/));

    return {
      element: this.createTable(filteredLines),
      nextIndex: i,
    };
  }

  private static createParagraph(text: string): docs_v1.Schema$StructuralElement {
    const elements = this.parseInlineFormatting(text);

    return {
      paragraph: {
        elements,
        paragraphStyle: {},
      },
    };
  }

  private static createHeader(text: string, level: number): docs_v1.Schema$StructuralElement {
    const elements = this.parseInlineFormatting(text);

    const namedStyleTypes = [
      'HEADING_1',
      'HEADING_2',
      'HEADING_3',
      'HEADING_4',
      'HEADING_5',
      'HEADING_6',
    ];

    return {
      paragraph: {
        elements,
        paragraphStyle: {
          namedStyleType: namedStyleTypes[level - 1] || 'HEADING_6',
        },
      },
    };
  }

  private static createListItem(
    text: string,
    indent: number,
    isNumbered: boolean,
  ): docs_v1.Schema$StructuralElement {
    const elements = this.parseInlineFormatting(text);

    return {
      paragraph: {
        elements,
        bullet: {
          listId: 'list-id', // This would need to be managed properly
          nestingLevel: Math.floor(indent / 2),
        },
        paragraphStyle: {},
      },
    };
  }

  private static createTable(tableLines: string[]): docs_v1.Schema$StructuralElement {
    const rows: docs_v1.Schema$TableRow[] = [];

    for (const line of tableLines) {
      const cells = line.split('|').slice(1, -1); // Remove empty first/last elements
      const tableCells: docs_v1.Schema$TableCell[] = cells.map((cellText) => ({
        content: [
          {
            paragraph: {
              elements: this.parseInlineFormatting(cellText.trim()),
              paragraphStyle: {},
            },
          },
        ],
      }));

      rows.push({ tableCells });
    }

    return {
      table: {
        tableRows: rows,
        columns: rows[0]?.tableCells?.length || 0,
      },
    };
  }

  private static parseInlineFormatting(text: string): docs_v1.Schema$ParagraphElement[] {
    const elements: docs_v1.Schema$ParagraphElement[] = [];

    if (!text.trim()) {
      return [
        {
          textRun: {
            content: text || '\n',
            textStyle: {},
          },
        },
      ];
    }

    // Simple implementation - parse basic formatting
    const currentText = text;
    const startIndex = 0;

    // For now, create a simple text run - a more complete implementation would parse:
    // - **bold**
    // - *italic*
    // - `code`
    // - [links](url)
    // - ~~strikethrough~~

    const segments = this.parseBasicFormatting(currentText);

    for (const segment of segments) {
      elements.push({
        textRun: {
          content: segment.text,
          textStyle: segment.style,
        },
      });
    }

    return elements;
  }

  private static parseBasicFormatting(
    text: string,
  ): { text: string; style: docs_v1.Schema$TextStyle }[] {
    const segments: { text: string; style: docs_v1.Schema$TextStyle }[] = [];

    // Simple regex-based parsing
    const patterns = [
      { regex: /\*\*\*(.*?)\*\*\*/g, style: { bold: true, italic: true } },
      { regex: /\*\*(.*?)\*\*/g, style: { bold: true } },
      { regex: /\*(.*?)\*/g, style: { italic: true } },
      {
        regex: /`(.*?)`/g,
        style: {
          weightedFontFamily: { fontFamily: 'Courier New' },
        },
      },
      { regex: /~~(.*?)~~/g, style: { strikethrough: true } },
      { regex: /\[([^\]]+)\]\(([^)]+)\)/g, style: { link: { url: '$2' } } },
    ];

    const processedText = text;
    const replacements: {
      start: number;
      end: number;
      replacement: string;
      style: docs_v1.Schema$TextStyle;
    }[] = [];

    // Find all formatting patterns
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        replacements.push({
          start: match.index,
          end: match.index + match[0].length,
          replacement: match[1],
          style: pattern.style,
        });
      }
    }

    // Sort by position
    replacements.sort((a, b) => a.start - b.start);

    // If no formatting found, return plain text
    if (replacements.length === 0) {
      return [{ text, style: {} }];
    }

    let lastEnd = 0;

    for (const replacement of replacements) {
      // Add plain text before this formatting
      if (replacement.start > lastEnd) {
        segments.push({
          text: text.substring(lastEnd, replacement.start),
          style: {},
        });
      }

      // Add formatted text
      segments.push({
        text: replacement.replacement,
        style: replacement.style,
      });

      lastEnd = replacement.end;
    }

    // Add remaining plain text
    if (lastEnd < text.length) {
      segments.push({
        text: text.substring(lastEnd),
        style: {},
      });
    }

    return segments;
  }
}
