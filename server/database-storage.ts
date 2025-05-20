import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { 
  users, 
  sessions, 
  auditLogs, 
  accessRequests, 
  servers, 
  wireguardPeers, 
  systemAlerts, 
  serverAccess, 
  userInvites, 
  discordLogs,
  type User, 
  type InsertUser,
  type Session,
  type InsertSession,
  type AuditLog,
  type InsertAuditLog,
  type AccessRequest,
  type InsertAccessRequest,
  type Server,
  type InsertServer,
  type WireguardPeer,
  type InsertWireguardPeer,
  type SystemAlert,
  type InsertSystemAlert,
  type ServerAccess,
  type InsertServerAccess,
  type UserInvite,
  type InsertUserInvite,
  type DiscordLog,
  type InsertDiscordLog
} from '@shared/schema';

// Implementazione dello storage con database PostgreSQL
export class DatabaseStorage {
  // Operazioni utente
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getUserByDiscordId(discordId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.discordId, discordId)).limit(1);
    return result[0];
  }

  async getUserByPatreonId(patreonId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.patreonId, patreonId)).limit(1);
    return result[0];
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(sql`${users.role} = ${role}`);
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Operazioni sessione
  async getSession(id: number): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0];
  }

  async getSessionsByUserId(userId: number): Promise<Session[]> {
    return await db.select().from(sessions).where(eq(sessions.userId, userId));
  }

  async createSession(sessionData: InsertSession): Promise<Session> {
    const result = await db.insert(sessions).values(sessionData).returning();
    return result[0];
  }

  async deleteSession(id: number): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, id)).returning();
    return result.length > 0;
  }

  async deleteSessionsByUserId(userId: number): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.userId, userId)).returning();
    return result.length > 0;
  }

  // Operazioni log di audit
  async getAuditLog(id: number): Promise<AuditLog | undefined> {
    const result = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
    return result[0];
  }

  async getAuditLogsByUserId(userId: number): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).where(eq(auditLogs.userId, userId));
  }

  async getAuditLogsByAction(action: string): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).where(eq(auditLogs.action, action));
  }

  async getRecentAuditLogs(limit: number): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(sql`${auditLogs.createdAt} DESC`).limit(limit);
  }

  async createAuditLog(logData: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(logData).returning();
    return result[0];
  }

  // Operazioni richieste di accesso
  async getAccessRequest(id: number): Promise<AccessRequest | undefined> {
    const result = await db.select().from(accessRequests).where(eq(accessRequests.id, id)).limit(1);
    return result[0];
  }

  async getAccessRequestsByUserId(userId: number): Promise<AccessRequest[]> {
    return await db.select().from(accessRequests).where(eq(accessRequests.userId, userId));
  }

  async getAccessRequestsByStatus(status: string): Promise<AccessRequest[]> {
    return await db.select().from(accessRequests).where(eq(accessRequests.status, status));
  }

  async createAccessRequest(requestData: InsertAccessRequest): Promise<AccessRequest> {
    const result = await db.insert(accessRequests).values(requestData).returning();
    return result[0];
  }

  async updateAccessRequest(id: number, requestData: Partial<AccessRequest>): Promise<AccessRequest | undefined> {
    const result = await db.update(accessRequests)
      .set(requestData)
      .where(eq(accessRequests.id, id))
      .returning();
    return result[0];
  }

  // Operazioni server
  async getServer(id: number): Promise<Server | undefined> {
    const result = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
    return result[0];
  }

  async getServerByName(name: string): Promise<Server | undefined> {
    const result = await db.select().from(servers).where(eq(servers.name, name)).limit(1);
    return result[0];
  }

  async getServersByStatus(status: string): Promise<Server[]> {
    return await db.select().from(servers).where(eq(servers.status, status));
  }

  async getAllServers(): Promise<Server[]> {
    return await db.select().from(servers);
  }

  async createServer(serverData: InsertServer): Promise<Server> {
    const result = await db.insert(servers).values(serverData).returning();
    return result[0];
  }

  async updateServer(id: number, serverData: Partial<Server>): Promise<Server | undefined> {
    const result = await db.update(servers)
      .set({ ...serverData, updatedAt: new Date() })
      .where(eq(servers.id, id))
      .returning();
    return result[0];
  }

  async deleteServer(id: number): Promise<boolean> {
    const result = await db.delete(servers).where(eq(servers.id, id)).returning();
    return result.length > 0;
  }

  // Operazioni accesso ai server
  async getServerAccess(id: number): Promise<ServerAccess | undefined> {
    const result = await db.select().from(serverAccess).where(eq(serverAccess.id, id)).limit(1);
    return result[0];
  }

  async getServerAccessByUserAndServer(userId: number, serverId: number): Promise<ServerAccess | undefined> {
    const result = await db.select()
      .from(serverAccess)
      .where(sql`${serverAccess.userId} = ${userId} AND ${serverAccess.serverId} = ${serverId}`)
      .limit(1);
    return result[0];
  }

  async getServerAccessesByUserId(userId: number): Promise<ServerAccess[]> {
    return await db.select().from(serverAccess).where(eq(serverAccess.userId, userId));
  }

  async getServerAccessesByServerId(serverId: number): Promise<ServerAccess[]> {
    return await db.select().from(serverAccess).where(eq(serverAccess.serverId, serverId));
  }

  async createServerAccess(accessData: InsertServerAccess): Promise<ServerAccess> {
    const result = await db.insert(serverAccess).values(accessData).returning();
    return result[0];
  }

  async updateServerAccess(id: number, accessData: Partial<ServerAccess>): Promise<ServerAccess | undefined> {
    const result = await db.update(serverAccess)
      .set(accessData)
      .where(eq(serverAccess.id, id))
      .returning();
    return result[0];
  }

  async deleteServerAccess(id: number): Promise<boolean> {
    const result = await db.delete(serverAccess).where(eq(serverAccess.id, id)).returning();
    return result.length > 0;
  }

  // Operazioni peer WireGuard
  async getWireguardPeer(id: number): Promise<WireguardPeer | undefined> {
    const result = await db.select().from(wireguardPeers).where(eq(wireguardPeers.id, id)).limit(1);
    return result[0];
  }

  async getWireguardPeerByPublicKey(publicKey: string): Promise<WireguardPeer | undefined> {
    const result = await db.select().from(wireguardPeers).where(eq(wireguardPeers.publicKey, publicKey)).limit(1);
    return result[0];
  }

  async getWireguardPeersByUserId(userId: number): Promise<WireguardPeer[]> {
    return await db.select().from(wireguardPeers).where(eq(wireguardPeers.userId, userId));
  }

  async getWireguardPeersByStatus(status: string): Promise<WireguardPeer[]> {
    return await db.select().from(wireguardPeers).where(eq(wireguardPeers.status, status));
  }

  async getAllWireguardPeers(): Promise<WireguardPeer[]> {
    return await db.select().from(wireguardPeers);
  }

  async createWireguardPeer(peerData: InsertWireguardPeer): Promise<WireguardPeer> {
    const result = await db.insert(wireguardPeers).values(peerData).returning();
    return result[0];
  }

  async updateWireguardPeer(id: number, peerData: Partial<WireguardPeer>): Promise<WireguardPeer | undefined> {
    const result = await db.update(wireguardPeers)
      .set({ ...peerData, updatedAt: new Date() })
      .where(eq(wireguardPeers.id, id))
      .returning();
    return result[0];
  }

  async deleteWireguardPeer(id: number): Promise<boolean> {
    const result = await db.delete(wireguardPeers).where(eq(wireguardPeers.id, id)).returning();
    return result.length > 0;
  }

  // Operazioni avvisi di sistema
  async getSystemAlert(id: number): Promise<SystemAlert | undefined> {
    const result = await db.select().from(systemAlerts).where(eq(systemAlerts.id, id)).limit(1);
    return result[0];
  }

  async getUnacknowledgedSystemAlerts(): Promise<SystemAlert[]> {
    return await db.select().from(systemAlerts).where(eq(systemAlerts.acknowledged, false));
  }

  async getAllSystemAlerts(): Promise<SystemAlert[]> {
    return await db.select().from(systemAlerts);
  }

  async getSystemAlertsByServerId(serverId: number): Promise<SystemAlert[]> {
    return await db.select().from(systemAlerts).where(eq(systemAlerts.serverId, serverId));
  }

  async createSystemAlert(alertData: InsertSystemAlert): Promise<SystemAlert> {
    const result = await db.insert(systemAlerts).values(alertData).returning();
    return result[0];
  }

  async updateSystemAlert(id: number, alertData: Partial<SystemAlert>): Promise<SystemAlert | undefined> {
    const result = await db.update(systemAlerts)
      .set(alertData)
      .where(eq(systemAlerts.id, id))
      .returning();
    return result[0];
  }

  // Operazioni inviti utente
  async getUserInvite(id: number): Promise<UserInvite | undefined> {
    const result = await db.select().from(userInvites).where(eq(userInvites.id, id)).limit(1);
    return result[0];
  }

  async getUserInviteByToken(token: string): Promise<UserInvite | undefined> {
    const result = await db.select().from(userInvites).where(eq(userInvites.token, token)).limit(1);
    return result[0];
  }

  async getUserInviteByEmail(email: string): Promise<UserInvite | undefined> {
    const result = await db.select().from(userInvites).where(eq(userInvites.email, email)).limit(1);
    return result[0];
  }

  async createUserInvite(inviteData: any): Promise<UserInvite> {
    const result = await db.insert(userInvites).values({
      email: inviteData.email,
      token: inviteData.token,
      role: inviteData.role || 'member',
      expiresAt: inviteData.expiresAt,
      createdBy: inviteData.createdBy,
    }).returning();
    return result[0];
  }

  async updateUserInvite(id: number, inviteData: Partial<UserInvite>): Promise<UserInvite | undefined> {
    const result = await db.update(userInvites)
      .set(inviteData)
      .where(eq(userInvites.id, id))
      .returning();
    return result[0];
  }

  async deleteUserInvite(id: number): Promise<boolean> {
    const result = await db.delete(userInvites).where(eq(userInvites.id, id)).returning();
    return result.length > 0;
  }

  // Operazioni log Discord
  async getDiscordLog(id: number): Promise<DiscordLog | undefined> {
    const result = await db.select().from(discordLogs).where(eq(discordLogs.id, id)).limit(1);
    return result[0];
  }

  async getDiscordLogsByUserId(discordUserId: string): Promise<DiscordLog[]> {
    return await db.select().from(discordLogs).where(eq(discordLogs.discordUserId, discordUserId));
  }

  async getRecentDiscordLogs(limit: number): Promise<DiscordLog[]> {
    return await db.select().from(discordLogs).orderBy(sql`${discordLogs.createdAt} DESC`).limit(limit);
  }

  async createDiscordLog(logData: InsertDiscordLog): Promise<DiscordLog> {
    const result = await db.insert(discordLogs).values(logData).returning();
    return result[0];
  }
}

// Esporta un'istanza dello storage
export const databaseStorage = new DatabaseStorage();