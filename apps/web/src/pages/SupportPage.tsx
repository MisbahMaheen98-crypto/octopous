
import { useState } from 'react';

const topics = [
  {
    title: 'Snapshot Issues',
    icon: '📸',
    description: 'Capture and upload problems.',
    faqs: [
      {
        q: 'Why did my snapshot fail?',
        a: 'Check your internet connection, archive size, API availability and extension logs. Resolve the reported issue and retry.',
      },
      {
        q: 'Why is my snapshot not appearing?',
        a: 'Verify that the capture completed successfully. Refresh your dashboard and check the selected project.',
      },
    ],
  },
  {
    title: 'Restoration Help',
    icon: '🔄',
    description: 'Recover previous project versions.',
    faqs: [
      {
        q: 'How do I restore a snapshot?',
        a: 'Open snapshot history, select the required snapshot, choose restoration, review your selection and confirm.',
      },
      {
        q: 'What if restoration fails?',
        a: 'Check snapshot availability, storage access and workspace permissions before retrying.',
      },
    ],
  },
  {
    title: 'OCTOBOT Help',
    icon: '🤖',
    description: 'Get help with your AI assistant.',
    faqs: [
      {
        q: 'Why is OCTOBOT not responding?',
        a: 'Check your internet connection, backend availability and AI provider configuration.',
      },
      {
        q: 'Can OCTOBOT understand my project?',
        a: 'When project context is enabled and selected, OCTOBOT uses relevant workspace or snapshot information to answer project questions.',
      },
    ],
  },
  {
    title: 'Version Comparison',
    icon: '🔍',
    description: 'Understand project differences.',
    faqs: [
      {
        q: 'How do I compare snapshots?',
        a: 'Select two snapshots from your project history and open the comparison feature.',
      },
      {
        q: 'What changes can I identify?',
        a: 'Depending on available functionality, you can inspect added, modified and deleted files.',
      },
    ],
  },
  {
    title: 'Account & Login',
    icon: '👤',
    description: 'Account and profile assistance.',
    faqs: [
      {
        q: 'I cannot log in. What should I do?',
        a: 'Verify your credentials, internet connection and account verification status.',
      },
      {
        q: 'Where can I update my profile?',
        a: 'Open the Profile section from the OCTOPUS navigation menu.',
      },
    ],
  },
  {
    title: 'Technical Issues',
    icon: '⚙️',
    description: 'Connection and application problems.',
    faqs: [
      {
        q: 'Why is OCTOPUS unable to connect?',
        a: 'Check your internet connection, API availability and application configuration.',
      },
      {
        q: 'How do I report an error?',
        a: 'Contact the OCTOPUS support team with the error message and steps to reproduce the problem.',
      },
    ],
  },
];

export function SupportPage() {
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = topics.filter(topic =>
    `${topic.title} ${topic.description} ${topic.faqs
      .map(f => `${f.q} ${f.a}`)
      .join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const selected = topics.find(t => t.title === active);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
      <header>
        <p className="text-sm font-semibold text-teal-600">
          OCTOPUS HELP CENTER
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          How can we help you?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Find answers, explore features and resolve common problems.
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Search for help</h2>
        <input
          type="search"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setActive(null);
          }}
          placeholder="Search issues, features and questions..."
          className="mt-4 w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500"
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Browse help topics</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(topic => (
            <button
              key={topic.title}
              onClick={() => {
                setActive(active === topic.title ? null : topic.title);
                setExpanded(null);
              }}
              className="rounded-xl border bg-card p-5 text-left transition hover:border-teal-500"
            >
              <span className="text-2xl">{topic.icon}</span>
              <h3 className="mt-3 font-semibold">{topic.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {topic.description}
              </p>
              <p className="mt-4 text-sm font-medium text-teal-600">
                Explore topic →
              </p>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No matching help topics found.
          </p>
        )}
      </section>

      {selected && (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-2xl font-bold">
            {selected.icon} {selected.title}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {selected.description}
          </p>

          <div className="mt-6 space-y-3">
            {selected.faqs.map(faq => (
              <div key={faq.q} className="rounded-xl border p-4">
                <button
                  className="flex w-full items-center justify-between gap-3 text-left font-medium"
                  onClick={() =>
                    setExpanded(expanded === faq.q ? null : faq.q)
                  }
                >
                  {faq.q}
                  <span>{expanded === faq.q ? '−' : '+'}</span>
                </button>

                {expanded === faq.q && (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-6">
        <h2 className="text-xl font-semibold">Still need help?</h2>
        <p className="mt-2 text-muted-foreground">
          Contact our support team. Include your issue and any
          relevant error details so we can assist you.
        </p>

        <a
          href="mailto:ghostworkers.support@gmail.com"
          className="mt-5 inline-flex items-center gap-2 font-medium text-teal-600 hover:underline"
        >
          ✉ ghostworkers.support@gmail.com
        </a>
      </section>

      <footer className="border-t pt-5 text-center text-sm text-muted-foreground">
        OCTOPUS – Ghost Protocol
        <br />
        Your project. Your history. Your control.
      </footer>
    </main>
  );
}
