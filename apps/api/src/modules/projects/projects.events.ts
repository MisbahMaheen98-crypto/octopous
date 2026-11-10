import { EventEmitter } from 'node:events';

export type ProjectEventPayload = {
  type:
    | 'SNAPSHOT_CREATED'
    | 'FILE_CHANGED'
    | 'MEMBER_ADDED'
    | 'MEMBER_REMOVED'
    | 'ROLE_UPDATED'
    | 'MODE_UPDATED'
    | 'RESTORE_APPROVED'
    | 'GIT_SYNC_UPDATED';
  projectId: string;
  userId: string;
  user?: { username: string; email: string };
  data?: Record<string, unknown>;
  timestamp: string;
};

class ProjectEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
  }

  public publish(projectId: string, event: Omit<ProjectEventPayload, 'projectId' | 'timestamp'>) {
    const payload: ProjectEventPayload = {
      ...event,
      projectId,
      timestamp: new Date().toISOString(),
    };
    this.emit(`project:${projectId}`, payload);
  }

  public subscribe(projectId: string, listener: (event: ProjectEventPayload) => void) {
    const channel = `project:${projectId}`;
    this.on(channel, listener);
    return () => {
      this.off(channel, listener);
    };
  }
}

export const projectEventBus = new ProjectEventBus();
