import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MigrationModal({ isOpen, onClose }: MigrationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [serverName, setServerName] = useState('');
  const [serverType, setServerType] = useState('minecraft');
  const [serverPort, setServerPort] = useState('25565');
  const [memory, setMemory] = useState('2048');
  const [disk, setDisk] = useState('10000');
  
  // Mutation per la migrazione del server
  const migrationMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/servers/migrate', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      toast({
        title: "Server registrato per migrazione",
        description: `Il server ${serverName} è stato registrato per la migrazione verso Pterodactyl.`,
      });
      
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: "Impossibile registrare il server per la migrazione.",
        variant: "destructive",
      });
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serverName || !serverPort) {
      toast({
        title: "Errore",
        description: "Nome e porta sono obbligatori.",
        variant: "destructive",
      });
      return;
    }
    
    migrationMutation.mutate({
      name: serverName,
      type: serverType,
      port: parseInt(serverPort),
      memory: parseInt(memory),
      disk: parseInt(disk)
    });
  };
  
  const resetForm = () => {
    setServerName('');
    setServerType('minecraft');
    setServerPort('25565');
    setMemory('2048');
    setDisk('10000');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-discord-dark text-white border-discord-sidebar">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Migrazione Server da Docker</DialogTitle>
          <DialogDescription className="text-discord-muted">
            Inserisci i dettagli del server Docker da migrare a Pterodactyl
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-name">Nome Server</Label>
            <Input
              id="server-name"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="es. Minecraft Survival"
              className="bg-discord-input text-white border-discord-sidebar"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="server-type">Tipo Server</Label>
            <Select
              value={serverType}
              onValueChange={setServerType}
            >
              <SelectTrigger className="bg-discord-input text-white border-discord-sidebar">
                <SelectValue placeholder="Seleziona il tipo di server" />
              </SelectTrigger>
              <SelectContent className="bg-discord-sidebar text-white border-discord-input">
                <SelectItem value="minecraft">Minecraft Java</SelectItem>
                <SelectItem value="minecraft-bedrock">Minecraft Bedrock</SelectItem>
                <SelectItem value="rust">Rust</SelectItem>
                <SelectItem value="terraria">Terraria</SelectItem>
                <SelectItem value="valheim">Valheim</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="server-port">Porta</Label>
            <Input
              id="server-port"
              value={serverPort}
              onChange={(e) => setServerPort(e.target.value)}
              placeholder="es. 25565"
              className="bg-discord-input text-white border-discord-sidebar"
              type="number"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="memory">Memoria (MB)</Label>
              <Input
                id="memory"
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
                placeholder="es. 2048"
                className="bg-discord-input text-white border-discord-sidebar"
                type="number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="disk">Spazio Disco (MB)</Label>
              <Input
                id="disk"
                value={disk}
                onChange={(e) => setDisk(e.target.value)}
                placeholder="es. 10000"
                className="bg-discord-input text-white border-discord-sidebar"
                type="number"
              />
            </div>
          </div>
          
          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-discord-input hover:bg-discord-sidebar text-white border-discord-input"
            >
              Annulla
            </Button>
            <Button 
              type="submit"
              className="bg-discord-blurple hover:bg-discord-blurple-dark text-white"
              disabled={migrationMutation.isPending}
            >
              {migrationMutation.isPending ? (
                <>
                  <span className="mr-2">Migrazione in corso</span>
                  <i className="fas fa-spinner fa-spin"></i>
                </>
              ) : "Migra Server"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}