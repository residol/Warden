import React from 'react';
import { cn } from '@/lib/utils';

export interface ServerInfo {
  id: number;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'restarting' | 'starting' | 'stopping';
  ipAddress: string;
  port: number;
  maxPlayers: number;
  currentPlayers: number;
  uptime: string;
  playerList?: string[];
}

interface ServerStatusCardProps {
  server: ServerInfo;
  onRestart: (id: number) => void;
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  onInfo: (id: number) => void;
}

const ServerStatusCard: React.FC<ServerStatusCardProps> = ({ 
  server, 
  onRestart, 
  onStart, 
  onStop, 
  onInfo 
}) => {
  // Status indicator color
  const statusColorMap = {
    online: 'bg-discord-green',
    offline: 'bg-discord-red',
    restarting: 'bg-discord-yellow',
    starting: 'bg-discord-yellow',
    stopping: 'bg-discord-yellow'
  };

  const statusClass = statusColorMap[server.status];
  const isOnline = server.status === 'online';
  const isOffline = server.status === 'offline';
  
  return (
    <div className={cn(
      "bg-discord-input rounded-md overflow-hidden border border-gray-700 hover:border-discord-blurple transition-all",
      isOffline && "opacity-75 hover:opacity-100 hover:border-discord-red"
    )}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <div className={cn("w-3 h-3 rounded-full mr-2", statusClass, isOnline && "pulse")}></div>
            <h4 className="font-semibold">{server.name}</h4>
          </div>
          <span className="text-xs bg-discord-dark px-2 py-1 rounded">
            {isOnline 
              ? `${server.currentPlayers}/${server.maxPlayers} online` 
              : isOffline ? "Offline" : server.status.charAt(0).toUpperCase() + server.status.slice(1)
            }
          </span>
        </div>
        
        <div className="text-sm text-discord-muted mb-3">
          <p>Server {server.type.charAt(0).toUpperCase() + server.type.slice(1)}</p>
          <p className="mt-1"><i className="fas fa-network-wired mr-1"></i> LAN IP: {server.ipAddress}:{server.port}</p>
        </div>
        
        <div className="flex justify-between items-center text-xs text-discord-muted">
          <span>
            {isOnline 
              ? `Uptime: ${server.uptime}` 
              : isOffline ? `Offline da: ${server.uptime}` : `${server.status.charAt(0).toUpperCase() + server.status.slice(1)}...`
            }
          </span>
          <div className="flex space-x-2">
            {isOffline ? (
              <button 
                className="hover:text-white transition-colors" 
                title="Start Server"
                onClick={() => onStart(server.id)}
              >
                <i className="fas fa-play"></i>
              </button>
            ) : (
              <>
                <button 
                  className="hover:text-white transition-colors" 
                  title="Restart Server"
                  onClick={() => onRestart(server.id)}
                >
                  <i className="fas fa-sync-alt"></i>
                </button>
                <button 
                  className="hover:text-white transition-colors" 
                  title="Stop Server"
                  onClick={() => onStop(server.id)}
                >
                  <i className="fas fa-stop"></i>
                </button>
              </>
            )}
            <button 
              className="hover:text-white transition-colors" 
              title="Server Info"
              onClick={() => onInfo(server.id)}
            >
              <i className="fas fa-info-circle"></i>
            </button>
          </div>
        </div>
      </div>
      <div className="bg-discord-dark px-4 py-2 text-sm">
        <div className="flex items-center">
          <i className="fas fa-users mr-2 text-discord-muted"></i>
          {isOnline && server.playerList && server.playerList.length > 0 ? (
            <span>{server.playerList.join(', ')}</span>
          ) : (
            <span className="text-discord-muted">
              {isOnline ? "Nessun giocatore online" : isOffline ? "Server offline - Clicca play per avviare" : "In attesa..."}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServerStatusCard;
