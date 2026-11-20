import { createTwoFilesPatch, structuredPatch } from 'diff';

export interface DiffLine {
  type: 'context' | 'added' | 'removed' | 'header';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}

export function buildUnifiedDiff(
  filePath: string,
  originalCode: string,
  proposedCode: string
): string {
  return createTwoFilesPatch(
    `a/${filePath}`,
    `b/${filePath}`,
    originalCode,
    proposedCode,
    'original',
    'proposed',
    { context: 3 }
  );
}

export function parseStructuredDiff(
  filePath: string,
  originalCode: string,
  proposedCode: string
): DiffLine[] {
  const patch = structuredPatch(
    `a/${filePath}`,
    `b/${filePath}`,
    originalCode,
    proposedCode,
    '',
    '',
    { context: 3 }
  );

  const lines: DiffLine[] = [];
  for (const hunk of patch.hunks) {
    lines.push({
      type: 'header',
      oldLineNumber: null,
      newLineNumber: null,
      content: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
    });

    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;

    for (const raw of hunk.lines) {
      if (raw.startsWith('+')) {
        lines.push({
          type: 'added',
          oldLineNumber: null,
          newLineNumber: newLine++,
          content: raw.slice(1),
        });
      } else if (raw.startsWith('-')) {
        lines.push({
          type: 'removed',
          oldLineNumber: oldLine++,
          newLineNumber: null,
          content: raw.slice(1),
        });
      } else {
        lines.push({
          type: 'context',
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
          content: raw.startsWith(' ') ? raw.slice(1) : raw,
        });
      }
    }
  }
  return lines;
}
