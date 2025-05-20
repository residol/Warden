import React from 'react';
import { useQuery } from '@tanstack/react-query';

interface ResourceDetails {
  current: number;
  limit: number;
  percent: number;
}

interface ServerResources {
  id: string;
  name: string;
  status: string;
  memory: ResourceDetails;
  cpu: ResourceDetails;
  disk: ResourceDetails;
}

interface PterodactylResourcesCardProps {
  onRefresh?: () => void;
}

const PterodactylResourcesCard: React.FC<PterodactylResourcesCardProps> = ({ onRefresh }) => {
  // Fetch the resources data from the API
  const { data, isLoading, refetch } = useQuery<ServerResources[]>({
    queryKey: ['/api/pterodactyl/resources'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });
  
  // Ensure we always have a valid array
  const servers = data || [];

  // Handle refresh button click
  const handleRefresh = () => {
    refetch();
    if (onRefresh) onRefresh();
  };

  // Function to generate status color based on percentage
  const getStatusColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Function to format memory size
  const formatMemory = (bytes: number) => {
    if (bytes >= 1073741824) {
      return `${(bytes / 1073741824).toFixed(1)} GB`;
    } else {
      return `${(bytes / 1048576).toFixed(0)} MB`;
    }
  };

  return (
    <div className="bg-discord-sidebar rounded-md overflow-hidden mb-6">
      <div className="bg-discord-dark px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold flex items-center">
          <i className="fas fa-microchip text-discord-blurple mr-2"></i> Risorse Server Pterodactyl
        </h3>
        <button 
          className="text-xs bg-discord-input hover:bg-opacity-80 px-2 py-1 rounded text-discord-muted"
          onClick={handleRefresh}
        >
          <i className="fas fa-sync-alt mr-1"></i> Aggiorna
        </button>
      </div>
      
      <div className="p-4">
        {isLoading ? (
          <div className="text-center py-4 text-discord-muted">
            <i className="fas fa-spinner fa-spin mr-2"></i> Caricamento risorse...
          </div>
        ) : servers.length > 0 ? (
          <div className="space-y-4">
            {servers.map((server: ServerResources) => (
              <div key={server.id} className="bg-discord-dark rounded-md p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-white">
                    {server.name}
                    <span className={`ml-2 text-xs py-1 px-2 rounded-full ${
                      server.status === 'running' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-300'
                    }`}>
                      {server.status === 'running' ? 'Online' : 'Offline'}
                    </span>
                  </h4>
                </div>
                
                {/* CPU Usage */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-discord-muted mb-1">
                    <span>CPU</span>
                    <span>{Math.round(server.cpu.percent)}%</span>
                  </div>
                  <div className="w-full h-2 bg-discord-input rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getStatusColor(server.cpu.percent)}`}
                      style={{ width: `${Math.min(server.cpu.percent, 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Memory Usage */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-discord-muted mb-1">
                    <span>Memoria</span>
                    <span>{formatMemory(server.memory.current)} / {formatMemory(server.memory.limit)} ({Math.round(server.memory.percent)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-discord-input rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getStatusColor(server.memory.percent)}`}
                      style={{ width: `${Math.min(server.memory.percent, 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Disk Usage */}
                <div>
                  <div className="flex justify-between text-xs text-discord-muted mb-1">
                    <span>Disco</span>
                    <span>{formatMemory(server.disk.current)} / {formatMemory(server.disk.limit)} ({Math.round(server.disk.percent)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-discord-input rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getStatusColor(server.disk.percent)}`}
                      style={{ width: `${Math.min(server.disk.percent, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-discord-dark p-4 rounded-md text-center">
            <div className="text-discord-muted mb-3">Nessun server Pterodactyl trovato</div>
            <p className="text-sm text-discord-muted">
              Configura l'API Pterodactyl nelle impostazioni per visualizzare le risorse.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PterodactylResourcesCard;