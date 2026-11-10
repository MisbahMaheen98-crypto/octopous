import { HttpError } from '../../core/errors/http-error.js';
import type { BlueprintStatus } from './snapshots.types.js';

const allowedTransitions: Record<BlueprintStatus, BlueprintStatus[]> = {
  PENDING: ['PROCESSING', 'FAILED', 'PENDING'],
  PROCESSING: ['COMPLETED', 'FAILED', 'PROCESSING'],
  COMPLETED: ['PROCESSING', 'COMPLETED'],
  FAILED: ['PROCESSING', 'FAILED'],
};

export function assertBlueprintTransition(from: BlueprintStatus, to: BlueprintStatus) {
  if (from === to) {
    return;
  }

  if (!allowedTransitions[from]?.includes(to)) {
    throw new HttpError(409, 'BLUEPRINT_INVALID_STATUS_TRANSITION', `Invalid blueprint status transition ${from} -> ${to}`);
  }
}
