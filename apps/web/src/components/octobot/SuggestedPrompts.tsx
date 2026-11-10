import React from 'react';
import {
  Sparkles,
  GitBranch,
  Binary,
  Code2,
  BrainCircuit,
  Coffee,
  Bug,
  HelpCircle,
} from 'lucide-react';

export interface SuggestedPromptsProps {
  onSelectPrompt: (promptText: string) => void;
}

export const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({ onSelectPrompt }) => {
  const prompts = [
    {
      icon: GitBranch,
      title: 'Push Code to GitHub',
      prompt: 'How do I push my code to GitHub repository?',
      badge: 'Git Workflow',
    },
    {
      icon: Binary,
      title: 'Teach Me DSA',
      prompt: 'Teach me DSA from the basics.',
      badge: 'Algorithms',
    },
    {
      icon: Code2,
      title: 'Python Functions',
      prompt: 'Explain Python functions with examples.',
      badge: 'Python',
    },
    {
      icon: BrainCircuit,
      title: 'AI vs Machine Learning',
      prompt: 'What is the difference between AI and ML?',
      badge: 'Concepts',
    },
    {
      icon: Coffee,
      title: 'Reverse String in Java',
      prompt: 'Write a Java program to reverse a string.',
      badge: 'Java Code',
    },
    {
      icon: Sparkles,
      title: 'Active Project Architecture',
      prompt: 'Explain my entire project architecture and services.',
      badge: 'Codebase',
    },
    {
      icon: Bug,
      title: 'Debug Payment Bug',
      prompt: 'Find the cause of the negative invoice bug in PaymentService and explain the root cause.',
      badge: 'Debugging',
    },
    {
      icon: HelpCircle,
      title: 'What Model Are You Using?',
      prompt: 'What AI model are you using?',
      badge: 'System Info',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-4 w-full">
      {prompts.map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(item.prompt)}
            className="p-4 text-left rounded-xl bg-white dark:bg-[#0c101d] hover:bg-cyan-50/50 dark:hover:bg-[#12182b] border border-gray-200 dark:border-cyan-950/60 hover:border-cyan-500/60 transition-all duration-150 group flex flex-col justify-between shadow-sm hover:shadow-md min-h-[120px] focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            title={`Ask: "${item.prompt}"`}
          >
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-[#151c30] text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform border border-gray-200 dark:border-cyan-900/40">
                  <Icon size={16} />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#151c30] text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-cyan-950/60 font-medium">
                  {item.badge}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors mb-1 tracking-tight">
                {item.title}
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                &ldquo;{item.prompt}&rdquo;
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
