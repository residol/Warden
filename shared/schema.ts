import { 
  pgTable, 
  serial, 
  text, 
  varchar, 
  timestamp, 
  boolean, 
  integer, 
  json, 
  jsonb, 
  index,
  primaryKey,
  foreignKey
} from "drizzle-orm/pg-core";
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Schema di sessione (necessario per l'autenticazione)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Schema utenti
export const users = pgTable("users", {
  id: serial("id").primaryKey().notNull(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  discordId: varchar("discord_id", { length: 255 }),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLogin: timestamp("last_login"),
  profileImageUrl: varchar("profile_image_url", { length: 255 }),
  patreonId: varchar("patreon_id", { length: 255 }),
});

// Schema inviti utente
export const userInvites = pgTable("user_invites", {
  id: serial("id").primaryKey().notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  token: varchar("token", { length: 255 }).notNull().unique(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  usedBy: integer("used_by").references(() => users.id),
});

// Schema server di gioco
export const servers = pgTable("servers", {
  id: serial("id").primaryKey().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // minecraft, rust, etc.
  status: varchar("status", { length: 50 }).notNull().default("stopped"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  pterodactylId: varchar("pterodactyl_id", { length: 255 }),
  pterodactylIdentifier: varchar("pterodactyl_identifier", { length: 255 }),
  requiredRole: varchar("required_role", { length: 50 }).default("member"),
  ownerId: integer("owner_id").references(() => users.id),
  config: jsonb("config"), // Configurazione specifica del server
  memory: integer("memory"), // in MB
  disk: integer("disk"), // in MB
  cpu: integer("cpu"), // in %
  port: integer("port"),
  address: varchar("address", { length: 255 }),
});

// Schema accessi ai server
export const serverAccess = pgTable("server_access", {
  id: serial("id").primaryKey().notNull(),
  serverId: integer("server_id").notNull().references(() => servers.id),
  userId: integer("user_id").notNull().references(() => users.id),
  role: varchar("role", { length: 50 }).notNull().default("member"), // admin, moderator, member
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
});

// Schema per WireGuard peers
export const wireguardPeers = pgTable("wireguard_peers", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  publicKey: varchar("public_key", { length: 255 }).notNull().unique(),
  privateKey: varchar("private_key", { length: 255 }), // Opzionale, potrebbe non essere salvato per motivi di sicurezza
  presharedKey: varchar("preshared_key", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastHandshake: timestamp("last_handshake"),
  allowedIPs: varchar("allowed_ips", { length: 255 }).default("0.0.0.0/0"),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  config: text("config"), // Configurazione completa
});

// Schema per audit log
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey().notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  action: varchar("action", { length: 255 }).notNull(),
  level: varchar("level", { length: 50 }).notNull().default("info"),
  userId: varchar("user_id", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  userRole: varchar("user_role", { length: 100 }).notNull(),
  description: text("description").notNull(),
  details: jsonb("details"),
  ip: varchar("ip", { length: 50 }).notNull(),
});

// Schema per log Discord
export const discordLogs = pgTable("discord_logs", {
  id: serial("id").primaryKey().notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  discordUserId: varchar("discord_user_id", { length: 255 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  command: varchar("command", { length: 255 }).notNull(),
  options: jsonb("options"),
  channel: varchar("channel", { length: 255 }),
  guild: varchar("guild", { length: 255 }),
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
});

// Schema per richieste di accesso
export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey().notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(), // server, wireguard, ecc.
  resourceId: integer("resource_id"), // ID del server o altra risorsa
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
});

// Schema per metriche di sistema
export const systemMetrics = pgTable("system_metrics", {
  id: serial("id").primaryKey().notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  cpu: jsonb("cpu").notNull(),
  memory: jsonb("memory").notNull(),
  disk: jsonb("disk").notNull(),
  network: jsonb("network").notNull(),
  uptime: integer("uptime").notNull(),
});

// Schema per metriche dei server
export const serverMetrics = pgTable("server_metrics", {
  id: serial("id").primaryKey().notNull(),
  serverId: integer("server_id").notNull().references(() => servers.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  cpu: jsonb("cpu").notNull(),
  memory: jsonb("memory").notNull(),
  disk: jsonb("disk").notNull(),
  players: integer("players"),
  status: varchar("status", { length: 50 }).notNull(),
});

// Schema per avvisi di sistema
export const systemAlerts = pgTable("system_alerts", {
  id: serial("id").primaryKey().notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  type: varchar("type", { length: 50 }).notNull(), // system, server, ecc.
  level: varchar("level", { length: 50 }).notNull().default("warning"),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  serverId: integer("server_id").references(() => servers.id),
  acknowledged: boolean("acknowledged").notNull().default(false),
  acknowledgedBy: integer("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  notified: boolean("notified").notNull().default(false),
});

// Schema Zod per inserimento utenti
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Email non valida"),
  username: z.string().min(3, "Username troppo corto").max(50, "Username troppo lungo"),
  password: z.string().min(8, "Password troppo corta"),
});

// Schema Zod per inserimento server
export const insertServerSchema = createInsertSchema(servers);

// Schema Zod per inserimento peers WireGuard
export const insertWireguardPeerSchema = createInsertSchema(wireguardPeers);

// Tipi generati
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Server = typeof servers.$inferSelect;
export type InsertServer = typeof servers.$inferInsert;

export type ServerAccess = typeof serverAccess.$inferSelect;
export type InsertServerAccess = typeof serverAccess.$inferInsert;

export type WireguardPeer = typeof wireguardPeers.$inferSelect;
export type InsertWireguardPeer = typeof wireguardPeers.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

export type DiscordLog = typeof discordLogs.$inferSelect;
export type InsertDiscordLog = typeof discordLogs.$inferInsert;

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = typeof accessRequests.$inferInsert;

export type SystemAlert = typeof systemAlerts.$inferSelect;
export type InsertSystemAlert = typeof systemAlerts.$inferInsert;

export type UserInvite = typeof userInvites.$inferSelect;
export type InsertUserInvite = typeof userInvites.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;