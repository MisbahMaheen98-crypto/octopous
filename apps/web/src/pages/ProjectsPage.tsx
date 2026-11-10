import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '../components/states/EmptyState';
import { ErrorState } from '../components/states/ErrorState';
import { LoadingState } from '../components/states/LoadingState';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ProjectColorPicker } from '../components/projects/ProjectColorPicker';
import { getProjectCardColorClasses } from '../lib/projects/project-colors';
import { buildCreateProjectInput } from '../lib/projects/project-form';
import { SearchInput } from '../components/ui/SearchInput';
import { createProject, listProjects } from '../lib/projects/projects-client';
import type { Project, ProjectColor, ProjectMode } from '../lib/projects/types';

export function resolveProjectCardClasses(project: Pick<Project, 'color'>) {
  return getProjectCardColorClasses(project.color);
}

export function filterProjectsByQuery(projects: Project[], query: string): Project[] {
  const normalized = query.trim().toLowerCase();

  if (normalized.length === 0) {
    return projects;
  }

  return projects.filter((project) => {
    const haystack = `${project.name} ${project.description ?? ''}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createColor, setCreateColor] = useState<ProjectColor | null>(null);
  const [createMode, setCreateMode] = useState<ProjectMode>('INDIVIDUAL');
  const [createGitUrl, setCreateGitUrl] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);

    const result = await listProjects();

    setIsLoading(false);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setProjects(result.data.projects);
  };

  useEffect(() => {
    void loadProjects();
  }, []);

  const filteredProjects = useMemo(() => filterProjectsByQuery(projects, query), [projects, query]);

  const onCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    const result = await createProject(
      buildCreateProjectInput({
        name: createName,
        description: createDescription,
        color: createColor,
        mode: createMode,
        gitRemoteUrl: createGitUrl || undefined,
      }),
    );

    setIsCreating(false);

    if (!result.success) {
      setCreateError(result.error.message);
      return;
    }

    setIsCreateOpen(false);
    setCreateName('');
    setCreateDescription('');
    setCreateColor(null);
    setCreateMode('INDIVIDUAL');
    setCreateGitUrl('');
    await loadProjects();
  };

  return (
    <>
      <Card>
        <div className="row-between projects-head">
          <div>
            <h3 className="card-title">Projects</h3>
            <p className="muted body-sm">
              Create and manage your OCTOPUS projects. Admin-controlled optional team collaboration supported.
            </p>
          </div>
          <Button variant="primary" type="button" onClick={() => setIsCreateOpen(true)}>
            Create Project
          </Button>
        </div>

        <div className="projects-search">
          <SearchInput
            placeholder="Search by name or description"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </Card>

      {isLoading ? <LoadingState label="Loading projects..." /> : null}
      {error ? <ErrorState title="Projects unavailable" message={error} /> : null}

      {!isLoading && !error && projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          message="Create your first project to start organizing OCTOPUS resources."
        />
      ) : null}

      {!isLoading && !error && projects.length > 0 && filteredProjects.length === 0 ? (
        <EmptyState title="No projects found" message="Try a different name or description." />
      ) : null}

      {!isLoading && !error && filteredProjects.length > 0 ? (
        <div className="projects-grid">
          {filteredProjects.map((project) => {
            const cardColors = resolveProjectCardClasses(project);

            return (
              <Card key={project.id} className={cardColors.cardClassName}>
                <div className="project-card-accent-row" aria-hidden="true" />
                <div className="row-between">
                  <div className="project-card-header-main">
                    <span className={cardColors.iconClassName}>{project.name.charAt(0).toUpperCase() || 'P'}</span>
                    <div>
                      <h4 className="card-title">{project.name}</h4>
                      <p className="muted body-sm">{project.description || 'No description provided'}</p>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <Badge tone={project.mode === 'COLLABORATIVE' ? 'ok' : 'neutral'}>
                          {project.mode === 'COLLABORATIVE'
                            ? `👥 Team (${project.memberCount ?? 1})`
                            : '🔒 Individual'}
                        </Badge>
                        {project.userRole && project.userRole !== 'OWNER' && (
                          <Badge tone="warn">{project.userRole}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="project-card-header-side">
                    {cardColors.hasColor ? <span className="project-color-indicator" aria-label={`${project.color} project color`} /> : null}
                  </div>
                </div>
                <div className="project-meta muted meta-sm">
                  <span>Created: {new Date(project.createdAt).toLocaleString()}</span>
                  <span>Updated: {new Date(project.updatedAt).toLocaleString()}</span>
                </div>
                <div className="project-actions">
                  <Link className="btn btn-secondary" to={`/projects/${project.id}`}>
                    Open
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Modal title="Create Project" isOpen={isCreateOpen}>
        <form className="form-stack" onSubmit={onCreateSubmit}>
          <label className="eyebrow" htmlFor="project-name">
            Project name
          </label>
          <Input
            id="project-name"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            required
          />

          <label className="eyebrow" htmlFor="project-description">
            Description
          </label>
          <Input
            id="project-description"
            value={createDescription}
            onChange={(event) => setCreateDescription(event.target.value)}
          />

          <label className="eyebrow">Project Mode</label>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              marginBottom: '12px',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="radio"
                name="projectMode"
                checked={createMode === 'INDIVIDUAL'}
                onChange={() => setCreateMode('INDIVIDUAL')}
              />
              <span>🔒 <strong>Individual</strong> (Private to you)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="radio"
                name="projectMode"
                checked={createMode === 'COLLABORATIVE'}
                onChange={() => setCreateMode('COLLABORATIVE')}
              />
              <span>👥 <strong>Collaborative</strong> (Team access)</span>
            </label>
          </div>

          {createMode === 'COLLABORATIVE' && (
            <>
              <label className="eyebrow" htmlFor="project-git-url">
                Git Repository URL (Optional)
              </label>
              <Input
                id="project-git-url"
                placeholder="https://github.com/organization/repo.git"
                value={createGitUrl}
                onChange={(event) => setCreateGitUrl(event.target.value)}
              />
            </>
          )}

          <ProjectColorPicker value={createColor} onChange={setCreateColor} idPrefix="create-project" />

          {createError ? <p className="form-error">{createError}</p> : null}

          <div className="modal-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsCreateOpen(false);
                setCreateColor(null);
                setCreateMode('INDIVIDUAL');
                setCreateGitUrl('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
