import { ChatMessage, ProjectInfo } from '../octo.types.js';

export type QuestionCategory =
  | 'GREETING'
  | 'SYSTEM_IDENTITY'
  | 'GENERAL_KNOWLEDGE'
  | 'PROGRAMMING_GENERAL'
  | 'PROJECT_SPECIFIC'
  | 'FOLLOW_UP';

export interface ClassificationResult {
  category: QuestionCategory;
  requiresProjectContext: boolean;
  confidence: number;
  extractedTopic?: string;
  reason: string;
}

export class QuestionClassifier {
  /**
   * Classifies user message to route appropriately between:
   * 1. General knowledge (direct to AI)
   * 2. General programming (direct to AI with coding guidelines)
   * 3. Follow-up (uses previous conversation context)
   * 4. System identity (model/configuration queries)
   * 5. Project-specific (uses repository indexer)
   */
  public static classify(
    messages: ChatMessage[],
    project?: ProjectInfo
  ): ClassificationResult {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || !lastMessage.content) {
      return {
        category: 'GREETING',
        requiresProjectContext: false,
        confidence: 1.0,
        reason: 'Empty message treated as greeting',
      };
    }

    const text = lastMessage.content.trim();
    const lower = text.toLowerCase();

    // 1. Greetings
    const greetingRegex = /^(hi|hello|hey|howdy|greetings|good\s+(morning|afternoon|evening|day)|sup|yo)[\s!.,?]*$/i;
    if (greetingRegex.test(lower)) {
      return {
        category: 'GREETING',
        requiresProjectContext: false,
        confidence: 0.98,
        reason: 'Matched conversational greeting pattern',
      };
    }

    // 2. System identity / Model queries
    const identityRegex = /(what\s+ai\s+model|which\s+model|what\s+model|who\s+are\s+you|what\s+are\s+you|what\s+is\s+octobot|are\s+you\s+chatgpt|are\s+you\s+copilot)/i;
    if (identityRegex.test(lower)) {
      return {
        category: 'SYSTEM_IDENTITY',
        requiresProjectContext: false,
        confidence: 0.95,
        reason: 'Query asks about AI assistant identity or model configuration',
      };
    }

    // 3. Project name / Workspace metadata query
    const projectNameRegex = /(what('?s|\s+is)\s+(my|the|this)\s+(current\s+)?project(\s+name)?|project\s+name|what\s+project\s+am\s+i\s+on)/i;
    if (projectNameRegex.test(lower)) {
      return {
        category: 'PROJECT_SPECIFIC',
        requiresProjectContext: true,
        confidence: 0.95,
        reason: 'Query specifically asks for current project metadata',
      };
    }

    // 4. Follow-up questions (dependent on previous conversation turns)
    const isFollowUp = this.detectFollowUp(messages);
    if (isFollowUp) {
      // Find the topic of the previous messages
      const previousTopic = this.extractTopicFromHistory(messages);
      return {
        category: 'FOLLOW_UP',
        requiresProjectContext: false,
        confidence: 0.9,
        extractedTopic: previousTopic,
        reason: 'Matched conversational follow-up pattern referencing prior turns',
      };
    }

    // 5. Explicit Project-specific keywords (files, functions, architecture)
    const projectKeywords = [
      'paymentservice',
      'userprofile',
      'auth.ts',
      'auth',
      'authentication',
      'appconfig',
      'calculatetotalamount',
      'calculatesubtotal',
      'which files will be affected',
      'what files depend',
      'affected if i modify',
      'graphify',
      'knowledge graph',
      'failing test',
      'track the changes',
      'track changes',
      'compare snapshots',
      'compare two project snapshots',
      'between snapshots',
      'what changed between versions',
      'what changed',
      'snapshot comparison',
      'snapshot diff',
      'code-level change',
      'in this repo',
      'in this project',
      'in our codebase',
      'my codebase',
      'my files',
      'our project',
      'this repository',
      'explain my entire project',
      'explain this project',
      'explain the project architecture',
    ];

    const hasProjectKeyword = projectKeywords.some((kw) => lower.includes(kw));
    if (hasProjectKeyword) {
      return {
        category: 'PROJECT_SPECIFIC',
        requiresProjectContext: true,
        confidence: 0.95,
        reason: 'Query mentions specific workspace files, functions, or codebase scope',
      };
    }

    // 6. General Programming & Software Engineering questions
    const programmingKeywords = [
      'push my code',
      'git ',
      'github',
      'dsa',
      'data structure',
      'algorithm',
      'python',
      'java',
      'javascript',
      'typescript',
      'react',
      'sql',
      'database',
      'reverse a string',
      'write a program',
      'write a function',
      'how do i fix',
      'syntax error',
      'regular expression',
      'regex',
      'docker',
      'deploy',
      'normalization',
      'object-oriented',
      'oop',
      'recursion',
      'sorting',
      'binary search',
      'linked list',
    ];

    const isProgramming = programmingKeywords.some((kw) => lower.includes(kw));
    if (isProgramming) {
      return {
        category: 'PROGRAMMING_GENERAL',
        requiresProjectContext: false,
        confidence: 0.9,
        reason: 'General programming or computer science question',
      };
    }

    // 7. General Knowledge questions (AI, ML, tech, science, history, explanations)
    const generalKnowledgeKeywords = [
      'artificial intelligence',
      'machine learning',
      'difference between',
      'what is an api',
      'what is',
      'explain',
      'teach me',
      'how does',
      'why is',
      'tell me about',
    ];

    const isGeneralKnowledge = generalKnowledgeKeywords.some((kw) => lower.includes(kw));
    if (isGeneralKnowledge) {
      return {
        category: 'GENERAL_KNOWLEDGE',
        requiresProjectContext: false,
        confidence: 0.85,
        reason: 'General conceptual or educational question',
      };
    }

    // Default: If no project files are explicitly targeted, treat as general question rather than failing!
    return {
      category: 'GENERAL_KNOWLEDGE',
      requiresProjectContext: false,
      confidence: 0.7,
      reason: 'General conversational query without project-specific targeting',
    };
  }

  private static detectFollowUp(messages: ChatMessage[]): boolean {
    if (messages.length < 2) return false;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return false;
    const lower = lastMessage.content.toLowerCase().trim();

    const followUpPatterns = [
      /^(can\s+you\s+)?explain\s+(that|this|it)\s+(more\s+)?(simply|simpler|better|in\s+detail)/i,
      /^(what\s+about|how\s+about)\s+/i,
      /^(what\s+are\s+its\s+types|what\s+types\s+are\s+there)/i,
      /^(give\s+me|show\s+me|write)\s+(a|an)?\s*(python|java|javascript|code|example|more)/i,
      /^(why\s+is\s+that|how\s+does\s+that\s+work)/i,
      /^(can\s+you\s+)?simplify\s+(that|this|it)/i,
      /^(tell\s+me\s+more|elaborate|expand\s+on\s+that)/i,
      /^and\s+/i,
    ];

    return followUpPatterns.some((pattern) => pattern.test(lower));
  }

  private static extractTopicFromHistory(messages: ChatMessage[]): string {
    for (let i = messages.length - 2; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === 'user') {
        const text = msg.content;
        return text.slice(0, 80);
      }
    }
    return 'the previous topic';
  }
}
