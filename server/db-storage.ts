import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from './db';
import { 
  users, User, InsertUser, 
  servers, Server, InsertServer,
  wireguardPeers, WireguardPeer, InsertWireguardPeer,
  systemAlerts, SystemAlert, InsertSystemAlert,
  userInvites, UserInvite
} from "@shared/schema";

// Implementazione di storage minima per far funzionare l'applicazione
export class DbStorage {
  
  // ---------- User methods ----------
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(userData: InsertUser): Promise<User> {
    const now = new Date();
    const [user] = await db.insert(users).values({
      ...userData,
      createdAt: now,
      updatedAt: now
    }).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set({
        ...userData,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // ---------- Server methods ----------
  async getServer(id: number): Promise<Server | undefined> {
    const [server] = await db.select().from(servers).where(eq(servers.id, id));
    return server;
  }

  async getAllServers(): Promise<Server[]> {
    return db.select().from(servers);
  }

  async getServersByStatus(status: string): Promise<Server[]> {
    return db.select().from(servers).where(eq(servers.status, status));
  }

  async createServer(serverData: InsertServer): Promise<Server> {
    const now = new Date();
    const [server] = await db.insert(servers).values({
      ...serverData,
      createdAt: now,
      updatedAt: now
    }).returning();
    return server;
  }

  async updateServer(id: number, serverData: Partial<Server>): Promise<Server | undefined> {
    const [updatedServer] = await db.update(servers)
      .set({
        ...serverData,
        updatedAt: new Date()
      })
      .where(eq(servers.id, id))
      .returning();
    return updatedServer;
  }

  // ---------- WireGuard peer methods ----------
  async getWireguardPeer(id: number): Promise<WireguardPeer | undefined> {
    const [peer] = await db.select().from(wireguardPeers).where(eq(wireguardPeers.id, id));
    return peer;
  }

  async getWireguardPeerByPublicKey(publicKey: string): Promise<WireguardPeer | undefined> {
    const [peer] = await db.select().from(wireguardPeers).where(eq(wireguardPeers.publicKey, publicKey));
    return peer;
  }

  async getWireguardPeersByUserId(userId: number): Promise<WireguardPeer[]> {
    return db.select().from(wireguardPeers).where(eq(wireguardPeers.userId, userId));
  }

  async getAllWireguardPeers(): Promise<WireguardPeer[]> {
    return db.select().from(wireguardPeers);
  }

  async createWireguardPeer(peerData: InsertWireguardPeer): Promise<WireguardPeer> {
    const now = new Date();
    const [peer] = await db.insert(wireguardPeers).values({
      ...peerData,
      createdAt: now,
      updatedAt: now
    }).returning();
    return peer;
  }

  async updateWireguardPeer(id: number, peerData: Partial<WireguardPeer>): Promise<WireguardPeer | undefined> {
    const [updatedPeer] = await db.update(wireguardPeers)
      .set({
        ...peerData,
        updatedAt: new Date()
      })
      .where(eq(wireguardPeers.id, id))
      .returning();
    return updatedPeer;
  }

  // ---------- System alert methods ----------
  async getSystemAlert(id: number): Promise<SystemAlert | undefined> {
    const [alert] = await db.select().from(systemAlerts).where(eq(systemAlerts.id, id));
    return alert;
  }

  async getUnacknowledgedSystemAlerts(): Promise<SystemAlert[]> {
    return db.select().from(systemAlerts).where(eq(systemAlerts.acknowledged, false));
  }

  async getAllSystemAlerts(): Promise<SystemAlert[]> {
    return db.select().from(systemAlerts);
  }

  async createSystemAlert(alertData: InsertSystemAlert): Promise<SystemAlert> {
    const [alert] = await db.insert(systemAlerts).values({
      ...alertData,
      createdAt: new Date()
    }).returning();
    return alert;
  }

  async updateSystemAlert(id: number, alertData: Partial<SystemAlert>): Promise<SystemAlert | undefined> {
    const [updatedAlert] = await db.update(systemAlerts)
      .set(alertData)
      .where(eq(systemAlerts.id, id))
      .returning();
    return updatedAlert;
  }

  // ---------- User Invite methods ----------
  async getUserInviteByEmail(email: string): Promise<UserInvite | undefined> {
    const [invite] = await db.select().from(userInvites).where(eq(userInvites.email, email));
    return invite;
  }

  async getUserInviteByToken(token: string): Promise<UserInvite | undefined> {
    const [invite] = await db.select().from(userInvites).where(eq(userInvites.token, token));
    return invite;
  }

  async createUserInvite(inviteData: any): Promise<UserInvite | undefined> {
    try {
      const [invite] = await db.insert(userInvites).values({
        email: inviteData.email,
        token: inviteData.token,
        role: inviteData.role,
        expiresAt: inviteData.expiresAt,
        createdBy: inviteData.createdBy
      }).returning();
      return invite;
    } catch (error) {
      console.error('Errore durante la creazione dell\'invito:', error);
      return undefined;
    }
  }

  async updateUserInvite(id: number, inviteData: Partial<UserInvite>): Promise<UserInvite | undefined> {
    try {
      const [updatedInvite] = await db.update(userInvites)
        .set(inviteData)
        .where(eq(userInvites.id, id))
        .returning();
      return updatedInvite;
    } catch (error) {
      console.error('Errore durante l\'aggiornamento dell\'invito:', error);
      return undefined;
    }
  }
}