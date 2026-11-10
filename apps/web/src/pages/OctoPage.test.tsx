import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { OctoPage } from './OctoPage';
import { SUGGESTED_QUESTIONS } from '../components/octobot/SuggestedQuestions';

describe('OCTOBOT Integration in OCTOPUS', () => {
  it('renders OCTOBOT branding, header actions, and chat workspace', () => {
    const html = renderToStaticMarkup(createElement(OctoPage));

    // 1. Branding
    expect(html).toContain('OCTOBOT');
    expect(html).toContain('AI Assistant &amp; Intelligence');

    // 2. Header elements
    expect(html).toContain('Knowledge Graph');
    expect(html).toContain('New Chat');
    expect(html).toContain('All Projects (Workspace)');

    // 3. Sidebar elements
    expect(html).toContain('New Conversation');
    expect(html).toContain('Recent Conversations');
    expect(html).toContain('ACTIVE WORKSPACE');

    // 4. Input Dock
    expect(html).toContain('Add attachment');
    expect(html).toContain('Send ➔');

    // 5. Clean Hero & Welcome
    expect(html).toContain('How can ');
    expect(html).toContain('octo-gradient-text');
    expect(html).toContain('help you today?');
    expect(html).toContain('An advanced AI conversational assistant');
  });

  it('preserves all legacy suggested questions and snapshot recovery prompts', () => {
    const prompts = SUGGESTED_QUESTIONS.map((q) => q.prompt);

    // Legacy questions preserved
    expect(prompts).toContain('Show my projects');
    expect(prompts).toContain('How many snapshots do I have?');
    expect(prompts).toContain('What is Blueprint?');
    expect(prompts).toContain('Where can I find my secrets?');

    // OCTOPUS-aware recovery and architecture questions
    expect(prompts).toContain('Explain what changed between my last two snapshots.');
    expect(prompts).toContain('Help me recover the previous working version.');
    expect(prompts).toContain('Explain my project architecture and service relationships.');
    expect(prompts).toContain('How do I push my code to GitHub repository?');
    expect(prompts).toContain('Teach me DSA from the basics.');
    expect(prompts).toContain('What AI model are you using?');
  });
});
