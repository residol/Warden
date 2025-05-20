import { 
  users, User, InsertUser, 
  servers, Server, InsertServer,
  wireguardPeers, WireguardPeer, InsertWireguardPeer,
  systemAlerts, SystemAlert, InsertSystemAlert,
  sessions, Session, InsertSession,
  auditLogs, AuditLog, InsertAuditLog,
  accessRequests, AccessRequest, InsertAccessRequest,
  serverAccess, ServerAccess, InsertServerAccess,
  userInvites, UserInvite, InsertUserInvite,
  discordLogs, DiscordLog, InsertDiscordLog
} from "@shared/schema";
import { db } from "./db";

// Storage interface for all CRUD operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByDiscordId(discordId: string): Promise<User | undefined>;
  getUserByPatreonId(patreonId: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Session operations
  getSession(id: number): Promise<Session | undefined>;
  getSessionsByUserId(userId: number): Promise<Session[]>;
  createSession(session: InsertSession): Promise<Session>;
  deleteSession(id: number): Promise<boolean>;
  deleteSessionsByUserId(userId: number): Promise<boolean>;
  
  // Audit log operations
  getAuditLog(id: number): Promise<AuditLog | undefined>;
  getAuditLogsByUserId(userId: number): Promise<AuditLog[]>;
  getAuditLogsByAction(action: string): Promise<AuditLog[]>;
  getRecentAuditLogs(limit: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // Access request operations
  getAccessRequest(id: number): Promise<AccessRequest | undefined>;
  getAccessRequestsByUserId(userId: number): Promise<AccessRequest[]>;
  getAccessRequestsByStatus(status: string): Promise<AccessRequest[]>;
  createAccessRequest(request: InsertAccessRequest): Promise<AccessRequest>;
  updateAccessRequest(id: number, request: Partial<AccessRequest>): Promise<AccessRequest | undefined>;
  
  // Server operations
  getServer(id: number): Promise<Server | undefined>;
  getServerByName(name: string): Promise<Server | undefined>;
  getServersByStatus(status: string): Promise<Server[]>;
  getAllServers(): Promise<Server[]>;
  createServer(server: InsertServer): Promise<Server>;
  updateServer(id: number, server: Partial<Server>): Promise<Server | undefined>;
  deleteServer(id: number): Promise<boolean>;
  
  // Server access operations
  getServerAccess(id: number): Promise<ServerAccess | undefined>;
  getServerAccessByUserAndServer(userId: number, serverId: number): Promise<ServerAccess | undefined>;
  getServerAccessesByUserId(userId: number): Promise<ServerAccess[]>;
  getServerAccessesByServerId(serverId: number): Promise<ServerAccess[]>;
  createServerAccess(access: InsertServerAccess): Promise<ServerAccess>;
  updateServerAccess(id: number, access: Partial<ServerAccess>): Promise<ServerAccess | undefined>;
  deleteServerAccess(id: number): Promise<boolean>;
  
  // WireGuard peer operations
  getWireguardPeer(id: number): Promise<WireguardPeer | undefined>;
  getWireguardPeerByPublicKey(publicKey: string): Promise<WireguardPeer | undefined>;
  getWireguardPeersByUserId(userId: number): Promise<WireguardPeer[]>;
  getWireguardPeersByStatus(status: string): Promise<WireguardPeer[]>;
  getAllWireguardPeers(): Promise<WireguardPeer[]>;
  createWireguardPeer(peer: InsertWireguardPeer): Promise<WireguardPeer>;
  updateWireguardPeer(id: number, peer: Partial<WireguardPeer>): Promise<WireguardPeer | undefined>;
  deleteWireguardPeer(id: number): Promise<boolean>;
  
  // System alert operations
  getSystemAlert(id: number): Promise<SystemAlert | undefined>;
  getUnacknowledgedSystemAlerts(): Promise<SystemAlert[]>;
  getAllSystemAlerts(): Promise<SystemAlert[]>;
  getSystemAlertsByServerId(serverId: number): Promise<SystemAlert[]>;
  createSystemAlert(alert: InsertSystemAlert): Promise<SystemAlert>;
  updateSystemAlert(id: number, alert: Partial<SystemAlert>): Promise<SystemAlert | undefined>;
  
  // User invite operations
  getUserInvite(id: number): Promise<UserInvite | undefined>;
  getUserInviteByToken(token: string): Promise<UserInvite | undefined>;
  getUserInviteByEmail(email: string): Promise<UserInvite | undefined>;
  createUserInvite(invite: InsertUserInvite): Promise<UserInvite>;
  updateUserInvite(id: number, invite: Partial<UserInvite>): Promise<UserInvite | undefined>;
  deleteUserInvite(id: number): Promise<boolean>;
  
  // Discord log operations
  getDiscordLog(id: number): Promise<DiscordLog | undefined>;
  getDiscordLogsByUserId(discordUserId: string): Promise<DiscordLog[]>;
  getRecentDiscordLogs(limit: number): Promise<DiscordLog[]>;
  createDiscordLog(log: InsertDiscordLog): Promise<DiscordLog>;
}

// Implementazione temporanea di MemStorage
export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private sessions: Map<number, Session> = new Map();
  private auditLogs: Map<number, AuditLog> = new Map();
  private accessRequests: Map<number, AccessRequest> = new Map();
  private servers: Map<number, Server> = new Map();
  private serverAccesses: Map<number, ServerAccess> = new Map();
  private wireguardPeers: Map<number, WireguardPeer> = new Map();
  private systemAlerts: Map<number, SystemAlert> = new Map();
  private userInvites: Map<number, UserInvite> = new Map();
  private discordLogs: Map<number, DiscordLog> = new Map();
  
  private userIdCounter = 1;
  private sessionIdCounter = 1;
  private auditLogIdCounter = 1;
  private accessRequestIdCounter = 1;
  private serverIdCounter = 1;
  private serverAccessIdCounter = 1;
  private peerIdCounter = 1;
  private alertIdCounter = 1;
  private inviteIdCounter = 1;
  private discordLogIdCounter = 1;

  constructor() {
    // Inizializza alcuni dati di test
    this.seedInitialData();
  }

  private seedInitialData() {
    // Aggiungi alcuni server di test
    const minecraftServer: InsertServer = {
      name: "Minecraft Survival",
      type: "minecraft",
      status: "online",
      ipAddress: "10.99.0.2",
      port: 25565,
      maxPlayers: 20,
      pterodactylId: "1"
    };
    
    const rustServer: InsertServer = {
      name: "Rust",
      type: "rust",
      status: "online",
      ipAddress: "10.99.0.3",
      port: 28015,
      maxPlayers: 50,
      pterodactylId: "2"
    };
    
    this.createServer(minecraftServer);
    this.createServer(rustServer);
  }

  // Implementazione delle funzioni dell'interfaccia IStorage
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async getUserByDiscordId(discordId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.discordId === discordId);
  }

  async getUserByPatreonId(patreonId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.patreonId === patreonId);
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(u => u.role === role);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = {
      ...userData,
      id,
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
      discordId: userData.discordId || null,
      isVerified: userData.isVerified || null,
      profileImageUrl: userData.profileImageUrl || null,
      patreonId: userData.patreonId || null,
      patreonTier: null,
      role: userData.role || 'member'
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
  
  // Session operations
  async getSession(id: number): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getSessionsByUserId(userId: number): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  async createSession(sessionData: InsertSession): Promise<Session> {
    const id = this.sessionIdCounter++;
    const session: Session = {
      ...sessionData,
      id,
      createdAt: new Date()
    };
    this.sessions.set(id, session);
    return session;
  }

  async deleteSession(id: number): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async deleteSessionsByUserId(userId: number): Promise<boolean> {
    const sessions = await this.getSessionsByUserId(userId);
    sessions.forEach(s => this.sessions.delete(s.id));
    return true;
  }
  
  // Audit log operations
  async getAuditLog(id: number): Promise<AuditLog | undefined> {
    return this.auditLogs.get(id);
  }

  async getAuditLogsByUserId(userId: number): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values()).filter(l => l.userId === userId);
  }

  async getAuditLogsByAction(action: string): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values()).filter(l => l.action === action);
  }

  async getRecentAuditLogs(limit: number): Promise<AuditLog[]> {
    return Array.from(this.auditLogs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createAuditLog(logData: InsertAuditLog): Promise<AuditLog> {
    const id = this.auditLogIdCounter++;
    const log: AuditLog = {
      ...logData,
      id,
      createdAt: new Date()
    };
    this.auditLogs.set(id, log);
    return log;
  }
  
  // Access request operations
  async getAccessRequest(id: number): Promise<AccessRequest | undefined> {
    return this.accessRequests.get(id);
  }

  async getAccessRequestsByUserId(userId: number): Promise<AccessRequest[]> {
    return Array.from(this.accessRequests.values()).filter(r => r.userId === userId);
  }

  async getAccessRequestsByStatus(status: string): Promise<AccessRequest[]> {
    return Array.from(this.accessRequests.values()).filter(r => r.status === status);
  }

  async createAccessRequest(requestData: InsertAccessRequest): Promise<AccessRequest> {
    const id = this.accessRequestIdCounter++;
    const request: AccessRequest = {
      ...requestData,
      id,
      createdAt: new Date(),
      reviewedAt: null
    };
    this.accessRequests.set(id, request);
    return request;
  }

  async updateAccessRequest(id: number, requestData: Partial<AccessRequest>): Promise<AccessRequest | undefined> {
    const request = await this.getAccessRequest(id);
    if (!request) return undefined;
    
    const updatedRequest = { ...request, ...requestData };
    this.accessRequests.set(id, updatedRequest);
    return updatedRequest;
  }
  
  // Server operations
  async getServer(id: number): Promise<Server | undefined> {
    return this.servers.get(id);
  }

  async getServerByName(name: string): Promise<Server | undefined> {
    return Array.from(this.servers.values()).find(s => s.name === name);
  }

  async getServersByStatus(status: string): Promise<Server[]> {
    return Array.from(this.servers.values()).filter(s => s.status === status);
  }

  async getAllServers(): Promise<Server[]> {
    return Array.from(this.servers.values());
  }

  async createServer(serverData: InsertServer): Promise<Server> {
    const id = this.serverIdCounter++;
    const now = new Date();
    const server: Server = {
      ...serverData,
      id,
      createdAt: now,
      updatedAt: now,
      currentPlayers: 0,
      uptime: "0d 0h 0m",
      playerList: [],
      // Assicuriamoci che tutti i campi obbligatori siano definiti con valori predefiniti
      status: serverData.status || 'offline',
      maxPlayers: serverData.maxPlayers || null,
      dockerId: serverData.dockerId || null,
      pterodactylId: serverData.pterodactylId || null
    };
    this.servers.set(id, server);
    return server;
  }

  async updateServer(id: number, serverData: Partial<Server>): Promise<Server | undefined> {
    const server = await this.getServer(id);
    if (!server) return undefined;
    
    const updatedServer = { ...server, ...serverData, updatedAt: new Date() };
    this.servers.set(id, updatedServer);
    return updatedServer;
  }

  async deleteServer(id: number): Promise<boolean> {
    return this.servers.delete(id);
  }
  
  // Server access operations
  async getServerAccess(id: number): Promise<ServerAccess | undefined> {
    return this.serverAccesses.get(id);
  }

  async getServerAccessByUserAndServer(userId: number, serverId: number): Promise<ServerAccess | undefined> {
    return Array.from(this.serverAccesses.values()).find(
      a => a.userId === userId && a.serverId === serverId
    );
  }

  async getServerAccessesByUserId(userId: number): Promise<ServerAccess[]> {
    return Array.from(this.serverAccesses.values()).filter(a => a.userId === userId);
  }

  async getServerAccessesByServerId(serverId: number): Promise<ServerAccess[]> {
    return Array.from(this.serverAccesses.values()).filter(a => a.serverId === serverId);
  }

  async createServerAccess(accessData: InsertServerAccess): Promise<ServerAccess> {
    const id = this.serverAccessIdCounter++;
    const access: ServerAccess = {
      ...accessData,
      id,
      createdAt: new Date()
    };
    this.serverAccesses.set(id, access);
    return access;
  }

  async updateServerAccess(id: number, accessData: Partial<ServerAccess>): Promise<ServerAccess | undefined> {
    const access = await this.getServerAccess(id);
    if (!access) return undefined;
    
    const updatedAccess = { ...access, ...accessData };
    this.serverAccesses.set(id, updatedAccess);
    return updatedAccess;
  }

  async deleteServerAccess(id: number): Promise<boolean> {
    return this.serverAccesses.delete(id);
  }
  
  // WireGuard peer operations
  async getWireguardPeer(id: number): Promise<WireguardPeer | undefined> {
    return this.wireguardPeers.get(id);
  }

  async getWireguardPeerByPublicKey(publicKey: string): Promise<WireguardPeer | undefined> {
    return Array.from(this.wireguardPeers.values()).find(p => p.publicKey === publicKey);
  }

  async getWireguardPeersByUserId(userId: number): Promise<WireguardPeer[]> {
    return Array.from(this.wireguardPeers.values()).filter(p => p.userId === userId);
  }

  async getWireguardPeersByStatus(status: string): Promise<WireguardPeer[]> {
    return Array.from(this.wireguardPeers.values()).filter(p => p.status === status);
  }

  async getAllWireguardPeers(): Promise<WireguardPeer[]> {
    return Array.from(this.wireguardPeers.values());
  }

  async createWireguardPeer(peerData: InsertWireguardPeer): Promise<WireguardPeer> {
    const id = this.peerIdCounter++;
    const now = new Date();
    const peer: WireguardPeer = {
      ...peerData,
      id,
      createdAt: now,
      updatedAt: now,
      lastHandshake: null,
      transferRx: 0,
      transferTx: 0,
      totalConnections: 0,
      lastConnectionDuration: null,
      isOnline: false,
      approvedBy: null,
      approvedAt: null
    };
    this.wireguardPeers.set(id, peer);
    return peer;
  }

  async updateWireguardPeer(id: number, peerData: Partial<WireguardPeer>): Promise<WireguardPeer | undefined> {
    const peer = await this.getWireguardPeer(id);
    if (!peer) return undefined;
    
    const updatedPeer = { ...peer, ...peerData, updatedAt: new Date() };
    this.wireguardPeers.set(id, updatedPeer);
    return updatedPeer;
  }

  async deleteWireguardPeer(id: number): Promise<boolean> {
    return this.wireguardPeers.delete(id);
  }
  
  // System alert operations
  async getSystemAlert(id: number): Promise<SystemAlert | undefined> {
    return this.systemAlerts.get(id);
  }

  async getUnacknowledgedSystemAlerts(): Promise<SystemAlert[]> {
    return Array.from(this.systemAlerts.values()).filter(a => !a.acknowledged);
  }

  async getAllSystemAlerts(): Promise<SystemAlert[]> {
    return Array.from(this.systemAlerts.values());
  }

  async getSystemAlertsByServerId(serverId: number): Promise<SystemAlert[]> {
    return Array.from(this.systemAlerts.values()).filter(a => a.serverId === serverId);
  }

  async createSystemAlert(alertData: InsertSystemAlert): Promise<SystemAlert> {
    const id = this.alertIdCounter++;
    const alert: SystemAlert = {
      ...alertData,
      id,
      createdAt: new Date(),
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null
    };
    this.systemAlerts.set(id, alert);
    return alert;
  }

  async updateSystemAlert(id: number, alertData: Partial<SystemAlert>): Promise<SystemAlert | undefined> {
    const alert = await this.getSystemAlert(id);
    if (!alert) return undefined;
    
    const updatedAlert = { ...alert, ...alertData };
    this.systemAlerts.set(id, updatedAlert);
    return updatedAlert;
  }
  
  // User invite operations
  async getUserInvite(id: number): Promise<UserInvite | undefined> {
    return this.userInvites.get(id);
  }

  async getUserInviteByToken(token: string): Promise<UserInvite | undefined> {
    return Array.from(this.userInvites.values()).find(i => i.token === token);
  }

  async getUserInviteByEmail(email: string): Promise<UserInvite | undefined> {
    return Array.from(this.userInvites.values()).find(i => i.email === email);
  }

  async createUserInvite(inviteData: InsertUserInvite): Promise<UserInvite> {
    const id = this.inviteIdCounter++;
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const invite: UserInvite = {
      ...inviteData,
      id,
      token,
      createdAt: new Date(),
      usedAt: null
    };
    this.userInvites.set(id, invite);
    return invite;
  }

  async updateUserInvite(id: number, inviteData: Partial<UserInvite>): Promise<UserInvite | undefined> {
    const invite = await this.getUserInvite(id);
    if (!invite) return undefined;
    
    const updatedInvite = { ...invite, ...inviteData };
    this.userInvites.set(id, updatedInvite);
    return updatedInvite;
  }

  async deleteUserInvite(id: number): Promise<boolean> {
    return this.userInvites.delete(id);
  }
  
  // Discord log operations
  async getDiscordLog(id: number): Promise<DiscordLog | undefined> {
    return this.discordLogs.get(id);
  }

  async getDiscordLogsByUserId(discordUserId: string): Promise<DiscordLog[]> {
    return Array.from(this.discordLogs.values()).filter(l => l.discordUserId === discordUserId);
  }

  async getRecentDiscordLogs(limit: number): Promise<DiscordLog[]> {
    return Array.from(this.discordLogs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createDiscordLog(logData: InsertDiscordLog): Promise<DiscordLog> {
    const id = this.discordLogIdCounter++;
    const log: DiscordLog = {
      ...logData,
      id,
      createdAt: new Date()
    };
    this.discordLogs.set(id, log);
    return log;
  }
}

// Crea un'istanza dello storage (usa MemStorage in assenza di database)
export const storage = new MemStorage();
