import { 
  userRoleEnum,
  type User, 
  type InsertUser,
  type Server,
  type InsertServer,
  type WireguardPeer,
  type InsertWireguardPeer,
  type SystemAlert,
  type InsertSystemAlert,
  type UserInvite,
  type InsertUserInvite
} from '@shared/schema';

// Interfaccia per lo storage
export interface IStorage {
  // Operazioni utente
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(userData: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;

  // Operazioni server
  getServer(id: number): Promise<Server | undefined>;
  getAllServers(): Promise<Server[]>;
  getServersByStatus(status: string): Promise<Server[]>;
  createServer(serverData: InsertServer): Promise<Server>;
  updateServer(id: number, serverData: Partial<Server>): Promise<Server | undefined>;

  // Operazioni WireGuard
  getWireguardPeer(id: number): Promise<WireguardPeer | undefined>;
  getWireguardPeerByPublicKey(publicKey: string): Promise<WireguardPeer | undefined>;
  getWireguardPeersByUserId(userId: number): Promise<WireguardPeer[]>;
  getAllWireguardPeers(): Promise<WireguardPeer[]>;
  createWireguardPeer(peerData: InsertWireguardPeer): Promise<WireguardPeer>;
  updateWireguardPeer(id: number, peerData: Partial<WireguardPeer>): Promise<WireguardPeer | undefined>;

  // Operazioni di avviso di sistema
  getSystemAlert(id: number): Promise<SystemAlert | undefined>;
  getUnacknowledgedSystemAlerts(): Promise<SystemAlert[]>;
  getAllSystemAlerts(): Promise<SystemAlert[]>;
  createSystemAlert(alertData: InsertSystemAlert): Promise<SystemAlert>;
  updateSystemAlert(id: number, alertData: Partial<SystemAlert>): Promise<SystemAlert | undefined>;

  // Operazioni invito utente
  getUserInviteByEmail(email: string): Promise<UserInvite | undefined>;
  getUserInviteByToken(token: string): Promise<UserInvite | undefined>;
  createUserInvite(inviteData: InsertUserInvite): Promise<UserInvite>;
  updateUserInvite(id: number, inviteData: Partial<UserInvite>): Promise<UserInvite | undefined>;
}

// Implementazione in memoria per lo storage (versione semplificata)
export class DbStorage implements IStorage {
  private users: User[] = [];
  private servers: Server[] = [];
  private wireguardPeers: WireguardPeer[] = [];
  private systemAlerts: SystemAlert[] = [];
  private userInvites: UserInvite[] = [];
  private nextUserId = 1;
  private nextServerId = 1;
  private nextWireguardPeerId = 1;
  private nextSystemAlertId = 1;
  private nextUserInviteId = 1;

  constructor() {
    // Utente admin predefinito per scopi di test
    this.users.push({
      id: this.nextUserId++,
      username: 'admin',
      email: 'admin@example.com',
      password: '$2b$10$5Z.fLNuSQLv.wqG9KpUfzON2BTZL0wLFXkqnKvKCpF3H2oaXTg8F2', // 'password'
      role: 'admin',
      discordId: null,
      isVerified: true,
      profileImageUrl: null,
      patreonId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null
    });

    // Utente moderatore predefinito
    this.users.push({
      id: this.nextUserId++,
      username: 'moderator',
      email: 'mod@example.com',
      password: '$2b$10$5Z.fLNuSQLv.wqG9KpUfzON2BTZL0wLFXkqnKvKCpF3H2oaXTg8F2', // 'password'
      role: 'moderator',
      discordId: null,
      isVerified: true,
      profileImageUrl: null,
      patreonId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null
    });

    // Server di test
    this.servers.push({
      id: this.nextServerId++,
      name: 'Minecraft Server',
      type: 'minecraft',
      status: 'online',
      ipAddress: '10.0.0.2',
      port: 25565,
      maxPlayers: 20,
      currentPlayers: 5,
      uptime: '2 days',
      dockerId: 'abc123',
      pterodactylId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      playerList: ['player1', 'player2', 'player3', 'player4', 'player5']
    });
  }

  // Implementazione delle operazioni utente
  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find(user => user.email === email);
  }

  async getAllUsers(): Promise<User[]> {
    return [...this.users];
  }

  async createUser(userData: InsertUser): Promise<User> {
    const now = new Date();
    const newUser: User = {
      id: this.nextUserId++,
      username: userData.username,
      email: userData.email,
      password: userData.password,
      role: userData.role || 'member',
      discordId: userData.discordId || null,
      isVerified: userData.isVerified || false,
      profileImageUrl: userData.profileImageUrl || null,
      patreonId: userData.patreonId || null,
      createdAt: now,
      updatedAt: now,
      lastLogin: null
    };
    this.users.push(newUser);
    return newUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return undefined;

    const updatedUser = {
      ...this.users[userIndex],
      ...userData,
      updatedAt: new Date()
    };
    
    this.users[userIndex] = updatedUser;
    return updatedUser;
  }

  // Implementazione delle operazioni server
  async getServer(id: number): Promise<Server | undefined> {
    return this.servers.find(server => server.id === id);
  }

  async getAllServers(): Promise<Server[]> {
    return [...this.servers];
  }

  async getServersByStatus(status: string): Promise<Server[]> {
    return this.servers.filter(server => server.status === status);
  }

  async createServer(serverData: InsertServer): Promise<Server> {
    const now = new Date();
    const newServer: Server = {
      id: this.nextServerId++,
      name: serverData.name,
      type: serverData.type,
      status: serverData.status,
      ipAddress: serverData.ipAddress,
      port: serverData.port,
      maxPlayers: serverData.maxPlayers || null,
      currentPlayers: serverData.currentPlayers || 0,
      uptime: serverData.uptime || null,
      dockerId: serverData.dockerId || null,
      pterodactylId: serverData.pterodactylId || null,
      createdAt: now,
      updatedAt: now,
      playerList: serverData.playerList || []
    };
    this.servers.push(newServer);
    return newServer;
  }

  async updateServer(id: number, serverData: Partial<Server>): Promise<Server | undefined> {
    const serverIndex = this.servers.findIndex(server => server.id === id);
    if (serverIndex === -1) return undefined;

    const updatedServer = {
      ...this.servers[serverIndex],
      ...serverData,
      updatedAt: new Date()
    };
    
    this.servers[serverIndex] = updatedServer;
    return updatedServer;
  }

  // Implementazione delle operazioni WireGuard
  async getWireguardPeer(id: number): Promise<WireguardPeer | undefined> {
    return this.wireguardPeers.find(peer => peer.id === id);
  }

  async getWireguardPeerByPublicKey(publicKey: string): Promise<WireguardPeer | undefined> {
    return this.wireguardPeers.find(peer => peer.publicKey === publicKey);
  }

  async getWireguardPeersByUserId(userId: number): Promise<WireguardPeer[]> {
    return this.wireguardPeers.filter(peer => peer.userId === userId);
  }

  async getAllWireguardPeers(): Promise<WireguardPeer[]> {
    return [...this.wireguardPeers];
  }

  async createWireguardPeer(peerData: InsertWireguardPeer): Promise<WireguardPeer> {
    const now = new Date();
    const newPeer: WireguardPeer = {
      id: this.nextWireguardPeerId++,
      name: peerData.name,
      publicKey: peerData.publicKey,
      allowedIps: peerData.allowedIps,
      status: peerData.status || 'pending',
      description: peerData.description || null,
      userId: peerData.userId || null,
      createdBy: peerData.createdBy || null,
      enabled: peerData.enabled || true,
      privateKey: peerData.privateKey || null,
      presharedKey: peerData.presharedKey || null,
      assignedIp: peerData.assignedIp || null,
      lastConnectionIp: null,
      isOnline: false,
      totalConnections: 0,
      lastHandshake: null,
      lastConnectionDuration: null,
      transferRx: 0,
      transferTx: 0,
      createdAt: now,
      updatedAt: now,
      approvedAt: null,
      approvedBy: null
    };
    this.wireguardPeers.push(newPeer);
    return newPeer;
  }

  async updateWireguardPeer(id: number, peerData: Partial<WireguardPeer>): Promise<WireguardPeer | undefined> {
    const peerIndex = this.wireguardPeers.findIndex(peer => peer.id === id);
    if (peerIndex === -1) return undefined;

    const updatedPeer = {
      ...this.wireguardPeers[peerIndex],
      ...peerData,
      updatedAt: new Date()
    };
    
    this.wireguardPeers[peerIndex] = updatedPeer;
    return updatedPeer;
  }

  // Implementazione delle operazioni di avviso di sistema
  async getSystemAlert(id: number): Promise<SystemAlert | undefined> {
    return this.systemAlerts.find(alert => alert.id === id);
  }

  async getUnacknowledgedSystemAlerts(): Promise<SystemAlert[]> {
    return this.systemAlerts.filter(alert => !alert.acknowledged);
  }

  async getAllSystemAlerts(): Promise<SystemAlert[]> {
    return [...this.systemAlerts];
  }

  async createSystemAlert(alertData: InsertSystemAlert): Promise<SystemAlert> {
    const now = new Date();
    const newAlert: SystemAlert = {
      id: this.nextSystemAlertId++,
      type: alertData.type,
      message: alertData.message,
      serverId: alertData.serverId || null,
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      createdAt: now
    };
    this.systemAlerts.push(newAlert);
    return newAlert;
  }

  async updateSystemAlert(id: number, alertData: Partial<SystemAlert>): Promise<SystemAlert | undefined> {
    const alertIndex = this.systemAlerts.findIndex(alert => alert.id === id);
    if (alertIndex === -1) return undefined;

    const updatedAlert = {
      ...this.systemAlerts[alertIndex],
      ...alertData,
    };
    
    this.systemAlerts[alertIndex] = updatedAlert;
    return updatedAlert;
  }

  // Implementazione delle operazioni invito utente
  async getUserInviteByEmail(email: string): Promise<UserInvite | undefined> {
    return this.userInvites.find(invite => invite.email === email);
  }

  async getUserInviteByToken(token: string): Promise<UserInvite | undefined> {
    return this.userInvites.find(invite => invite.token === token);
  }

  async createUserInvite(inviteData: InsertUserInvite): Promise<UserInvite> {
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Scade dopo 7 giorni

    const newInvite: UserInvite = {
      id: this.nextUserInviteId++,
      email: inviteData.email,
      token: inviteData.token,
      role: inviteData.role || 'member',
      createdBy: inviteData.createdBy,
      expiresAt: inviteData.expiresAt || expiresAt,
      usedAt: null,
      createdAt: now
    };
    this.userInvites.push(newInvite);
    return newInvite;
  }

  async updateUserInvite(id: number, inviteData: Partial<UserInvite>): Promise<UserInvite | undefined> {
    const inviteIndex = this.userInvites.findIndex(invite => invite.id === id);
    if (inviteIndex === -1) return undefined;

    const updatedInvite = {
      ...this.userInvites[inviteIndex],
      ...inviteData,
    };
    
    this.userInvites[inviteIndex] = updatedInvite;
    return updatedInvite;
  }
}

// Esporta un'istanza dello storage
export const storage = new DbStorage();