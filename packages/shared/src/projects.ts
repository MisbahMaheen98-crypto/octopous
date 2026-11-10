export const PROJECT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_MODES = ['INDIVIDUAL', 'COLLABORATIVE'] as const;
export type ProjectMode = (typeof PROJECT_MODES)[number];

export const PROJECT_ROLES = ['OWNER', 'DEVELOPER', 'VIEWER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const INVITATION_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'REVOKED'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const PROJECT_COLORS = [
  'BLUE',
  'PURPLE',
  'PINK',
  'RED',
  'ORANGE',
  'YELLOW',
  'GREEN',
  'TEAL',
  'CYAN',
  'GRAY',
] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

export type ProjectMemberUser = {
  id: string;
  username: string;
  email: string;
};

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  user: ProjectMemberUser;
};

export type ProjectInvitation = {
  id: string;
  projectId: string;
  inviterId: string;
  inviteeId: string;
  role: ProjectRole;
  status: InvitationStatus;
  createdAt: string;
  respondedAt: string | null;
  invitee: ProjectMemberUser;
};

export type ProjectActivityItem = {
  id: string;
  projectId: string;
  userId: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id?: string;
    username: string;
    email: string;
  };
};

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  color: ProjectColor | null;
  status: ProjectStatus;
  mode?: ProjectMode;
  memberCount?: number;
  userRole?: ProjectRole;
  gitRemoteUrl?: string | null;
  gitBranch?: string | null;
  gitSyncStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type ProjectListResponse = {
  projects: Project[];
};
