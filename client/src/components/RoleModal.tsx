import React from 'react';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const RoleModal: React.FC<RoleModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-discord-input rounded-md w-full max-w-md overflow-hidden">
        <div className="bg-discord-dark px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-white">Ottieni Accesso alla LAN</h2>
          <button className="text-discord-muted hover:text-white" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-discord-muted text-sm">Ottieni il ruolo "LAN" per accedere ai server e partecipare ai giochi insieme alla community.</p>
          
          <div className="bg-discord-dark p-4 rounded-md space-y-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-discord-blurple flex items-center justify-center text-white mr-3">
                <i className="fas fa-wifi"></i>
              </div>
              <div>
                <div className="font-medium">Ruolo LAN</div>
                <div className="text-xs text-discord-muted">Accesso ai canali e ai server di gioco</div>
              </div>
            </div>
            
            <p className="text-xs text-discord-muted">
              Questo ruolo ti permette di:
            </p>
            <ul className="text-xs text-discord-muted list-disc pl-5 space-y-1">
              <li>Accedere ai canali testuali e vocali dei Giardini di Bellion</li>
              <li>Visualizzare le informazioni sui server di gioco</li>
              <li>Utilizzare i comandi del bot per gestire le tue connessioni</li>
              <li>Richiedere configurazioni WireGuard personalizzate</li>
            </ul>
          </div>
          
          <div className="pt-2">
            <button 
              className="bg-discord-blurple hover:bg-opacity-80 text-white w-full py-2 rounded-md flex items-center justify-center"
              onClick={onConfirm}
            >
              <i className="fas fa-check mr-2"></i> Ottieni Ruolo LAN
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoleModal;
