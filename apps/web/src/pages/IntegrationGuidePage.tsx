
import { useState } from 'react';

const sections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn how to install and start using OCTOPUS.',
    content: [
      'Install the OCTOPUS extension in Visual Studio Code.',
      'Open your development project.',
      'Open the OCTOPUS extension and sign in.',
      'Connect to your OCTOPUS account.',
      'Start capturing your project snapshots.'
    ]
  },
  {
    id: 'snapshots',
    title: 'One-Click Snapshots',
    description: 'Capture and preserve your project states.',
    content: [
      'Open your project in VS Code.',
      'Open the OCTOPUS extension.',
      'Select Save Snapshot.',
      'Wait for the capture and upload to complete.',
      'Verify that your snapshot appears in the project timeline.'
    ]
  },
  {
    id: 'ghost-monitor',
    title: 'Ghost Monitor',
    description: 'Track changes happening in your project.',
    content: [
      'Open your project through OCTOPUS.',
      'Enable or access Ghost Monitor.',
      'Continue working on your project.',
      'Review detected project changes through the monitoring interface.'
    ]
  },
  {
    id: 'timeline',
    title: 'Snapshot Timeline',
    description: 'Explore your saved project history.',
    content: [
      'Open your project dashboard.',
      'Navigate to snapshot history.',
      'Browse your saved snapshots.',
      'Select a snapshot to view its details.',
      'Choose a snapshot for comparison or restoration.'
    ]
  },
  {
    id: 'comparison',
    title: 'Version Comparison',
    description: 'Understand differences between project versions.',
    content: [
      'Open your snapshot history.',
      'Select the first snapshot.',
      'Select the second snapshot.',
      'Open the comparison feature.',
      'Review added, modified and deleted files where supported.'
    ]
  },
  {
    id: 'restoration',
    title: 'Project Restoration',
    description: 'Recover an earlier project state.',
    content: [
      'Open your snapshot history.',
      'Select the snapshot you want to restore.',
      'Choose the restoration option.',
      'Select the files or project state to restore, where supported.',
      'Review your selection and confirm.',
      'Verify the restored project.'
    ]
  },
  {
    id: 'collaboration',
    title: 'Multi-User Collaboration',
    description: 'Understand shared workspaces and team activity.',
    content: [
      'Open an available shared workspace.',
      'Review your assigned permissions.',
      'Access project information available to your role.',
      'Review contributor activity.',
      'Follow recovery approval workflows where enabled.'
    ]
  },
  {
    id: 'project-dna',
    title: 'Project DNA Report',
    description: 'Understand your project development lifecycle.',
    content: [
      'Open the Project DNA feature.',
      'Review available project creation information.',
      'Explore snapshot and contributor statistics.',
      'Review modifications and restoration history.',
      'Download the lifecycle report where available.'
    ]
  },
  {
    id: 'octobot',
    title: 'Advanced OCTOBOT Assistant',
    description: 'Get AI assistance with your development projects.',
    content: [
      'Open OCTOBOT.',
      'Select the relevant project context.',
      'Enter your programming or project-related question.',
      'Send your message.',
      'Review OCTOBOT’s response.',
      'Use file uploads or preserved screenshots when additional context is needed.'
    ]
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Find solutions to common problems.',
    content: [
      'Snapshot creation failed: Check your connection, archive size and API availability.',
      'Snapshot missing: Refresh your dashboard and verify the selected project.',
      'Restoration failed: Check snapshot availability and workspace permissions.',
      'OCTOBOT not responding: Check your internet connection and AI service availability.',
      'If the issue continues, contact the OCTOPUS support team.'
    ]
  }
];

export function IntegrationGuidePage() {
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<string | null>(null);

  const filtered = sections.filter(section =>
    `${section.title} ${section.description} ${section.content.join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
      <div className="space-y-3">
        <div className="text-sm font-semibold text-teal-600">
          OCTOPUS DOCUMENTATION
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          OCTOPUS User Guide
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Everything you need to understand OCTOPUS, explore its features,
          protect your projects and recover your work.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Welcome to OCTOPUS</h2>
        <p className="mt-2 text-muted-foreground">
          OCTOPUS helps you preserve project states, monitor changes,
          compare versions and restore previous implementations.
        </p>
      </div>

      <div className="space-y-4">
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search the user guide..."
          className="w-full rounded-xl border bg-background px-4 py-3 outline-none focus:ring-2 focus:ring-teal-500"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((section, index) => (
            <button
              key={section.id}
              onClick={() =>
                setActive(active === section.id ? null : section.id)
              }
              className="rounded-xl border bg-card p-5 text-left transition hover:border-teal-500 hover:shadow-sm"
            >
              <div className="mb-3 text-sm font-medium text-teal-600">
                GUIDE {String(index + 1).padStart(2, '0')}
              </div>
              <h3 className="font-semibold">{section.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {section.description}
              </p>
              <div className="mt-4 text-sm font-medium text-teal-600">
                {active === section.id ? 'Close guide ↑' : 'Read guide →'}
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No matching guide sections found.
          </p>
        )}
      </div>

      {filtered
        .filter(section => section.id === active)
        .map(section => (
          <div
            key={section.id}
            className="rounded-2xl border bg-card p-6"
          >
            <h2 className="text-2xl font-bold">{section.title}</h2>
            <p className="mt-2 text-muted-foreground">
              {section.description}
            </p>

            <ol className="mt-6 list-decimal space-y-4 pl-6">
              {section.content.map((item, index) => (
                <li key={index} className="leading-7">
                  {item}
                </li>
              ))}
            </ol>
          </div>
        ))}
    </div>
  );
}

