import React, { useState } from 'react';
import type { RecoveryRecommendation } from '../../lib/octo/octo-client';

interface RecoveryCardProps {
  recommendation: RecoveryRecommendation;
  onRestoreApproved?: (recommendation: RecoveryRecommendation) => void;
}

export const RecoveryCard: React.FC<RecoveryCardProps> = ({
  recommendation,
  onRestoreApproved,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const handleConfirm = () => {
    setIsApproved(true);
    setIsConfirming(false);
    if (onRestoreApproved) {
      onRestoreApproved(recommendation);
    }
  };

  return (
    <div className="octo-recovery-card">
      <div className="octo-recovery-header">
        <div className="octo-recovery-tag">🛡️ AI-Guided Recovery Plan</div>
        <div className="octo-recovery-confidence">
          Confidence: {Math.round(recommendation.confidence * 100)}%
        </div>
      </div>

      <div className="octo-recovery-body">
        <div className="octo-recovery-section">
          <div className="octo-recovery-label">Root Cause Identified</div>
          <p className="octo-recovery-text">{recommendation.rootCause}</p>
        </div>

        <div className="octo-recovery-section">
          <div className="octo-recovery-label">Recommended Strategy</div>
          <p className="octo-recovery-text">{recommendation.recommendedAction}</p>
          <p className="octo-recovery-subtext">{recommendation.strategySummary}</p>
        </div>

        <div className="octo-recovery-grid">
          <div className="octo-recovery-meta-item">
            <span className="octo-recovery-meta-label">Target Snapshot</span>
            <span className="octo-recovery-meta-val font-mono">{recommendation.targetSnapshotId}</span>
          </div>
          <div className="octo-recovery-meta-item">
            <span className="octo-recovery-meta-label">Snapshot Date</span>
            <span className="octo-recovery-meta-val">{recommendation.targetSnapshotDate}</span>
          </div>
        </div>

        {recommendation.affectedFiles.length > 0 && (
          <div className="octo-recovery-section">
            <div className="octo-recovery-label">Affected Files ({recommendation.affectedFiles.length})</div>
            <div className="octo-recovery-files">
              {recommendation.affectedFiles.map((file, idx) => (
                <span key={idx} className="octo-recovery-file-badge">
                  📄 {file}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="octo-recovery-safety">
          <div className="octo-safety-item">
            <span className="octo-safety-check">✓</span>
            <span>Pre-Restoration Backup: Automatic safeguard before any file update</span>
          </div>
          {recommendation.safetyCheck.uncommittedWarning && (
            <div className="octo-safety-warning">
              ⚠️ You have uncommitted workspace changes. A snapshot safety tag will be saved.
            </div>
          )}
        </div>
      </div>

      <div className="octo-recovery-actions">
        {isApproved ? (
          <div className="octo-recovery-success">
            ✓ Restoration approved. OCTOPUS restoration workflow dispatched.
          </div>
        ) : isConfirming ? (
          <div className="octo-confirm-box">
            <p className="octo-confirm-warning">
              Restore workspace to snapshot <code>{recommendation.targetSnapshotId}</code>? This requires your explicit authorization.
            </p>
            <div className="octo-confirm-buttons">
              <button
                type="button"
                onClick={handleConfirm}
                className="octo-btn-confirm"
              >
                Confirm &amp; Restore
              </button>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="octo-btn-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            className="octo-btn-approve"
          >
            Review &amp; Approve Restoration
          </button>
        )}
      </div>
    </div>
  );
};
