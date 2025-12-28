"use client";
import React, { useEffect, useRef } from 'react';

export interface TranscriptSegment {
  start: string;
  end: string;
  text: string;
}

const mockSegments: TranscriptSegment[] = [
  { start: '00:05', end: '00:08', text: '这是什么语言的语言?' },
  { start: '00:09', end: '00:12', text: '这是一个示例文本。' },
];

const TranscriptStream: React.FC<{ segments?: TranscriptSegment[] }> = ({ segments = mockSegments }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments]);
  return (
    <div className="h-64 overflow-y-auto bg-white border rounded p-4 flex flex-col gap-2">
      {segments.map((seg, idx) => (
        <div key={idx} className="flex gap-2 items-baseline">
          <span className="font-mono text-xs text-gray-400 min-w-20">[{seg.start} → {seg.end}]</span>
          <span className="text-gray-900">{seg.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default TranscriptStream;
