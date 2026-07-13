import React from 'react';
import type { FuseResultMatch } from 'fuse.js';
import { cn } from '@/lib/utils';

type MatchIndices = ReadonlyArray<readonly [number, number]>;

interface HighlightMatchProps {
  text: string;
  indices?: MatchIndices;
  className?: string;
  highlightClassName?: string;
}

/**
 * Component to highlight matched portions of text from Fuse.js search results
 * 
 * @param text - The original text to display
 * @param indices - Array of [start, end] tuples indicating matched character ranges
 * @param className - Additional classes for the container span
 * @param highlightClassName - Classes for the highlighted portions
 */
export function HighlightMatch({
  text,
  indices,
  className,
  highlightClassName = 'bg-primary/20 text-primary font-medium rounded px-0.5',
}: HighlightMatchProps) {
  if (!indices || indices.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Sort indices by start position
  const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);
  
  // Merge overlapping indices
  const mergedIndices: [number, number][] = [];
  for (const [start, end] of sortedIndices) {
    if (mergedIndices.length === 0) {
      mergedIndices.push([start, end]);
    } else {
      const last = mergedIndices[mergedIndices.length - 1];
      if (start <= last[1] + 1) {
        last[1] = Math.max(last[1], end);
      } else {
        mergedIndices.push([start, end]);
      }
    }
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  mergedIndices.forEach(([start, end], i) => {
    // Add non-highlighted text before this match
    if (start > lastIndex) {
      parts.push(
        <span key={`text-${i}`}>
          {text.slice(lastIndex, start)}
        </span>
      );
    }
    
    // Add highlighted match
    parts.push(
      <mark
        key={`match-${i}`}
        className={cn('bg-transparent', highlightClassName)}
      >
        {text.slice(start, end + 1)}
      </mark>
    );
    
    lastIndex = end + 1;
  });

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(
      <span key="text-end">
        {text.slice(lastIndex)}
      </span>
    );
  }

  return <span className={className}>{parts}</span>;
}

/**
 * Helper function to extract indices for a specific key from Fuse.js matches
 */
export function getMatchIndices(
  matches: readonly FuseResultMatch[] | undefined,
  key: string
): MatchIndices | undefined {
  if (!matches) return undefined;
  const match = matches.find(m => m.key === key);
  return match?.indices;
}

/**
 * Higher-order component that wraps text with highlighting based on search query
 */
export function HighlightText({
  text,
  matches,
  matchKey,
  className,
  highlightClassName,
}: {
  text: string;
  matches?: readonly FuseResultMatch[];
  matchKey: string;
  className?: string;
  highlightClassName?: string;
}) {
  const indices = getMatchIndices(matches, matchKey);
  
  return (
    <HighlightMatch
      text={text}
      indices={indices}
      className={className}
      highlightClassName={highlightClassName}
    />
  );
}
