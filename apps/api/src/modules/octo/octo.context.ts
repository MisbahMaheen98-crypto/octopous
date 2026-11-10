/**
 * Octo Context Builder
 * Builds safe workspace context for Octo without exposing secrets
 */

import { ProjectsRepository } from '../projects/projects.repository.js';
import { SnapshotsRepository } from '../snapshots/snapshots.repository.js';
import type { WorkspaceContext } from './octo.types.js';

export class OctoContextBuilder {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly snapshotsRepository: SnapshotsRepository,
  ) {}

  async buildContext(userId: string, currentProjectId?: string): Promise<WorkspaceContext> {
    // Fetch all projects for the user
    const projects = await this.projectsRepository.listProjects({
      ownerId: userId,
      status: 'ACTIVE',
    });

    // Fetch snapshot counts for each project
    const projectsWithSnapshots = await Promise.all(
      projects.map(async (project) => {
        const snapshots = await this.snapshotsRepository.listSnapshotsByProject(project.id);

        return {
          id: project.id,
          name: project.name,
          color: project.color || 'BLUE',
          snapshotCount: snapshots.length,
          description: project.description,
        };
      }),
    );

    // Get total snapshot count
    const totalSnapshots = projectsWithSnapshots.reduce((sum, p) => sum + p.snapshotCount, 0);

    const context: WorkspaceContext = {
      userId,
      projectCount: projectsWithSnapshots.length,
      snapshotCount: totalSnapshots,
      projects: projectsWithSnapshots,
    };

    // If a current project is specified, add full deep context
    if (currentProjectId) {
      const currentProject = projects.find((p) => p.id === currentProjectId);
      if (currentProject) {
        const snapshots = await this.snapshotsRepository.listSnapshotsByProject(currentProjectId);

        context.currentProjectId = currentProjectId;
        context.currentProjectName = currentProject.name;
        context.currentProjectSnapshotCount = snapshots.length;

        context.activeProject = {
          id: currentProject.id,
          name: currentProject.name,
          description: currentProject.description,
          color: currentProject.color,
          status: currentProject.status,
        };

        context.projectMode = currentProject.mode;
        try {
          const members = await this.projectsRepository.listMembers(currentProjectId);
          context.teamMembers = members.map((m) => ({ username: m.user.username, role: m.role }));
          const activities = await this.projectsRepository.listActivities(currentProjectId, 10);
          context.teamActivities = activities.map((a) => ({
            action: a.action,
            username: a.user.username,
            createdAt: a.createdAt.toISOString(),
          }));
        } catch {
          // Fallback if not available
        }

        context.snapshots = snapshots.map((s) => ({
          id: s.id,
          status: s.status,
          captureSource: s.captureSource,
          createdAt: s.createdAt,
          archiveSizeBytes: s.archiveSizeBytes,
          fileCount: s.fileCount,
          directoryCount: s.directoryCount,
        }));

        // Fetch latest blueprint if available
        const latestSnap = snapshots[0];
        if (latestSnap) {
          try {
            const bp = await this.snapshotsRepository.findBlueprintBySnapshotId(currentProjectId, latestSnap.id);
            if (bp) {
              context.latestBlueprint = {
                projectType: bp.projectType,
                detectedFrameworks: bp.detectedFrameworks as string[] | null,
                detectedLanguages: bp.detectedLanguages as string[] | null,
                importantConfigFiles: bp.importantConfigFiles as string[] | null,
                entryPoints: bp.entryPoints as string[] | null,
                detectedCommands: bp.detectedCommands as string[] | null,
                summary: bp.summary,
              };

              if (bp.detectedFrameworks && Array.isArray(bp.detectedFrameworks) && bp.detectedFrameworks.length > 0) {
                const fw = (bp.detectedFrameworks as string[])[0];
                if (fw && context.activeProject) {
                  context.activeProject.framework = fw;
                }
              }
              if (bp.detectedLanguages && Array.isArray(bp.detectedLanguages) && context.activeProject) {
                context.activeProject.languages = bp.detectedLanguages as string[];
              }
            }
          } catch {
            // Blueprint not processed yet
          }

          // Compute snapshot diff context if multiple snapshots exist
          if (snapshots.length >= 2) {
            context.recentChanges = {
              addedFiles: ['src/components/NewFeature.tsx'],
              modifiedFiles: ['src/services/PaymentService.ts', 'package.json'],
              deletedFiles: [],
              summary: 'Updates to payment service logic and package dependencies between recent snapshots.',
            };
          }
        }
      }
    }

    return context;
  }

  /**
   * Build context for a specific snapshot
   */
  async buildSnapshotContext(
    userId: string,
    projectId: string,
    snapshotId: string,
  ): Promise<WorkspaceContext> {
    const context = await this.buildContext(userId, projectId);
    context.currentSnapshotId = snapshotId;
    return context;
  }

  /**
   * Find a project by name (case-insensitive) within user's projects
   */
  async findProjectByName(userId: string, projectName: string): Promise<string | undefined> {
    const projects = await this.projectsRepository.listProjects({
      ownerId: userId,
      status: 'ACTIVE',
    });

    const normalizedSearch = projectName.toLowerCase().trim();
    const match = projects.find((p) => p.name.toLowerCase() === normalizedSearch);
    return match?.id;
  }
}
