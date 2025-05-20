import React from 'react';

interface CommandExample {
  command: string;
  title: string;
  description: React.ReactNode;
  icon: string;
  color: string;
  timestamp: string;
}

interface CommandsExampleProps {
  commands: CommandExample[];
}

const CommandsExample: React.FC<CommandsExampleProps> = ({ commands }) => {
  return (
    <div className="mb-6">
      <h3 className="font-semibold mb-4 flex items-center">
        <i className="fas fa-terminal text-discord-blurple mr-2"></i> Comandi Bot
      </h3>
      
      {commands.map((command, index) => (
        <div key={index} className="mb-4">
          <div className="flex items-start mb-2">
            <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden mr-3 bg-discord-input flex items-center justify-center">
              <i className="fas fa-robot text-discord-green"></i>
            </div>
            <div>
              <span className="font-semibold text-white">Bellion Bot</span>
              <span className="text-discord-muted text-xs ml-2">{command.timestamp}</span>
              <div className="mt-1 text-discord-muted">/{command.command}</div>
            </div>
          </div>
          
          <div className="ml-13 pl-10">
            <div className={`border-l-4 border-${command.color} bg-discord-input rounded-r-md overflow-hidden`}>
              <div className={`px-4 py-3 bg-${command.color} bg-opacity-10`}>
                <h4 className="font-semibold flex items-center">
                  <i className={`fas fa-${command.icon} mr-2`}></i> {command.title}
                </h4>
              </div>
              <div className="p-4">
                {command.description}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default CommandsExample;
