import { ConversationSession, ChatMessage } from './octo.types.js';

export class ConversationManager {
  private static instance: ConversationManager;
  private conversations: Map<string, ConversationSession> = new Map();

  private constructor() {
    this.createDefaultConversation('sample-project');
  }

  public static getInstance(): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager();
    }
    return ConversationManager.instance;
  }

  private createDefaultConversation(projectId?: string | null) {
    const id = 'conv-initial';
    const initialSession: ConversationSession = {
      id,
      projectId: projectId || 'sample-project',
      title: 'Initial Project Exploration',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    this.conversations.set(id, initialSession);
  }

  public getConversations(projectId?: string | null): ConversationSession[] {
    const list = Array.from(this.conversations.values()).filter((c) => {
      if (!projectId || projectId === 'all') return true;
      if (projectId === 'none' || projectId === 'general') return !c.projectId;
      return c.projectId === projectId;
    });
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public getConversation(id: string): ConversationSession | null {
    return this.conversations.get(id) || null;
  }

  public createConversation(projectId?: string | null, title?: string): ConversationSession {
    const id = `conv-${Date.now()}`;
    const session: ConversationSession = {
      id,
      projectId: projectId || null,
      title: title || 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    this.conversations.set(id, session);
    return session;
  }

  public addMessage(id: string, message: ChatMessage): ConversationSession {
    let session = this.conversations.get(id);
    if (!session) {
      session = this.createConversation(null, message.content.slice(0, 30));
    }

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();

    // Auto-update title if default
    if (session.messages.length === 1 && message.role === 'user') {
      session.title = message.content.slice(0, 32) + (message.content.length > 32 ? '...' : '');
    }

    return session;
  }

  public deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }

  // Backward-compatibility aliases
  public createSession(arg1?: string | null, arg2?: string | null, arg3?: string): ConversationSession {
    if (arg3 !== undefined) {
      const session = this.createConversation(arg2 || null, arg3 || 'New Session');
      if (arg1) session.userId = arg1;
      return session;
    }
    const session = this.createConversation(arg1 || null, arg2 || 'New Session');
    return session;
  }

  public getSession(id: string): ConversationSession | null {
    return this.getConversation(id);
  }

  public listSessions(arg1?: string | null, arg2?: string | null): ConversationSession[] {
    const projectId = arg2 !== undefined ? arg2 : arg1;
    return this.getConversations(projectId);
  }
}
