import React from 'react';

interface SuggestedQuestionsProps {
  onSelectQuestion: (question: string) => void;
  hasActiveProject?: boolean;
}

export const SUGGESTED_QUESTIONS = [
  {
    category: 'Snapshots & Recovery',
    icon: '🛡️',
    title: 'Snapshot Changes',
    prompt: 'Explain what changed between my last two snapshots.',
  },
  {
    category: 'Snapshots & Recovery',
    icon: '⏪',
    title: 'AI-Guided Recovery',
    prompt: 'Help me recover the previous working version.',
  },
  {
    category: 'Architecture',
    icon: '🕸️',
    title: 'Project Architecture',
    prompt: 'Explain my project architecture and service relationships.',
  },
  {
    category: 'OCTOPUS Knowledge',
    icon: '📊',
    title: 'Show My Projects',
    prompt: 'Show my projects',
  },
  {
    category: 'OCTOPUS Knowledge',
    icon: '📸',
    title: 'Snapshot Count',
    prompt: 'How many snapshots do I have?',
  },
  {
    category: 'OCTOPUS Knowledge',
    icon: '📐',
    title: 'What is Blueprint?',
    prompt: 'What is Blueprint?',
  },
  {
    category: 'OCTOPUS Knowledge',
    icon: '🔑',
    title: 'Snapshot Secrets',
    prompt: 'Where can I find my secrets?',
  },
  {
    category: 'Git & Coding',
    icon: '🐙',
    title: 'Git Push Workflow',
    prompt: 'How do I push my code to GitHub repository?',
  },
  {
    category: 'Git & Coding',
    icon: '💡',
    title: 'Teach Me DSA',
    prompt: 'Teach me DSA from the basics.',
  },
  {
    category: 'System Info',
    icon: '⚡',
    title: 'Model Status',
    prompt: 'What AI model are you using?',
  },
];

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({
  onSelectQuestion,
}) => {
  return (
    <div className="octo-suggestions-wrapper">
      <div className="octo-suggestions-title">Suggested Inquiries &amp; Actions</div>
      <div className="octo-suggestions-cards-grid">
        {SUGGESTED_QUESTIONS.map((item, idx) => (
          <button
            key={idx}
            type="button"
            className="octo-suggestion-card"
            onClick={() => onSelectQuestion(item.prompt)}
            title={`Ask: "${item.prompt}"`}
          >
            <div className="octo-suggestion-card-header">
              <span className="octo-suggestion-card-icon">{item.icon}</span>
              <span className="octo-suggestion-card-category">{item.category}</span>
            </div>
            <div className="octo-suggestion-card-title">{item.title}</div>
            <p className="octo-suggestion-card-prompt">&ldquo;{item.prompt}&rdquo;</p>
          </button>
        ))}
      </div>
    </div>
  );
};
