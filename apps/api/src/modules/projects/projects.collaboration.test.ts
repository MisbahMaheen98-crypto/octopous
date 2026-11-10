import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '../../db/client.js';
import { ProjectsRepository } from './projects.repository.js';
import { ProjectsService } from './projects.service.js';
import { SnapshotsRepository } from '../snapshots/snapshots.repository.js';
import { SnapshotsService } from '../snapshots/snapshots.service.js';
import type { SnapshotStorage } from '../snapshots/snapshots.storage.js';

describe('OCTOPUS – Admin-Controlled Optional Team Collaboration Tests', () => {
  const projectsRepo = new ProjectsRepository();
  const projectsService = new ProjectsService(projectsRepo);
  const snapshotsRepo = new SnapshotsRepository();

  const mockStorage: SnapshotStorage = {
    storeArchive: async () => ({
      storageKey: 'mock-key',
      integrityAlgorithm: 'sha256',
      integrityHash: 'mock-hash',
      sizeBytes: 100,
    }),
    readArchive: async () => Buffer.from('mock'),
    deleteArchive: async () => {},
  };

  const snapshotsService = new SnapshotsService(snapshotsRepo, mockStorage);

  let adminUser: { id: string; username: string; email: string };
  let devUserA: { id: string; username: string; email: string };
  let devUserB: { id: string; username: string; email: string };
  let outsiderUser: { id: string; username: string; email: string };

  beforeEach(async () => {
    // Setup test users
    const timestamp = Date.now();
    adminUser = await prisma.user.create({
      data: {
        username: `admin_${timestamp}`,
        email: `admin_${timestamp}@gmail.com`,
        passwordHash: 'hashed_pw_admin',
        status: 'ACTIVE',
      },
      select: { id: true, username: true, email: true },
    });

    devUserA = await prisma.user.create({
      data: {
        username: `devA_${timestamp}`,
        email: `devA_${timestamp}@gmail.com`,
        passwordHash: 'hashed_pw_devA',
        status: 'ACTIVE',
      },
      select: { id: true, username: true, email: true },
    });

    devUserB = await prisma.user.create({
      data: {
        username: `devB_${timestamp}`,
        email: `devB_${timestamp}@gmail.com`,
        passwordHash: 'hashed_pw_devB',
        status: 'ACTIVE',
      },
      select: { id: true, username: true, email: true },
    });

    outsiderUser = await prisma.user.create({
      data: {
        username: `outsider_${timestamp}`,
        email: `outsider_${timestamp}@gmail.com`,
        passwordHash: 'hashed_pw_outsider',
        status: 'ACTIVE',
      },
      select: { id: true, username: true, email: true },
    });
  });

  it('Scenarios 1 & 2: Admin creates an individual project and works on it privately without members', async () => {
    const individualProj = await projectsService.createProject(adminUser.id, {
      name: 'Solo Project',
      mode: 'INDIVIDUAL',
    });

    expect(individualProj.mode).toBe('INDIVIDUAL');
    expect(individualProj.userRole).toBe('OWNER');

    // Admin can access
    const fetched = await projectsService.getProject(adminUser.id, individualProj.id);
    expect(fetched.id).toBe(individualProj.id);

    // Other users cannot access individual project
    await expect(projectsService.getProject(devUserA.id, individualProj.id)).rejects.toThrow();

    // Listed for Admin only
    const adminProjects = await projectsService.listProjects(adminUser.id, {});
    expect(adminProjects.some((p) => p.id === individualProj.id)).toBe(true);

    const devAProjects = await projectsService.listProjects(devUserA.id, {});
    expect(devAProjects.some((p) => p.id === individualProj.id)).toBe(false);
  });

  it('Scenarios 3, 4 & 5: Admin creates a collaborative project, adds two registered developers, and both access the shared project', async () => {
    const collabProj = await projectsService.createProject(adminUser.id, {
      name: 'Hackathon App',
      mode: 'COLLABORATIVE',
    });

    expect(collabProj.mode).toBe('COLLABORATIVE');

    // Admin adds Developer A
    const memberA = await projectsService.addMember(adminUser.id, collabProj.id, {
      emailOrUsername: devUserA.username,
      role: 'DEVELOPER',
    });
    expect(memberA.role).toBe('DEVELOPER');
    expect(memberA.user.username).toBe(devUserA.username);

    // Admin adds Developer B
    const memberB = await projectsService.addMember(adminUser.id, collabProj.id, {
      emailOrUsername: devUserB.email,
      role: 'DEVELOPER',
    });
    expect(memberB.role).toBe('DEVELOPER');
    expect(memberB.user.username).toBe(devUserB.username);

    // Both developers can list and get the shared project
    const devAProj = await projectsService.getProject(devUserA.id, collabProj.id);
    expect(devAProj.name).toBe('Hackathon App');
    expect(devAProj.userRole).toBe('DEVELOPER');
    expect(devAProj.memberCount).toBe(3); // Admin + DevA + DevB

    const devBProj = await projectsService.getProject(devUserB.id, collabProj.id);
    expect(devBProj.name).toBe('Hackathon App');
    expect(devBProj.userRole).toBe('DEVELOPER');

    // Verify listProjects returns this collaborative project to both developers
    const listDevA = await projectsService.listProjects(devUserA.id, {});
    expect(listDevA.some((p) => p.id === collabProj.id)).toBe(true);

    const listDevB = await projectsService.listProjects(devUserB.id, {});
    expect(listDevB.some((p) => p.id === collabProj.id)).toBe(true);
  });

  it('Scenarios 6, 7 & 8: One developer creates a snapshot, the other sees it, and both see project activities', async () => {
    const collabProj = await projectsService.createProject(adminUser.id, {
      name: 'Sync Hackathon',
      mode: 'COLLABORATIVE',
    });

    await projectsService.addMember(adminUser.id, collabProj.id, {
      emailOrUsername: devUserA.username,
      role: 'DEVELOPER',
    });

    await projectsService.addMember(adminUser.id, collabProj.id, {
      emailOrUsername: devUserB.username,
      role: 'DEVELOPER',
    });

    // Developer A records a snapshot via repository
    const snap = await snapshotsRepo.createSnapshot({
      projectId: collabProj.id,
      captureSource: 'WEB',
      status: 'COMPLETED',
      fileCount: 42,
    });

    // Record activity for Developer A
    await projectsService.recordActivity(collabProj.id, devUserA.id, 'SNAPSHOT_CREATED', {
      snapshotId: snap.id,
      fileCount: 42,
    });

    // Developer B lists snapshots and sees Developer A's snapshot
    const snapshotsSeenByDevB = await snapshotsService.listSnapshots(devUserB.id, collabProj.id);
    expect(snapshotsSeenByDevB.length).toBeGreaterThan(0);
    expect(snapshotsSeenByDevB.some((s) => s.id === snap.id)).toBe(true);

    // Both see project activities
    const activities = await projectsService.listActivities(devUserB.id, collabProj.id);
    expect(activities.some((a) => a.action === 'SNAPSHOT_CREATED' && a.user.username === devUserA.username)).toBe(true);
  });

  it('Scenario 9: A developer attempts to access an unrelated project and is denied (403/404)', async () => {
    // Admin creates private project
    const privateProj = await projectsService.createProject(adminUser.id, {
      name: 'Top Secret Research',
      mode: 'INDIVIDUAL',
    });

    // Outsider user tries to get project -> 404/denied
    await expect(projectsService.getProject(outsiderUser.id, privateProj.id)).rejects.toThrow();

    // Outsider user tries to get snapshots -> 404/denied
    await expect(snapshotsService.listSnapshots(outsiderUser.id, privateProj.id)).rejects.toThrow();
  });

  it('Scenario 10: Admin removes a member and access is immediately revoked', async () => {
    const collabProj = await projectsService.createProject(adminUser.id, {
      name: 'Dynamic Team',
      mode: 'COLLABORATIVE',
    });

    await projectsService.addMember(adminUser.id, collabProj.id, {
      emailOrUsername: devUserA.username,
      role: 'DEVELOPER',
    });

    // Dev A has access
    const accessBefore = await projectsService.getProject(devUserA.id, collabProj.id);
    expect(accessBefore.id).toBe(collabProj.id);

    // Admin removes Dev A
    const removeRes = await projectsService.removeMember(adminUser.id, collabProj.id, devUserA.id);
    expect(removeRes.removed).toBe(true);

    // Dev A access is now immediately denied
    await expect(projectsService.getProject(devUserA.id, collabProj.id)).rejects.toThrow();
  });

  it('Scenario 11: Both individual and collaborative modes continue working concurrently', async () => {
    const p1 = await projectsService.createProject(adminUser.id, {
      name: 'Personal Script',
      mode: 'INDIVIDUAL',
    });

    const p2 = await projectsService.createProject(adminUser.id, {
      name: 'Team Web App',
      mode: 'COLLABORATIVE',
    });

    await projectsService.addMember(adminUser.id, p2.id, {
      emailOrUsername: devUserA.username,
      role: 'DEVELOPER',
    });

    const adminList = await projectsService.listProjects(adminUser.id, {});
    expect(adminList.find((p) => p.id === p1.id)?.mode).toBe('INDIVIDUAL');
    expect(adminList.find((p) => p.id === p2.id)?.mode).toBe('COLLABORATIVE');

    // Admin switches p1 to collaborative
    const switched = await projectsService.switchMode(adminUser.id, p1.id, 'COLLABORATIVE');
    expect(switched.mode).toBe('COLLABORATIVE');
  });
});
