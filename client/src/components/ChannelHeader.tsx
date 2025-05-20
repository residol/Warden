import React from 'react';

interface ChannelHeaderProps {
  channelName: string;
  channelDescription?: string;
}

const ChannelHeader: React.FC<ChannelHeaderProps> = ({ 
  channelName, 
  channelDescription = "Discussioni e comandi"
}) => {
  return (
    <div className="h-12 border-b border-gray-800 flex items-center px-4">
      <div className="flex items-center">
        <i className="fas fa-hashtag text-discord-muted mr-2"></i>
        <span className="font-semibold">{channelName}</span>
      </div>
      <div className="border-l border-gray-700 h-6 mx-4"></div>
      <div className="text-discord-muted text-sm">{channelDescription}</div>
      <div className="ml-auto flex items-center space-x-4">
        <button className="hover:bg-discord-input p-2 rounded">
          <i className="fas fa-bell text-discord-muted"></i>
        </button>
        <button className="hover:bg-discord-input p-2 rounded">
          <i className="fas fa-thumbtack text-discord-muted"></i>
        </button>
        <button className="hover:bg-discord-input p-2 rounded">
          <i className="fas fa-users text-discord-muted"></i>
        </button>
        <div className="relative">
          <input type="text" placeholder="Cerca" className="bg-discord-dark text-sm px-2 py-1 rounded text-discord-muted w-40" />
        </div>
        <button className="hover:bg-discord-input p-2 rounded">
          <i className="fas fa-inbox text-discord-muted"></i>
        </button>
        <button className="hover:bg-discord-input p-2 rounded">
          <i className="fas fa-question-circle text-discord-muted"></i>
        </button>
      </div>
    </div>
  );
}

export default ChannelHeader;
