import React from 'react';

export interface WireguardPeer {
  id: number;
  name: string;
  ipAddress: string;
  isOnline: boolean;
  lastSeen?: string;
}

interface LanStatusCardProps {
  peersCount: number;
  totalTraffic: string;
  activeServers: string;
  peers: WireguardPeer[];
  status: 'online' | 'offline' | 'degraded';
}

const LanStatusCard: React.FC<LanStatusCardProps> = ({ 
  peersCount, 
  totalTraffic, 
  activeServers,
  peers,
  status
}) => {
  // Status color based on network status
  const statusColorMap = {
    online: 'bg-discord-green',
    offline: 'bg-discord-red',
    degraded: 'bg-discord-yellow'
  };
  
  const statusTextMap = {
    online: 'Operativa',
    offline: 'Non disponibile',
    degraded: 'Degradata'
  };
  
  return (
    <div className="bg-discord-sidebar rounded-md overflow-hidden mb-6">
      <div className="bg-discord-dark px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold flex items-center">
          <i className="fas fa-network-wired text-discord-blurple mr-2"></i> Stato LAN
        </h3>
        <span className={`text-xs ${statusColorMap[status]} px-2 py-1 rounded`}>
          {statusTextMap[status]}
        </span>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-discord-input p-3 rounded-md">
            <div className="text-xs text-discord-muted mb-1">Peers connessi</div>
            <div className="text-xl font-semibold">{peersCount}</div>
          </div>
          <div className="bg-discord-input p-3 rounded-md">
            <div className="text-xs text-discord-muted mb-1">Traffico totale</div>
            <div className="text-xl font-semibold">{totalTraffic}</div>
          </div>
          <div className="bg-discord-input p-3 rounded-md">
            <div className="text-xs text-discord-muted mb-1">Server attivi</div>
            <div className="text-xl font-semibold">{activeServers}</div>
          </div>
        </div>
        
        <div className="bg-discord-input rounded-md p-3">
          <h4 className="text-sm font-semibold mb-2">Peers WireGuard attivi</h4>
          {peers.length > 0 ? (
            <div className="space-y-2 text-sm">
              {peers.map((peer) => (
                <div key={peer.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full ${peer.isOnline ? 'bg-discord-green' : 'bg-discord-red'} mr-2`}></div>
                    <span>{peer.name}</span>
                  </div>
                  <span className="text-discord-muted text-xs">{peer.ipAddress}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-discord-muted text-sm">Nessun peer attivo</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LanStatusCard;
