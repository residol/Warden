import React from 'react';

export interface UserInfo {
  id: string;
  username: string;
  status: 'online' | 'offline' | 'idle' | 'dnd';
  isAdmin?: boolean;
  isSupporter?: boolean;
  isLanMember?: boolean;
  activity?: string;
  avatarUrl?: string;
}

interface MembersSidebarProps {
  users: UserInfo[];
}

const MembersSidebar: React.FC<MembersSidebarProps> = ({ users }) => {
  // Filter users by role
  const admins = users.filter(user => user.isAdmin);
  const supporters = users.filter(user => user.isSupporter && !user.isAdmin);
  const lanMembers = users.filter(user => user.isLanMember && !user.isAdmin && !user.isSupporter);
  
  return (
    <div className="w-60 bg-discord-sidebar flex-shrink-0 h-full border-l border-gray-800 overflow-y-auto">
      <div className="p-3">
        <div className="mb-2">
          <input 
            type="text" 
            placeholder="Cerca membri..." 
            className="w-full bg-discord-dark text-sm p-1 rounded text-discord-muted"
          />
        </div>
        
        {/* Admins */}
        {admins.length > 0 && (
          <div className="mb-4">
            <h3 className="text-discord-muted uppercase text-xs font-semibold px-2 mb-1 flex justify-between items-center">
              <span>Amministratori</span>
              <span>{admins.length}</span>
            </h3>
            <div className="space-y-1">
              {admins.map(user => (
                <div key={user.id} className="flex items-center hover:bg-discord-input rounded p-2 cursor-pointer">
                  <div className="w-8 h-8 rounded-full overflow-hidden mr-2 bg-discord-input flex items-center justify-center">
                    {user.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={`${user.username} avatar`} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <i className="fas fa-user text-gray-500"></i>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">{user.username}</div>
                    <div className="text-xs text-discord-muted">
                      {user.activity ? user.activity : user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Supporters */}
        {supporters.length > 0 && (
          <div className="mb-4">
            <h3 className="text-discord-muted uppercase text-xs font-semibold px-2 mb-1 flex justify-between items-center">
              <span>Sostenitori</span>
              <span>{supporters.length}</span>
            </h3>
            <div className="space-y-1">
              {supporters.map(user => (
                <div key={user.id} className="flex items-center hover:bg-discord-input rounded p-2 cursor-pointer">
                  <div className="w-8 h-8 rounded-full overflow-hidden mr-2 bg-discord-input flex items-center justify-center">
                    {user.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={`${user.username} avatar`} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <i className="fas fa-user text-gray-500"></i>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-discord-blurple font-medium">{user.username}</div>
                    <div className="text-xs text-discord-muted">
                      {user.activity ? user.activity : user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* LAN Members */}
        {lanMembers.length > 0 && (
          <div>
            <h3 className="text-discord-muted uppercase text-xs font-semibold px-2 mb-1 flex justify-between items-center">
              <span>LAN</span>
              <span>{lanMembers.length}</span>
            </h3>
            <div className="space-y-1">
              {lanMembers.map(user => (
                <div key={user.id} className="flex items-center hover:bg-discord-input rounded p-2 cursor-pointer">
                  <div className="w-8 h-8 rounded-full overflow-hidden mr-2 bg-discord-input flex items-center justify-center">
                    {user.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={`${user.username} avatar`} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <i className="fas fa-user text-gray-500"></i>
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">{user.username}</div>
                    <div className="text-xs text-discord-muted">
                      {user.activity ? user.activity : user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MembersSidebar;
