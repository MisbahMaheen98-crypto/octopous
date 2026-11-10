import { ConversationManager } from './ConversationManager.js';
import type { ConversationSession, ChatMessage } from './octo.types.js';

export class OctoConversationManager {
  private mgr = ConversationManager.getInstance();

  public listSessions(userId?: string, projectId?: string | null): ConversationSession[] {
    return this.mgr.listSessions(userId, projectId);
  }

  public getSession(id: string): ConversationSession | null {
    return this.mgr.getSession(id);
  }

  public createSession(userId: string, projectId: string | null, title?: string): ConversationSession {
    return this.mgr.createSession(projectId, userId, title);
  }

  public addMessage(sessionId: string, message: ChatMessage): ConversationSession {
    return this.mgr.addMessage(sessionId, message);
  }

  public deleteSession(id: string): boolean {
    return this.mgr.deleteConversation(id);
  }
}
