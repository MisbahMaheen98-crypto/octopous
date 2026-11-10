export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export type ProjectMode = 'INDIVIDUAL' | 'COLLABORATIVE';

export type ProjectRole = 'OWNER' | 'DEVELOPER' | 'VIEWER';

export type ProjectColor =
  | 'BLUE'
  | 'PURPLE'
  | 'PINK'
  | 'RED'
  | 'ORANGE'
  | 'YELLOW'
  | 'GREEN'
  | 'TEAL'
  | 'CYAN'
  | 'GRAY';

export type PublicProject = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  color: ProjectColor | null;
  status: ProjectStatus;
  mode: ProjectMode;
  memberCount?: number;
  userRole?: ProjectRole;
  gitRemoteUrl?: string | null;
  gitBranch?: string | null;
  gitSyncStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type PublicMember = {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
};

export type PublicActivity = {
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
