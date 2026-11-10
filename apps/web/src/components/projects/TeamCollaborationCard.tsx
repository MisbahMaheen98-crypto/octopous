import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import {
  listProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  switchProjectMode,
  listProjectActivities,
  updateProjectGit,
  searchUsers,
  subscribeProjectEvents,
} from '../../lib/projects/projects-client';
import type {
  Project,
  ProjectMember,
  ProjectActivityItem,
  ProjectMode,
  ProjectRole,
} from '../../lib/projects/types';

interface TeamCollaborationCardProps {
  project: Project;
  onProjectUpdated: (project: Project) => void;
  accentClassName?: string;
}

export function TeamCollaborationCard({
  project,
  onProjectUpdated,
  accentClassName,
}: TeamCollaborationCardProps) {
  const isOwner = project.userRole === 'OWNER';
  const isCollaborative = project.mode === 'COLLABORATIVE';

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [activities, setActivities] = useState<ProjectActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User search & Add Member state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; email: string }>>([]);
  const [selectedRole, setSelectedRole] = useState<'DEVELOPER' | 'VIEWER'>('DEVELOPER');
  const [isAdding, setIsAdding] = useState(false);

  // Remove confirmation modal
  const [pendingRemoveMember, setPendingRemoveMember] = useState<ProjectMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Git settings modal
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [gitRemoteUrl, setGitRemoteUrl] = useState(project.gitRemoteUrl ?? '');
  const [gitBranch, setGitBranch] = useState(project.gitBranch ?? 'main');
  const [gitSyncStatus, setGitSyncStatus] = useState(project.gitSyncStatus ?? 'SYNCED');
  const [isSavingGit, setIsSavingGit] = useState(false);

  // Real-time live status
  const [isLiveConnected, setIsLiveConnected] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    const [membersRes, activitiesRes] = await Promise.all([
      listProjectMembers(project.id),
      listProjectActivities(project.id),
    ]);

    setIsLoading(false);

    if (membersRes.success) {
      setMembers(membersRes.data.members);
    } else {
      setError(membersRes.error.message);
    }

    if (activitiesRes.success) {
      setActivities(activitiesRes.data.activities);
    }
  };

  useEffect(() => {
    void loadData();

    // Subscribe to SSE real-time project updates
    const unsubscribe = subscribeProjectEvents(project.id, () => {
      setIsLiveConnected(true);
      void listProjectMembers(project.id).then((res) => {
        if (res.success) setMembers(res.data.members);
      });
      void listProjectActivities(project.id).then((res) => {
        if (res.success) setActivities(res.data.activities);
      });
    });

    return () => {
      unsubscribe();
    };
  }, [project.id]);

  // Debounced search for registered users
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const res = await searchUsers(searchQuery);
      if (res.success) {
        setSearchResults(res.data.users);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleModeSwitch = async (newMode: ProjectMode) => {
    setError(null);
    setSuccess(null);
    const res = await switchProjectMode(project.id, newMode);
    if (!res.success) {
      setError(res.error.message);
      return;
    }
    setSuccess(`Project switched to ${newMode} mode.`);
    onProjectUpdated(res.data.project);
    void loadData();
  };

  const handleAddMember = async (usernameOrEmail: string) => {
    setError(null);
    setSuccess(null);
    setIsAdding(true);

    const res = await addProjectMember(project.id, {
      emailOrUsername: usernameOrEmail,
      role: selectedRole,
    });

    setIsAdding(false);

    if (!res.success) {
      setError(res.error.message);
      return;
    }

    setSuccess(`Added @${res.data.member.user.username} as ${selectedRole}.`);
    setSearchQuery('');
    setSearchResults([]);
    void loadData();
  };

  const handleRoleChange = async (memberId: string, newRole: 'DEVELOPER' | 'VIEWER') => {
    setError(null);
    setSuccess(null);

    const res = await updateProjectMemberRole(project.id, memberId, newRole);
    if (!res.success) {
      setError(res.error.message);
      return;
    }

    setSuccess(`Updated @${res.data.member.user.username}'s role to ${newRole}.`);
    void loadData();
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemoveMember) return;
    setError(null);
    setSuccess(null);
    setIsRemoving(true);

    const res = await removeProjectMember(project.id, pendingRemoveMember.userId);
    setIsRemoving(false);

    if (!res.success) {
      setError(res.error.message);
      return;
    }

    setSuccess(`Revoked project access for @${pendingRemoveMember.user.username}.`);
    setPendingRemoveMember(null);
    void loadData();
  };

  const handleSaveGit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGit(true);
    setError(null);

    const res = await updateProjectGit(project.id, {
      gitRemoteUrl,
      gitBranch,
      gitSyncStatus,
    });

    setIsSavingGit(false);

    if (!res.success) {
      setError(res.error.message);
      return;
    }

    setSuccess('Git synchronization settings updated.');
    setIsGitModalOpen(false);
    onProjectUpdated(res.data.project);
    void loadData();
  };

  return (
    <Card className={accentClassName}>
      {/* Header with Mode Toggle & Live Badge */}
      <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 className="card-title" style={{ margin: 0 }}>
              {isCollaborative ? '👥 Team Collaboration' : '🔒 Individual Workspace'}
            </h4>
            <Badge tone={isCollaborative ? 'ok' : 'neutral'}>
              {project.mode ?? 'INDIVIDUAL'}
            </Badge>
            <span
              style={{
                fontSize: '11px',
                color: isLiveConnected ? '#10b981' : '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ● {isLiveConnected ? 'Live Sync Active' : 'Disconnected'}
            </span>
          </div>
          <p className="muted body-sm" style={{ marginTop: '4px' }}>
            {isCollaborative
              ? 'Multi-user project active. All approved members share snapshots, timeline, and real-time updates.'
              : 'Private project. Only the Admin has access. Enable Team Collaboration to invite teammates.'}
          </p>
        </div>

        {/* Admin Mode Switcher */}
        {isOwner && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {isCollaborative ? (
              <Button
                variant="ghost"
                type="button"
                onClick={() => handleModeSwitch('INDIVIDUAL')}
              >
                Switch to Individual
              </Button>
            ) : (
              <Button
                variant="primary"
                type="button"
                onClick={() => handleModeSwitch('COLLABORATIVE')}
              >
                Enable Team Collaboration
              </Button>
            )}
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsGitModalOpen(true)}
            >
              ⚙ Git Sync
            </Button>
          </div>
        )}
      </div>

      {error && <p className="form-error" style={{ marginTop: '12px' }}>{error}</p>}
      {success && <p style={{ color: '#10b981', fontSize: '13px', marginTop: '12px' }}>{success}</p>}

      {/* Git Sync Information Bar */}
      {project.gitRemoteUrl && (
        <div
          style={{
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ fontWeight: 600 }}>🔗 Git Remote:</span>
            <code style={{ fontSize: '12px' }}>{project.gitRemoteUrl}</code>
            <span className="muted">({project.gitBranch ?? 'main'})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px' }} className="muted">Status:</span>
            <Badge
              tone={
                project.gitSyncStatus === 'SYNCED'
                  ? 'ok'
                  : project.gitSyncStatus === 'CONFLICT_DETECTED'
                  ? 'warn'
                  : 'neutral'
              }
            >
              {project.gitSyncStatus ?? 'SYNCED'}
            </Badge>
          </div>
        </div>
      )}

      {/* Members Management (Visible if Collaborative Mode or Admin) */}
      {isCollaborative && (
        <div style={{ marginTop: '24px' }}>
          <div className="row-between" style={{ marginBottom: '12px' }}>
            <h5 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              Team Members ({members.length})
            </h5>
            <span className="muted meta-sm">Admin retains full project control</span>
          </div>

          {/* Admin Member Search & Add Box */}
          {isOwner && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed var(--border-subtle, rgba(255, 255, 255, 0.1))',
              }}
            >
              <label className="eyebrow" style={{ display: 'block', marginBottom: '6px' }}>
                Search Registered Users to Add
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                  <Input
                    placeholder="Search by username or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {/* Autocomplete dropdown */}
                  {searchResults.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        backgroundColor: 'var(--surface-dropdown, #18181b)',
                        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                        borderRadius: '6px',
                        marginTop: '4px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                      }}
                    >
                      {searchResults.map((u) => (
                        <div
                          key={u.id}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                          }}
                          onClick={() => handleAddMember(u.username)}
                        >
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>@{u.username}</span>
                            <span className="muted meta-sm" style={{ marginLeft: '8px' }}>{u.email}</span>
                          </div>
                          <Button variant="ghost" type="button">Select</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <select
                  style={{
                    backgroundColor: 'var(--surface-input, rgba(255, 255, 255, 0.05))',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                    color: 'inherit',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '13px',
                  }}
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'DEVELOPER' | 'VIEWER')}
                >
                  <option value="DEVELOPER">Developer (Full Access & Snapshots)</option>
                  <option value="VIEWER">Viewer (Read Only)</option>
                </select>

                <Button
                  variant="primary"
                  type="button"
                  disabled={!searchQuery.trim() || isAdding}
                  onClick={() => handleAddMember(searchQuery)}
                >
                  {isAdding ? 'Adding...' : 'Add Member'}
                </Button>
              </div>
            </div>
          )}

          {/* Members Table */}
          <div
            style={{
              overflowX: 'auto',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))' }}>
                  <th style={{ padding: '10px 14px' }}>Member</th>
                  <th style={{ padding: '10px 14px' }}>Email</th>
                  <th style={{ padding: '10px 14px' }}>Role</th>
                  <th style={{ padding: '10px 14px' }}>Joined</th>
                  {isOwner && <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const isMemberOwner = member.role === 'OWNER';
                  return (
                    <tr
                      key={member.id}
                      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                        @{member.user.username} {isMemberOwner && <Badge tone="ok">Owner</Badge>}
                      </td>
                      <td style={{ padding: '10px 14px' }} className="muted">
                        {member.user.email}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {isOwner && !isMemberOwner ? (
                          <select
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
                              color: 'inherit',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontSize: '12px',
                            }}
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(member.userId, e.target.value as 'DEVELOPER' | 'VIEWER')
                            }
                          >
                            <option value="DEVELOPER">DEVELOPER</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                        ) : (
                          <Badge tone={isMemberOwner ? 'ok' : 'neutral'}>
                            {member.role}
                          </Badge>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }} className="muted meta-sm">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                      {isOwner && (
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          {!isMemberOwner && (
                            <Button
                              variant="ghost"
                              type="button"
                              onClick={() => setPendingRemoveMember(member)}
                            >
                              Remove
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shared Real-Time Activity Feed */}
      <div style={{ marginTop: '24px' }}>
        <div className="row-between" style={{ marginBottom: '12px' }}>
          <h5 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
            Shared Activity Feed
          </h5>
          <span className="muted meta-sm">Synchronized across all team members</span>
        </div>

        {activities.length === 0 ? (
          <p className="muted body-sm" style={{ fontStyle: 'italic' }}>
            No team activity recorded yet.
          </p>
        ) : (
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
            }}
          >
            {activities.map((act) => (
              <div
                key={act.id}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-accent, #60a5fa)' }}>
                    @{act.user.username}
                  </span>{' '}
                  <span>
                    {act.action === 'SNAPSHOT_CREATED'
                      ? 'captured a new snapshot'
                      : act.action === 'MEMBER_ADDED'
                      ? `added member to the team`
                      : act.action === 'ROLE_UPDATED'
                      ? 'updated member role'
                      : act.action === 'MEMBER_REMOVED'
                      ? 'removed member from team'
                      : act.action === 'MODE_UPDATED'
                      ? 'switched project collaboration mode'
                      : act.action === 'GIT_SYNC_UPDATED'
                      ? 'updated Git synchronization settings'
                      : act.action}
                  </span>
                </div>
                <span className="muted meta-sm">
                  {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoke Member Confirmation Modal */}
      <Modal
        title="Revoke Member Access"
        isOpen={Boolean(pendingRemoveMember)}
      >
        <p className="body-sm">
          Are you sure you want to remove <strong>@{pendingRemoveMember?.user.username}</strong> from{' '}
          <strong>{project.name}</strong>? Their access to snapshots, code, and project context will be
          immediately revoked.
        </p>
        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPendingRemoveMember(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isRemoving}
            style={{ color: '#ef4444' }}
            onClick={handleConfirmRemove}
          >
            {isRemoving ? 'Revoking...' : 'Revoke Access'}
          </Button>
        </div>
      </Modal>

      {/* Git Settings Modal */}
      <Modal
        title="Configure Git Synchronization"
        isOpen={isGitModalOpen}
      >
        <form className="form-stack" onSubmit={handleSaveGit}>
          <label className="eyebrow" htmlFor="git-remote-url">
            Git Remote URL
          </label>
          <Input
            id="git-remote-url"
            placeholder="https://github.com/organization/repo.git"
            value={gitRemoteUrl}
            onChange={(e) => setGitRemoteUrl(e.target.value)}
          />

          <label className="eyebrow" htmlFor="git-branch">
            Target Branch
          </label>
          <Input
            id="git-branch"
            placeholder="main"
            value={gitBranch}
            onChange={(e) => setGitBranch(e.target.value)}
          />

          <label className="eyebrow" htmlFor="git-sync-status">
            Sync Status
          </label>
          <select
            id="git-sync-status"
            style={{
              backgroundColor: 'var(--surface-input, rgba(255, 255, 255, 0.05))',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              color: 'inherit',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '13px',
            }}
            value={gitSyncStatus}
            onChange={(e) => setGitSyncStatus(e.target.value)}
          >
            <option value="SYNCED">SYNCED (Working tree clean)</option>
            <option value="COMMITS_PENDING">COMMITS PENDING (Local changes ready)</option>
            <option value="CONFLICT_DETECTED">CONFLICT DETECTED (Review required)</option>
          </select>

          <p className="muted meta-sm" style={{ marginTop: '8px' }}>
            OCTOPUS tracks remote Git commits and warns before any restore action to prevent accidental overwrites.
          </p>

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsGitModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSavingGit}>
              {isSavingGit ? 'Saving...' : 'Save Git Settings'}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
