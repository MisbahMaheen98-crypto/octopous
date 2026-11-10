import { ChatMessage, ProjectInfo } from '../octo.types.js';

export interface AiResponse {
  text: string;
  fileReferences?: string[];
  isSimulated: boolean;
  provider: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  generateResponse(
    messages: ChatMessage[],
    systemPrompt: string,
    fileReferences?: string[],
    project?: ProjectInfo
  ): Promise<AiResponse>;
  streamResponse?(
    messages: ChatMessage[],
    systemPrompt: string,
    onChunk: (chunk: string) => void,
    fileReferences?: string[],
    project?: ProjectInfo
  ): Promise<AiResponse>;
}
