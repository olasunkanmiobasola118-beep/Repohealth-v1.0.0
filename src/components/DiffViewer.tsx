import { useState } from 'react';
import { parseStructuredDiff } from '../lib/diff';

interface DiffViewerProps {
  filePath: string;
  originalCode: string;
  proposedCode: string;
}

export function DiffViewer({ filePath, originalCode, proposedCode }: DiffViewerProps) {
  const [mode, setMode] = useState<'unified' | 'split'>('unified');
  const lines = parseStructuredDiff(filePath, originalCode, proposedCode);

  const origLines = originalCode.split('\n');
  const propLines = proposedCode.split('\n');

  return (
    <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden bg-white dark:bg-[#101014]">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34]">
        <span className="font-mono text-xs text-[#17171C] dark:text-[#F4F4F6] truncate">{filePath}</span>
        <div className="flex items-center gap-1 p-0.5 bg-[#E8E8ED]/60 dark:bg-[#2B2B34] rounded-md shrink-0">
          <button
            type="button"
            onClick={() => setMode('unified')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              mode === 'unified'
                ? 'bg-white dark:bg-[#101014] text-[#17171C] dark:text-[#F4F4F6]'
                : 'text-[#777783] dark:text-[#9898A6] hover:text-[#17171C] dark:hover:text-white'
            }`}
          >
            Unified
          </button>
          <button
            type="button"
            onClick={() => setMode('split')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              mode === 'split'
                ? 'bg-white dark:bg-[#101014] text-[#17171C] dark:text-[#F4F4F6]'
                : 'text-[#777783] dark:text-[#9898A6] hover:text-[#17171C] dark:hover:text-white'
            }`}
          >
            Side-by-Side
          </button>
        </div>
      </div>

      {mode === 'unified' ? (
        <div className="overflow-x-auto font-mono text-xs leading-6">
          {lines.length === 0 ? (
            <div className="p-4 text-[#777783] dark:text-[#9898A6]">No textual changes in this patch.</div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line, idx) => {
                  const rowCls =
                    line.type === 'added'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                      : line.type === 'removed'
                        ? 'bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200'
                        : line.type === 'header'
                          ? 'bg-[#F8F8FA] dark:bg-[#19191F] text-[#7656D6] dark:text-[#A58DF5]'
                          : 'text-[#17171C] dark:text-[#D4D4DC]';

                  const prefix =
                    line.type === 'added' ? '+' : line.type === 'removed' ? '-' : line.type === 'header' ? '' : ' ';

                  return (
                    <tr key={idx} className={rowCls}>
                      <td className="w-10 select-none text-right pr-2 text-[11px] text-[#777783] dark:text-[#6E6E7D] tabular-nums border-r border-[#E8E8ED] dark:border-[#2B2B34]">
                        {line.oldLineNumber ?? ''}
                      </td>
                      <td className="w-10 select-none text-right pr-2 text-[11px] text-[#777783] dark:text-[#6E6E7D] tabular-nums border-r border-[#E8E8ED] dark:border-[#2B2B34]">
                        {line.newLineNumber ?? ''}
                      </td>
                      <td className="px-3 whitespace-pre">
                        <span className="select-none mr-2 opacity-70">{prefix}</span>
                        {line.content}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E8E8ED] dark:divide-[#2B2B34] font-mono text-xs leading-6">
          <div className="overflow-x-auto">
            <div className="px-3 py-1.5 text-[11px] font-sans font-medium text-[#777783] dark:text-[#9898A6] border-b border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA]/60 dark:bg-[#19191F]/60">
              Original Source
            </div>
            <pre className="p-3 text-[#17171C] dark:text-[#D4D4DC]">
              {origLines.map((l, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-7 text-right text-[#777783] select-none tabular-nums">{i + 1}</span>
                  <span className="whitespace-pre">{l}</span>
                </div>
              ))}
            </pre>
          </div>
          <div className="overflow-x-auto">
            <div className="px-3 py-1.5 text-[11px] font-sans font-medium text-[#777783] dark:text-[#9898A6] border-b border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA]/60 dark:bg-[#19191F]/60">
              Proposed Fix
            </div>
            <pre className="p-3 text-[#17171C] dark:text-[#D4D4DC]">
              {propLines.map((l, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-7 text-right text-[#777783] select-none tabular-nums">{i + 1}</span>
                  <span className="whitespace-pre">{l}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
