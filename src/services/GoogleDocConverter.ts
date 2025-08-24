import { docs_v1 } from '@googleapis/docs';

export class GoogleDocConverter {
  /**
   * Converts a Google Docs document to Markdown
   */
  static convertToMarkdown(document: docs_v1.Schema$Document): string {
    if (!document.body?.content) {
      return '';
    }

    const markdownLines: string[] = [];
    const listState = new ListTracker();

    for (const structuralElement of document.body.content) {
      const markdown = this.convertStructuralElement(structuralElement, listState, document);
      if (markdown) {
        markdownLines.push(markdown);
      }
    }

    let result = markdownLines.join('\n').trim();

    // Handle multiple consecutive newlines by converting them to <br> tags
    result = this.handleMultipleNewlines(result);

    return result;
  }

  /**
   * Handles multiple consecutive newlines by converting them to <br> tags
   */
  private static handleMultipleNewlines(text: string): string {
    // Replace 3 or more consecutive newlines with <br> tags
    // Keep double newlines as they represent paragraph breaks
    return text.replace(/\n{3,}/g, (match) => {
      const count = match.length - 2; // Keep 2 newlines, convert rest to <br>
      return '\n\n' + '<br>'.repeat(count);
    });
  }

  /**
   * Detects and converts tags to [[tag]] syntax
   */
  private static convertTags(text: string): string {
    // Convert various tag patterns to [[tag]] syntax

    // Convert #hashtags to [[hashtags]]
    text = text.replace(/#([a-zA-Z0-9_-]+)/g, '[[$1]]');

    // Convert @mentions to [[mentions]]
    text = text.replace(/@([a-zA-Z0-9_-]+)/g, '[[$1]]');

    // Convert date patterns (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, etc.)
    text = text.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, '[[$1]]'); // 2024-01-15
    text = text.replace(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g, '[[$1]]'); // 1/15/2024 or 15/1/2024
    text = text.replace(/\b(\d{1,2}-\d{1,2}-\d{4})\b/g, '[[$1]]'); // 1-15-2024 or 15-1-2024

    // Convert common date formats like "January 15, 2024"
    text = text.replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      (match) => {
        return `[[${match}]]`;
      },
    );

    // Convert abbreviated month formats like "Jan 15, 2024"
    text = text.replace(
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi,
      (match) => {
        return `[[${match}]]`;
      },
    );

    return text;
  }

  private static convertStructuralElement(
    element: docs_v1.Schema$StructuralElement,
    listState: ListTracker,
    document: docs_v1.Schema$Document,
  ): string {
    if (element.paragraph) {
      return this.convertParagraph(element.paragraph, listState, document);
    } else if (element.table) {
      return this.convertTable(element.table, document);
    } else if (element.tableOfContents) {
      return '\n[TOC]\n'; // Simple table of contents placeholder
    } else if (element.sectionBreak) {
      return '\n---\n'; // Horizontal rule for section breaks
    }

    return '';
  }

  private static convertParagraph(
    paragraph: docs_v1.Schema$Paragraph,
    listState: ListTracker,
    document: docs_v1.Schema$Document,
  ): string {
    if (!paragraph.elements) {
      return '';
    }

    // Handle lists
    if (paragraph.bullet) {
      return this.convertListItem(paragraph, listState, document);
    }

    // Reset list state if this is not a list item
    listState.reset();

    // Convert paragraph content
    let content = '';
    for (const element of paragraph.elements) {
      content += this.convertParagraphElement(element, document);
    }

    content = content.trim();
    if (!content) {
      return '';
    }

    // Convert tags in the content
    content = this.convertTags(content);

    // Apply paragraph-level formatting
    // Append a trailing newline so that when top-level lines are joined with "\n",
    // paragraphs are separated by a blank line (two newlines total)
    return this.applyParagraphStyle(content, paragraph.paragraphStyle) + '\n';
  }

  private static convertListItem(
    paragraph: docs_v1.Schema$Paragraph,
    listState: ListTracker,
    document: docs_v1.Schema$Document,
  ): string {
    if (!paragraph.elements || !paragraph.bullet) {
      return '';
    }

    const nestingLevel = paragraph.bullet.nestingLevel || 0;
    const listId = paragraph.bullet.listId;

    // Get list properties
    const list = listId && document.lists ? document.lists[listId] : null;
    const listProperties = list?.listProperties;
    const nestingLevelProps = listProperties?.nestingLevels?.[nestingLevel];

    // Determine bullet style
    const isNumbered = this.isNumberedList(nestingLevelProps);
    const indent = '  '.repeat(nestingLevel);

    let content = '';
    for (const element of paragraph.elements) {
      content += this.convertParagraphElement(element, document);
    }

    content = content.trim();
    if (!content) {
      return '';
    }

    // Convert tags in the content
    content = this.convertTags(content);

    if (isNumbered) {
      const number = listState.getNextNumber(nestingLevel, listId || '');
      return `${indent}${number}. ${content}`;
    } else {
      return `${indent}- ${content}`;
    }
  }

  private static convertParagraphElement(
    element: docs_v1.Schema$ParagraphElement,
    document: docs_v1.Schema$Document,
  ): string {
    if (element.textRun) {
      return this.convertTextRun(element.textRun);
    } else if (element.inlineObjectElement) {
      return this.convertInlineObject(element.inlineObjectElement, document);
    } else if (element.pageBreak) {
      return '\n\n---\n\n'; // Page break as horizontal rule
    } else if (element.footnoteReference) {
      return `[^${element.footnoteReference.footnoteId}]`;
    } else if (element.horizontalRule) {
      return '\n\n---\n\n';
    } else if (element.equation) {
      return '`[Math Equation]`'; // Placeholder for equations
    }

    return '';
  }

  private static convertTextRun(textRun: docs_v1.Schema$TextRun): string {
    if (!textRun.content) {
      return '';
    }

    const fullText = textRun.content;
    const style = textRun.textStyle;

    // Tag-like formatting hint
    let processed = fullText;
    if (style && this.isTagFormatting(style)) {
      processed = this.convertTags(processed);
    }

    if (!style) {
      return processed;
    }

    const lines = processed.split('\n');

    const applyInlineStyles = (segment: string): string => {
      if (segment.length === 0) return segment;
      let s = segment;

      // Escape a trailing asterisk when using single-style emphasis
      // to avoid it merging with the closing marker
      const endsWithUnescapedStar = (txt: string) =>
        txt.endsWith('*') && (txt.length < 2 || txt.at(-2) !== '\\');

      if (style.bold && !style.italic && endsWithUnescapedStar(s)) {
        s = s.slice(0, -1) + '\\*';
      }
      if (style.italic && !style.bold && endsWithUnescapedStar(s)) {
        s = s.slice(0, -1) + '\\*';
      }

      // Combine bold+italic as triple-asterisk emphasis
      if (style.bold && style.italic) {
        s = `***${s}***`;
      } else if (style.bold) {
        s = `**${s}**`;
      } else if (style.italic) {
        s = `*${s}*`;
      }
      if (style.underline) {
        s = `<u>${s}</u>`;
      }
      if (style.strikethrough) {
        s = `~~${s}~~`;
      }
      // Code font
      if (
        style.weightedFontFamily?.fontFamily === 'Courier New' ||
        style.weightedFontFamily?.fontFamily === 'Consolas' ||
        style.weightedFontFamily?.fontFamily === 'Monaco'
      ) {
        s = `\`${s}\``;
      }
      // Links last to wrap the entire segment
      if (style.link?.url) {
        s = `[${s}](${style.link.url})`;
      }
      return s;
    };

    // Style each line independently so markers never cross newlines
    const styled = lines.map(applyInlineStyles).join('\n');
    return styled;
  }

  /**
   * Determines if text formatting indicates this should be treated as a tag
   */
  private static isTagFormatting(style: docs_v1.Schema$TextStyle): boolean {
    // Check for highlighting (background color)
    if (style.backgroundColor?.color?.rgbColor) {
      const bg = style.backgroundColor.color.rgbColor;
      // Common highlight colors (yellow, green, blue, etc.)
      if ((bg.red || 0) > 0.8 && (bg.green || 0) > 0.8 && (bg.blue || 0) < 0.3) return true; // Yellow
      if ((bg.red || 0) < 0.3 && (bg.green || 0) > 0.8 && (bg.blue || 0) < 0.3) return true; // Green
      if ((bg.red || 0) < 0.3 && (bg.green || 0) < 0.3 && (bg.blue || 0) > 0.8) return true; // Blue
    }

    // Check for specific text colors that might indicate tags
    if (style.foregroundColor?.color?.rgbColor) {
      const fg = style.foregroundColor.color.rgbColor;
      // Blue or purple text often indicates tags/links
      if ((fg.blue || 0) > 0.6 && (fg.red || 0) < 0.4 && (fg.green || 0) < 0.4) return true;
    }

    return false;
  }

  private static convertTable(
    table: docs_v1.Schema$Table,
    document: docs_v1.Schema$Document,
  ): string {
    if (!table.tableRows) {
      return '';
    }

    const markdownRows: string[] = [];
    let isFirstRow = true;

    for (const row of table.tableRows) {
      if (!row.tableCells) continue;

      const cells: string[] = [];
      for (const cell of row.tableCells) {
        let cellContent = '';
        if (cell.content) {
          const listState = new ListTracker();
          for (const element of cell.content) {
            cellContent += this.convertStructuralElement(element, listState, document);
          }
        }
        // Remove newlines and clean up cell content, but preserve tags
        cellContent = cellContent.replace(/\n/g, ' ').trim();
        cells.push(cellContent || ' ');
      }

      markdownRows.push(`| ${cells.join(' | ')} |`);

      // Add header separator after first row
      if (isFirstRow) {
        const separator = '|' + ' --- |'.repeat(cells.length);
        markdownRows.push(separator);
        isFirstRow = false;
      }
    }

    return markdownRows.length > 0 ? `\n${markdownRows.join('\n')}\n` : '';
  }

  private static convertInlineObject(
    inlineObject: docs_v1.Schema$InlineObjectElement,
    document: docs_v1.Schema$Document,
  ): string {
    if (!inlineObject.inlineObjectId || !document.inlineObjects) {
      return '';
    }

    const objectData = document.inlineObjects[inlineObject.inlineObjectId];
    if (!objectData?.inlineObjectProperties?.embeddedObject) {
      return '';
    }

    const embeddedObject = objectData.inlineObjectProperties.embeddedObject;

    if (embeddedObject.imageProperties) {
      const title = embeddedObject.title || 'Image';
      const contentUri = embeddedObject.imageProperties.contentUri;
      return contentUri ? `![${title}](${contentUri})` : `[${title}]`;
    }

    return '[Embedded Object]';
  }

  private static applyParagraphStyle(
    content: string,
    style?: docs_v1.Schema$ParagraphStyle,
  ): string {
    if (!style) {
      return content;
    }

    // Handle headings
    if (style.namedStyleType) {
      switch (style.namedStyleType) {
        case 'HEADING_1':
          return `# ${content}`;
        case 'HEADING_2':
          return `## ${content}`;
        case 'HEADING_3':
          return `### ${content}`;
        case 'HEADING_4':
          return `#### ${content}`;
        case 'HEADING_5':
          return `##### ${content}`;
        case 'HEADING_6':
          return `###### ${content}`;
        case 'TITLE':
          return `# ${content}`;
        case 'SUBTITLE':
          return `## ${content}`;
      }
    }

    // Handle alignment (using HTML for non-standard alignments)
    if (style.alignment && style.alignment !== 'START') {
      const alignmentMap: { [key: string]: string } = {
        CENTER: 'center',
        END: 'right',
        JUSTIFIED: 'justify',
      };
      const alignment = alignmentMap[style.alignment];
      if (alignment) {
        return `<div align="${alignment}">${content}</div>`;
      }
    }

    return content;
  }

  private static isNumberedList(nestingLevel?: docs_v1.Schema$NestingLevel): boolean {
    if (!nestingLevel?.glyphType) {
      return false;
    }

    const numberedTypes = [
      'DECIMAL',
      'DECIMAL_NESTED',
      'UPPER_ALPHA',
      'ALPHA',
      'UPPER_ROMAN',
      'ROMAN',
      'ZERO_DECIMAL',
    ];

    return numberedTypes.includes(nestingLevel.glyphType);
  }
}

class ListTracker {
  private listCounters: Map<string, Map<number, number>> = new Map();

  getNextNumber(nestingLevel: number, listId: string): number {
    if (!this.listCounters.has(listId)) {
      this.listCounters.set(listId, new Map());
    }

    const listMap = this.listCounters.get(listId)!;

    // Reset deeper levels when a shallower level increments
    for (const [level] of listMap) {
      if (level > nestingLevel) {
        listMap.delete(level);
      }
    }

    const current = listMap.get(nestingLevel) || 0;
    const next = current + 1;
    listMap.set(nestingLevel, next);

    return next;
  }

  reset(): void {
    this.listCounters.clear();
  }
}
