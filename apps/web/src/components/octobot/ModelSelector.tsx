import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Cpu, Sparkles } from 'lucide-react';
import { Badge } from './Badge';

export type ProviderId = 'all' | 'gemini' | 'gemma' | 'openai';

export interface ModelOption {
  id: string;
  name: string;
  provider: 'Google Gemini' | 'Google Gemma' | 'OpenAI' | 'Offline Safe';
  providerId: 'gemini' | 'gemma' | 'openai' | 'demo';
  badge: string;
  badgeVariant: 'cyan' | 'emerald' | 'orange' | 'violet' | 'electric';
  supportsVision: boolean;
  description: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  // 1. Google Gemini Models
  {
    id: 'gemini-2.0-flash',
    name: 'Google Gemini 2.0 Flash',
    provider: 'Google Gemini',
    providerId: 'gemini',
    badge: 'Fast Multimodal',
    badgeVariant: 'cyan',
    supportsVision: true,
    description: 'Ultra-fast multimodal inference for real-time developer queries.',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Google Gemini 1.5 Flash',
    provider: 'Google Gemini',
    providerId: 'gemini',
    badge: 'Production Cloud',
    badgeVariant: 'cyan',
    supportsVision: true,
    description: 'High-speed code reasoning and instant file explanation.',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Google Gemini 1.5 Pro',
    provider: 'Google Gemini',
    providerId: 'gemini',
    badge: 'Deep Reasoning',
    badgeVariant: 'cyan',
    supportsVision: true,
    description: 'Complex architecture refactoring and multi-file code reasoning.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Google Gemini 2.5 Flash Lite',
    provider: 'Google Gemini',
    providerId: 'gemini',
    badge: 'Ultra Low Latency',
    badgeVariant: 'cyan',
    supportsVision: true,
    description: 'Lightweight model optimized for rapid response times.',
  },

  // 2. Google Gemma Models (Uses existing Google/Gemini API key)
  {
    id: 'gemma-2-27b-it',
    name: 'Google Gemma 2 27B',
    provider: 'Google Gemma',
    providerId: 'gemma',
    badge: 'Open Weights',
    badgeVariant: 'orange',
    supportsVision: true,
    description: 'Frontier 27B open-weight model with high-accuracy coding capabilities.',
  },
  {
    id: 'gemma-2-9b-it',
    name: 'Google Gemma 2 9B',
    provider: 'Google Gemma',
    providerId: 'gemma',
    badge: 'Efficient',
    badgeVariant: 'orange',
    supportsVision: true,
    description: 'Fast, balanced open-weight model for daily programming tasks.',
  },
  {
    id: 'gemma-2-2b-it',
    name: 'Google Gemma 2 2B',
    provider: 'Google Gemma',
    providerId: 'gemma',
    badge: 'Lightweight',
    badgeVariant: 'orange',
    supportsVision: true,
    description: 'Ultra-lightweight open model for swift code suggestions.',
  },
  {
    id: 'gemma-4-31b-it',
    name: 'Gemma 4 31B (Multimodal)',
    provider: 'Google Gemma',
    providerId: 'gemma',
    badge: 'Open Multimodal',
    badgeVariant: 'orange',
    supportsVision: true,
    description: 'Advanced 31B open model with native code and screenshot debugging.',
  },

  // 3. OpenAI Models (Uses OPENAI_API_KEY)
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o',
    provider: 'OpenAI',
    providerId: 'openai',
    badge: 'Flagship Omni',
    badgeVariant: 'emerald',
    supportsVision: true,
    description: 'Top-tier multimodal intelligence for code generation and debugging.',
  },
  {
    id: 'gpt-4o-mini',
    name: 'OpenAI GPT-4o Mini',
    provider: 'OpenAI',
    providerId: 'openai',
    badge: 'Fast & Efficient',
    badgeVariant: 'emerald',
    supportsVision: true,
    description: 'Fast, lightweight OpenAI model optimized for quick code answers.',
  },
  {
    id: 'gpt-4-turbo',
    name: 'OpenAI GPT-4 Turbo',
    provider: 'OpenAI',
    providerId: 'openai',
    badge: 'Advanced Coding',
    badgeVariant: 'emerald',
    supportsVision: true,
    description: 'High-accuracy code generation with 128k context window.',
  },
  {
    id: 'o1-mini',
    name: 'OpenAI o1-mini',
    provider: 'OpenAI',
    providerId: 'openai',
    badge: 'Reasoning',
    badgeVariant: 'emerald',
    supportsVision: false,
    description: 'Reasoning model specialized in math, science, and algorithms.',
  },

  // 4. Offline Simulator
  {
    id: 'demo-simulator',
    name: 'OCTOBOT Demo Simulator',
    provider: 'Offline Safe',
    providerId: 'demo',
    badge: 'Simulator',
    badgeVariant: 'violet',
    supportsVision: true,
    description: 'Comprehensive offline simulation mode for local testing.',
  },
];

export interface ModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  isLiveConfigured?: boolean | undefined;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onSelectModel,
  isLiveConfigured = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<ProviderId>('all');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const [portalCoords, setPortalCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const activeModel: ModelOption =
    MODEL_OPTIONS.find((m) => m.id === selectedModel) ??
    MODEL_OPTIONS[0]!;

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const width = Math.min(380, viewportWidth - 24);
    const padding = 12;

    // Horizontal positioning:
    // Try to align left edge with trigger button
    let left = rect.left;
    if (left + width > viewportWidth - padding) {
      // If overflows on right, align right edge of dropdown with trigger right edge
      left = rect.right - width;
    }
    // Clamp so it never extends past screen bounds or behind the left sidebar
    left = Math.max(padding, Math.min(left, viewportWidth - width - padding));

    // Vertical positioning:
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Prefer opening below unless there is insufficient space (< 320px) and more space above
    const openUpwards = spaceBelow < 320 && spaceAbove > spaceBelow;

    if (openUpwards) {
      const maxHeight = Math.min(520, spaceAbove - padding * 2);
      setPortalCoords({
        bottom: viewportHeight - rect.top + 8,
        left,
        width,
        maxHeight,
      });
    } else {
      const maxHeight = Math.min(520, spaceBelow - padding * 2);
      setPortalCoords({
        top: rect.bottom + 8,
        left,
        width,
        maxHeight,
      });
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleResizeOrScroll = () => {
      updatePosition();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        portalRef.current &&
        !portalRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const filteredModels =
    selectedProviderFilter === 'all'
      ? MODEL_OPTIONS
      : MODEL_OPTIONS.filter((m) => m.providerId === selectedProviderFilter);

  // Group by provider for structured display
  const providers: { id: ProviderId; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: MODEL_OPTIONS.length },
    { id: 'gemini', label: 'Gemini', count: MODEL_OPTIONS.filter((m) => m.providerId === 'gemini').length },
    { id: 'gemma', label: 'Gemma', count: MODEL_OPTIONS.filter((m) => m.providerId === 'gemma').length },
    { id: 'openai', label: 'OpenAI', count: MODEL_OPTIONS.filter((m) => m.providerId === 'openai').length },
  ];

  const getProviderDotColor = (providerId: string) => {
    switch (providerId) {
      case 'gemini':
        return 'bg-cyan-500';
      case 'gemma':
        return 'bg-amber-500';
      case 'openai':
        return 'bg-emerald-500';
      default:
        return 'bg-purple-500';
    }
  };

  return (
    <div className="relative inline-block">
      {/* Model Selector Pill Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition border border-gray-200 dark:border-cyan-900/50 bg-white dark:bg-[#0c101d] text-gray-800 dark:text-cyan-200 hover:bg-gray-50 dark:hover:bg-cyan-950/40 shadow-sm"
        title={`Active Model: ${activeModel.name} (${activeModel.provider})`}
      >
        <span
          className={`w-2 h-2 rounded-full ${getProviderDotColor(activeModel.providerId)} ${
            isLiveConfigured ? 'animate-pulse' : ''
          }`}
        />
        <Cpu size={14} className="text-cyan-600 dark:text-cyan-400" />
        <span className="font-mono font-medium truncate max-w-[140px] sm:max-w-[180px]">
          {activeModel.name}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-cyan-500' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu via React Portal */}
      {isOpen &&
        portalCoords &&
        createPortal(
          <div
            ref={portalRef}
            style={{
              position: 'fixed',
              top: portalCoords.top !== undefined ? `${portalCoords.top}px` : undefined,
              bottom: portalCoords.bottom !== undefined ? `${portalCoords.bottom}px` : undefined,
              left: `${portalCoords.left}px`,
              width: `${portalCoords.width}px`,
              maxHeight: `${portalCoords.maxHeight}px`,
              zIndex: 9999,
            }}
            className="rounded-2xl bg-white dark:bg-[#0c101d] border border-gray-200 dark:border-cyan-900/60 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header & Provider Tabs */}
            <div className="p-3 border-b border-gray-100 dark:border-cyan-950/60 bg-gray-50/70 dark:bg-[#080b14] space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-gray-500 dark:text-slate-400 font-semibold flex items-center space-x-1.5">
                  <Sparkles size={12} className="text-purple-500" />
                  <span>AI Providers &amp; Models</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-medium">
                  {activeModel.provider}
                </span>
              </div>

              {/* Provider Filter Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-gray-200/70 dark:bg-cyan-950/40 text-[11px] font-sans">
                {providers.map((p) => {
                  const isActive = selectedProviderFilter === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProviderFilter(p.id)}
                      className={`flex-1 py-1 px-2 rounded-lg font-medium transition text-center ${
                        isActive
                          ? 'bg-white dark:bg-[#0f1527] text-gray-900 dark:text-white shadow-xs font-semibold'
                          : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Model Options List */}
            <div className="p-2 space-y-1 min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filteredModels.map((model) => {
                const isSelected = model.id === activeModel.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onSelectModel(model.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition flex items-start justify-between group ${
                      isSelected
                        ? 'bg-cyan-50/80 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800/60 shadow-xs'
                        : 'hover:bg-gray-100/70 dark:hover:bg-[#141b2d] border border-transparent'
                    }`}
                  >
                    <div className="space-y-1 pr-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: getProviderDotColor(model.providerId).replace('bg-', '') }}
                        />
                        <span className="text-xs font-semibold text-gray-900 dark:text-white font-mono group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                          {model.name}
                        </span>
                        <Badge variant={model.badgeVariant as any} size="sm">
                          {model.badge}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-tight">
                        {model.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer with Provider Status Notice */}
            <div className="px-3 py-2 border-t border-gray-100 dark:border-cyan-950/60 bg-gray-50/50 dark:bg-[#080b14] flex items-center justify-between text-[10px] font-mono text-gray-400 dark:text-slate-500 shrink-0">
              <span>Keys stored securely on backend (.env)</span>
              <span>Zero silent fallback</span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
