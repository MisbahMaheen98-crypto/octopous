import React, { useState, useRef, useEffect } from 'react';
import {
  ChatMessage,
  PatchProposal,
  ContextMode,
  octoApi,
  streamOctoChat,
  sendOctoChat,
  addOctoMessage,
  getOctoConversation,
  savePreservedScreenshot,
  type PreservedScreenshot,
  type OctobotMode,
} from '../../lib/octo/octo-client';
import { MessageItem } from './MessageItem';
import { ModelSelector } from './ModelSelector';
import { ModeSelector } from './ModeSelector';
import { OctoLogo } from './OctoLogo';
import { PreservedScreenshotModal } from './PreservedScreenshotModal';
import {
  Send,
  AlertCircle,
  Loader2,
  Square,
  Image as ImageIcon,
  X,
  Layers,
  Sparkles,
  Plus,
  Upload,
  FileCode,
  FileText,
} from 'lucide-react';

export interface AttachedItem {
  id: string;
  type: 'image' | 'file';
  name: string;
  dataUrl?: string | undefined;
  content?: string | undefined;
  sizeBytes?: number | undefined;
}

export interface ChatWorkspaceProps {
  projectId: string | null;
  projectName: string;
  conversationId: string;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  onSelectFile?: ((file: string) => void) | undefined;
  onPatchReady?: ((patch: PatchProposal) => void) | undefined;
  onConversationUpdated?: (() => void) | undefined;
  initialPrompt?: string | null | undefined;
  onClearInitialPrompt?: (() => void) | undefined;
  onOpenGraphify?: (() => void) | undefined;
  contextMode?: ContextMode | undefined;
  snapshotId?: string | null | undefined;
  baseSnapshotId?: string | null | undefined;
  targetSnapshotId?: string | null | undefined;
  providerInfo?: {
    isLiveConfigured: boolean;
    providerName: string;
    configuredModel: string;
  } | undefined;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  projectId,
  projectName,
  conversationId,
  selectedModel,
  onSelectModel,
  onSelectFile,
  onPatchReady,
  onConversationUpdated,
  initialPrompt,
  onClearInitialPrompt,
  onOpenGraphify,
  contextMode = 'workspace',
  snapshotId,
  baseSnapshotId,
  targetSnapshotId,
  providerInfo,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceDemoMode, setForceDemoMode] = useState(false);
  const [currentMode, setCurrentMode] = useState<OctobotMode>('agent');

  // Attachments & Modals
  const [attachments, setAttachments] = useState<AttachedItem[]>([]);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [preservedGalleryOpen, setPreservedGalleryOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAtBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);

  const handleGenericFile = (file: File) => {
    setError(null);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const newItem: AttachedItem = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'image',
          name: file.name,
          dataUrl,
          sizeBytes: file.size,
        };
        setAttachments((prev) => [...prev, newItem]);
        savePreservedScreenshot({
          id: `ps-${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          dataUrl,
          timestamp: new Date().toISOString(),
          sizeBytes: file.size,
        });
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const newItem: AttachedItem = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'file',
          name: file.name,
          content: text,
          sizeBytes: file.size,
        };
        setAttachments((prev) => [...prev, newItem]);
      };
      reader.readAsText(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleGenericFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleSelectPreservedScreenshot = (screenshot: PreservedScreenshot) => {
    setAttachments((prev) => [
      ...prev,
      {
        id: `att-${Date.now()}`,
        type: 'image',
        name: screenshot.name,
        dataUrl: screenshot.dataUrl,
      },
    ]);
  };

  // Load active conversation messages from session
  useEffect(() => {
    let isCurrent = true;
    async function loadSession() {
      try {
        const session = await getOctoConversation(conversationId);
        if (session && isCurrent) {
          setMessages(session.messages || []);
          prevMessagesLengthRef.current = session.messages?.length || 0;
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
              isAtBottomRef.current = true;
            }
          }, 100);
        }
      } catch (err) {
        console.error('Failed to load conversation session', err);
      }
    }

    if (conversationId) {
      loadSession();
    }
    return () => {
      isCurrent = false;
    };
  }, [conversationId]);

  // Track scroll position: if user is within 100px from the bottom, mark as at-bottom
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  // When a new message is added, smoothly scroll to bottom
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length;
      isAtBottomRef.current = true;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [messages.length]);

  // During AI streaming: auto-scroll only if already at bottom
  useEffect(() => {
    if (isStreaming && isAtBottomRef.current && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsLoading(false);
  };

  const handleRetry = () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;
    setError(null);
    void handleSendMessage(lastUserMsg.content, true);
  };

  const handleSendMessage = async (textToSend?: string, isRetry?: boolean) => {
    let text = (textToSend || input).trim();
    const currentAttachments = [...attachments];
    const imageItems = currentAttachments.filter((a) => a.type === 'image' && a.dataUrl);
    const fileItems = currentAttachments.filter((a) => a.type === 'file' && a.content);

    if ((!text && currentAttachments.length === 0) || isLoading) return;

    if (!text && imageItems.length > 0) {
      text = 'Please inspect this attached screenshot, explain the root cause, and suggest how to fix it.';
    }

    if (fileItems.length > 0) {
      const fileBlocks = fileItems
        .map((f) => `[Attached File: ${f.name}]\n\`\`\`\n${f.content}\n\`\`\``)
        .join('\n\n');
      text = fileBlocks + (text ? `\n\n${text}` : '\n\nPlease inspect the attached code file.');
    }

    const currentImages = imageItems.map((img) => img.dataUrl!);

    setError(null);
    let nextMessages = messages;

    if (!isRetry) {
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        images: currentImages.length > 0 ? currentImages : undefined,
      };

      nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setInput('');
      setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      // Persist user message to session
      try {
        await addOctoMessage(conversationId, userMessage);
        if (onConversationUpdated) onConversationUpdated();
      } catch {
        // Non-blocking persistence error
      }
    }

    isAtBottomRef.current = true;
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    }, 50);

    const assistantMsgId = `asst-${Date.now()}`;
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isSimulated: !providerInfo?.isLiveConfigured || forceDemoMode,
      fileReferences: [],
    };

    const contextPayload = {
      mode: currentMode,
      contextMode,
      snapshotId: snapshotId || undefined,
      baseSnapshotId: baseSnapshotId || undefined,
      targetSnapshotId: targetSnapshotId || undefined,
    };

    try {
      setIsLoading(true);
      setIsStreaming(true);
      setMessages([...nextMessages, initialAssistantMsg]);

      let accumulatedText = '';
      let fileRefs: string[] = [];
      let isSimulatedResponse = !providerInfo?.isLiveConfigured || forceDemoMode;
      let latestAgentState: any = undefined;

      abortControllerRef.current = new AbortController();

      try {
        // Attempt SSE Streaming
        await streamOctoChat(
          projectId,
          nextMessages,
          (chunk) => {
            accumulatedText += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: accumulatedText }
                  : m
              )
            );
          },
          (meta) => {
            if (meta?.fileReferences) {
              fileRefs = meta.fileReferences;
            }
            if (meta?.isSimulated !== undefined) {
              isSimulatedResponse = meta.isSimulated;
            }
            if (meta?.agentState) {
              latestAgentState = meta.agentState;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, agentState: meta.agentState }
                    : m
                )
              );
            }
          },
          abortControllerRef.current.signal,
          currentImages.length > 0 ? currentImages : undefined,
          selectedModel,
          forceDemoMode,
          contextPayload
        );
      } catch (streamErr: any) {
        if (streamErr.name === 'AbortError') {
          return;
        }
        // Fallback to standard request
        const res = await sendOctoChat(
          projectId,
          nextMessages,
          forceDemoMode,
          selectedModel,
          currentImages.length > 0 ? currentImages : undefined,
          contextPayload
        );
        accumulatedText = res.message.content;
        fileRefs = res.message.fileReferences || [];
        if (res.message.isSimulated !== undefined) {
          isSimulatedResponse = res.message.isSimulated;
        }
        if (res.message.agentState) {
          latestAgentState = res.message.agentState;
        }
      }

      // Check if query should auto-prepare a patch
      let suggestedPatch: PatchProposal | undefined = undefined;
      const lower = text.toLowerCase();
      if (projectId && (lower.includes('patch') || lower.includes('fix')) && lower.includes('payment')) {
        try {
          suggestedPatch = await octoApi.preparePatch(
            projectId,
            'src/services/PaymentService.ts',
            'const discountAmount = (subtotal * discountPercentage) / 100;',
            'Fix discount calculation: divide percentage by 100'
          );
          if (onPatchReady) onPatchReady(suggestedPatch);
        } catch {
          // patch fallback
        }
      }

      const finalizedMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: accumulatedText || 'Response completed.',
        timestamp: new Date().toISOString(),
        fileReferences: fileRefs,
        suggestedPatch,
        isSimulated: isSimulatedResponse,
        agentState: latestAgentState,
      };

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? finalizedMsg : m))
      );

      // Persist assistant message to session
      await addOctoMessage(conversationId, finalizedMsg);
      if (onConversationUpdated) onConversationUpdated();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to receive AI response. You can try again.');
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    if (initialPrompt) {
      handleSendMessage(initialPrompt);
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleApproveAgentStep = async (taskId: string) => {
    if (!projectId) return;
    try {
      const advanced = await octoApi.advanceAgentTask(projectId, taskId, true);
      if (advanced) {
        setMessages((prev) =>
          prev.map((m) =>
            m.agentState?.taskId === taskId
              ? { ...m, agentState: advanced }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Failed to advance agent step', err);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-octo-bg overflow-hidden relative w-full h-full">
      {/* Decorative ambient gradient matching reference design */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-gradient-to-br from-purple-100/50 via-indigo-50/30 to-transparent blur-3xl opacity-70 dark:opacity-10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-tl from-indigo-100/50 via-purple-50/30 to-transparent blur-3xl opacity-70 dark:opacity-10"
        aria-hidden="true"
      />

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto relative z-10 w-full px-4 md:px-6 py-6 flex flex-col"
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 max-w-2xl mx-auto text-center my-auto">
            {/* Centred 3D Mascot Logo */}
            <div className="mb-5 flex items-center justify-center">
              <img
                src="/octobot-mascot-transparent.png"
                alt="OCTOBOT Mascot"
                className="w-32 sm:w-36 h-auto object-contain transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            {/* Main Heading with Blue-to-Violet Gradient on OCTOBOT */}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white font-sans mb-3.5">
              How can{' '}
              <span className="octo-gradient-text text-transparent bg-clip-text bg-gradient-to-r from-[#2563eb] via-[#6366f1] to-[#9333ea]">
                OCTOBOT
              </span>{' '}
              help you today?
            </h1>

            {/* Workspace Label Badge matching Reference Screenshot */}
            <div className="flex items-center justify-center mb-3">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-octo-panel border border-gray-200/90 dark:border-octo-border shadow-sm text-xs font-sans text-gray-700 dark:text-gray-300">
                <Layers size={14} className="text-[#6366f1] shrink-0" />
                <span>
                  Workspace:{' '}
                  <strong className="font-semibold text-gray-900 dark:text-white">
                    {projectName || 'Workspace'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Workspace Description below the heading */}
            <p className="text-xs sm:text-sm text-gray-500 dark:text-octo-muted max-w-md mx-auto leading-relaxed font-sans">
              An advanced AI conversational assistant for code generation, computer science concepts, Git workflows, and codebase intelligence.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4 w-full">
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onSelectFile={onSelectFile}
                onPatchApplied={onConversationUpdated}
                onApproveAgentStep={handleApproveAgentStep}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input / Control Footer */}
      <div className="relative z-20 border-t border-gray-200 dark:border-cyan-950/60 bg-white/95 dark:bg-[#070a13]/95 backdrop-blur-md px-4 md:px-6 py-3">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Status & Error Alerts */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-center justify-between gap-3 text-xs text-red-600 dark:text-red-300">
              <div className="flex items-start space-x-2.5 flex-1 min-w-0">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="flex-1 break-words">{error}</span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isLoading}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/60 dark:hover:bg-red-800 dark:text-red-200 transition-colors"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600 dark:hover:text-red-200"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Multi-Attachment Preview Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-100/90 dark:bg-[#0c1122] rounded-2xl border border-gray-200 dark:border-cyan-950/70 shadow-sm animate-in fade-in">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center space-x-2 p-1.5 bg-white dark:bg-[#070b16] rounded-xl border border-gray-200 dark:border-cyan-900/60 shadow-sm text-xs font-mono"
                >
                  {att.type === 'image' && att.dataUrl ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="w-8 h-8 object-cover rounded-lg border border-cyan-800 shrink-0"
                    />
                  ) : (
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0">
                      <FileCode size={16} />
                    </div>
                  )}
                  <div className="max-w-[150px] pr-1 truncate">
                    <span className="font-semibold text-gray-900 dark:text-slate-200 block truncate text-[11px]">
                      {att.name}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 block">
                      {att.type === 'image' ? 'Image Attachment' : 'Code / Document'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                    className="p-1 rounded-md text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition"
                    title="Remove attachment"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Box */}
          <div className="flex items-end space-x-2 rounded-2xl border border-gray-200 dark:border-cyan-950/70 bg-gray-50/70 dark:bg-[#090d18] p-2 focus-within:border-cyan-500 dark:focus-within:border-cyan-500 transition shadow-inner">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.ts,.tsx,.js,.jsx,.json,.md,.txt,.py,.rs,.go,.prisma,.sql,.css,.html"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleGenericFile(file);
                e.target.value = '';
              }}
            />

            {/* Plus (+) Button with Attachment Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setPlusMenuOpen((prev) => !prev)}
                className="w-9 h-9 rounded-xl border border-gray-200 dark:border-cyan-950/70 bg-white dark:bg-[#0c1122] hover:bg-gray-100 dark:hover:bg-cyan-950/50 text-gray-600 dark:text-cyan-400 hover:text-gray-900 dark:hover:text-cyan-300 transition flex items-center justify-center shadow-sm"
                title="Add attachment (File or Preserved Screenshot)"
                aria-label="Add attachment"
              >
                <Plus size={18} />
              </button>

              {plusMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setPlusMenuOpen(false)} />
                  <div className="absolute bottom-full left-0 mb-2 w-64 rounded-2xl bg-white dark:bg-[#0c1122] border border-gray-200 dark:border-cyan-950/70 shadow-2xl z-40 p-1.5 space-y-1 animate-in fade-in">
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-slate-500 font-semibold">
                      Add Attachment
                    </div>

                    {/* Option A: Upload a File */}
                    <button
                      type="button"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs font-mono transition flex items-center space-x-2.5 hover:bg-gray-100 dark:hover:bg-cyan-950/40 text-gray-700 dark:text-slate-200"
                    >
                      <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                        <Upload size={14} />
                      </div>
                      <div>
                        <span className="font-semibold block">Upload a File</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-sans">
                          Code, text, documents, or images
                        </span>
                      </div>
                    </button>

                    {/* Option B: Add Preserved Screenshot */}
                    <button
                      type="button"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        setPreservedGalleryOpen(true);
                      }}
                      className="w-full text-left p-2 rounded-xl text-xs font-mono transition flex items-center space-x-2.5 hover:bg-gray-100 dark:hover:bg-cyan-950/40 text-gray-700 dark:text-slate-200"
                    >
                      <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <ImageIcon size={14} />
                      </div>
                      <div>
                        <span className="font-semibold block">Add Preserved Screenshot</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-sans">
                          Pick from saved project captures
                        </span>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={`Ask OCTOBOT about ${projectName}, debug code, or teach concepts...`}
              className="flex-1 bg-transparent border-0 focus:ring-0 text-xs md:text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 resize-none py-1.5 px-2 max-h-40 min-h-[38px] leading-relaxed focus:outline-none"
            />

            {/* Action Buttons */}
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition shrink-0 shadow-sm flex items-center space-x-1"
                title="Stop response generation"
              >
                <Square size={16} />
                <span className="text-xs font-medium">Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={(!input.trim() && attachments.length === 0) || isLoading}
                className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition shrink-0 shadow-sm disabled:opacity-40 disabled:hover:bg-cyan-600 flex items-center space-x-1"
                title="Send message (Enter)"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span className="text-xs font-semibold">Send ➔</span>
              </button>
            )}
          </div>

          {/* Model Selector and Status Footer */}
          <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 dark:text-slate-500 pt-1">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap gap-y-1">
              <ModeSelector currentMode={currentMode} onSelectMode={setCurrentMode} />
              <ModelSelector
                selectedModel={selectedModel}
                onSelectModel={onSelectModel}
                isLiveConfigured={providerInfo?.isLiveConfigured}
              />
              <span className="hidden sm:inline">
                Press <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-[#12182b] text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-[#12182b] text-[10px]">Shift+Enter</kbd> for newline
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setForceDemoMode((prev) => !prev)}
                className={`text-[10px] px-2 py-0.5 rounded-lg border transition ${
                  forceDemoMode
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold'
                    : 'text-gray-400 dark:text-slate-500 border-transparent hover:border-gray-300 dark:hover:border-slate-700'
                }`}
                title="Toggle offline simulator sandbox"
              >
                {forceDemoMode ? 'Simulator Active' : 'Live Mode'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preserved Screenshot Modal */}
      <PreservedScreenshotModal
        isOpen={preservedGalleryOpen}
        onClose={() => setPreservedGalleryOpen(false)}
        onSelectScreenshot={handleSelectPreservedScreenshot}
      />
    </div>
  );
};
