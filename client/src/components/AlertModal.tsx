import React from 'react';

export interface SystemAlert {
  id: number;
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  serverName?: string;
}

interface AlertModalProps {
  alert: SystemAlert | null;
  isOpen: boolean;
  onClose: () => void;
  onIgnore: () => void;
  onAction: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({ 
  alert, 
  isOpen, 
  onClose, 
  onIgnore, 
  onAction 
}) => {
  if (!isOpen || !alert) return null;

  const typeIconMap = {
    info: 'info-circle',
    warning: 'exclamation-triangle',
    error: 'exclamation-triangle'
  };

  const typeColorMap = {
    info: 'discord-blurple',
    warning: 'discord-yellow',
    error: 'discord-red'
  };

  const icon = typeIconMap[alert.type];
  const color = typeColorMap[alert.type];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className={`bg-discord-input rounded-md w-full max-w-md overflow-hidden border-l-4 border-${color}`}>
        <div className="bg-discord-dark px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center">
            <i className={`fas fa-${icon} text-${color} mr-2`}></i>
            Avviso Sistema
          </h2>
          <button className="text-discord-muted hover:text-white" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-white">{alert.title}</p>
          
          <div className="bg-discord-dark p-4 rounded-md text-sm text-discord-muted">
            <div className="font-medium text-white mb-1">Dettagli:</div>
            <p>{alert.message}</p>
            {alert.serverName && (
              <p className="mt-1">Server: {alert.serverName}</p>
            )}
            <div className="mt-2 text-xs">
              <span className="text-discord-muted">Timestamp:</span> {alert.timestamp}
            </div>
          </div>
          
          <div className="flex space-x-3 pt-2">
            <button 
              className="bg-discord-input hover:bg-opacity-80 text-white flex-1 py-2 rounded-md border border-gray-700"
              onClick={onIgnore}
            >
              Ignora
            </button>
            <button 
              className="bg-discord-red hover:bg-opacity-80 text-white flex-1 py-2 rounded-md flex items-center justify-center"
              onClick={onAction}
            >
              <i className="fas fa-sync-alt mr-2"></i> Riavvia Server
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlertModal;
