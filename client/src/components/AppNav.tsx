import React from 'react';
import { useLocation, Link } from 'wouter';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Network, 
  MonitorSmartphone, 
  BarChart3, 
  ArrowRight, 
  Shield, 
  Database,
  ServerCog,
  Settings,
  HardDrive
} from 'lucide-react';

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ 
  href, 
  label, 
  icon, 
  active = false,
  onClick
}) => {
  return (
    <Link href={href}>
      <a 
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
          active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
        )}
        onClick={onClick}
      >
        {icon}
        <span>{label}</span>
      </a>
    </Link>
  );
};

const AppNav: React.FC = () => {
  const [location] = useLocation();
  
  return (
    <div className="h-screen flex flex-col bg-card border-r">
      <div className="p-3 flex items-center gap-2 border-b">
        <Network className="h-6 w-6 text-primary" />
        <span className="font-bold text-xl">Server Manager</span>
      </div>
      
      <div className="flex-1 py-4">
        <div className="px-3 pb-1">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Dashboard</h3>
          <nav className="space-y-1">
            <NavItem
              href="/"
              label="Panoramica"
              icon={<LayoutDashboard className="h-4 w-4" />}
              active={location === '/' || location === '/dashboard'}
            />
            <NavItem
              href="/resource-monitor"
              label="Monitor Risorse"
              icon={<MonitorSmartphone className="h-4 w-4" />}
              active={location === '/resource-monitor'}
            />
            <NavItem
              href="/wireguard"
              label="Rete WireGuard"
              icon={<Network className="h-4 w-4" />}
              active={location.includes('/wireguard')}
            />
          </nav>
        </div>
        
        <div className="px-3 py-3">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Gestione Server</h3>
          <nav className="space-y-1">
            <NavItem
              href="/servers"
              label="Server di Gioco"
              icon={<ServerCog className="h-4 w-4" />}
              active={location === '/servers'}
            />
            <NavItem
              href="/pterodactyl"
              label="Pterodactyl"
              icon={<HardDrive className="h-4 w-4" />}
              active={location === '/pterodactyl'}
            />
            <NavItem
              href="/stats"
              label="Statistiche"
              icon={<BarChart3 className="h-4 w-4" />}
              active={location === '/stats'}
            />
          </nav>
        </div>
        
        <div className="px-3 py-3">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Sicurezza & Backup</h3>
          <nav className="space-y-1">
            <NavItem
              href="/wireguard/security"
              label="Sicurezza"
              icon={<Shield className="h-4 w-4" />}
              active={location === '/wireguard/security'}
            />
            <NavItem
              href="/wireguard/backup"
              label="Backup"
              icon={<Database className="h-4 w-4" />}
              active={location === '/wireguard/backup'}
            />
            <NavItem
              href="/settings"
              label="Impostazioni"
              icon={<Settings className="h-4 w-4" />}
              active={location === '/settings'}
            />
          </nav>
        </div>
      </div>
      
      <div className="border-t p-3">
        <a 
          href="https://github.com/yourname/server-manager" 
          target="_blank" 
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <span>Documentazione</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
};

export default AppNav;