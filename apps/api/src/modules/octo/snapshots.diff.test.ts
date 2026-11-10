import { describe, it, expect } from 'vitest';
import { matchIntent } from './octo.intents.js';
import { SnapshotDiffService } from './snapshots/SnapshotDiffService.js';
import { SnapshotContextReader } from './snapshots/SnapshotContextReader.js';

describe('Snapshot Comparison & Diff Capabilities', () => {
  it('correctly matches COMPARE_SNAPSHOTS intent for diff queries', () => {
    const queries = [
      'Compare snapshot-1 with snapshot-2',
      'What changed between my snapshots?',
      'Show me the diff between snapshot A and B',
      'Explain what changed between my last two snapshots.',
    ];

    for (const q of queries) {
      const match = matchIntent(q);
      expect(match.intent).toBe('COMPARE_SNAPSHOTS');
      expect(match.confidence).toBeGreaterThan(0.7);
    }
  });

  it('initializes SnapshotDiffService and SnapshotContextReader cleanly', () => {
    const diffService = new SnapshotDiffService();
    const reader = new SnapshotContextReader();

    expect(diffService).toBeDefined();
    expect(reader).toBeDefined();
  });
});
