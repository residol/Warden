import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useToast } from '@/hooks/use-toast';
import { useAuth, User } from '@/hooks/useAuth';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchIcon, UserPlus, Edit, Trash2, Mail } from 'lucide-react';

// Componente per la gestione degli utenti (solo Admin e Moderator)
export function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [inviteData, setInviteData] = useState({ email: '', role: 'member' });

  // Ottieni gli utenti dal server
  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const { data } = await axios.get('/api/admin/users');
      return data as User[];
    },
    enabled: hasRole(['admin', 'moderator']), // Solo per admin e moderator
  });

  // Filtra gli utenti in base alla ricerca
  const filteredUsers = users?.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Mutation per inviare un invito
  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      return axios.post('/api/auth/invite', data);
    },
    onSuccess: () => {
      toast({
        title: 'Invito inviato',
        description: `Un invito è stato inviato a ${inviteData.email}`,
      });
      setShowInviteDialog(false);
      setInviteData({ email: '', role: 'member' });
    },
    onError: (error) => {
      toast({
        title: 'Errore',
        description: axios.isAxiosError(error) 
          ? error.response?.data.message || 'Errore durante l\'invio dell\'invito'
          : 'Errore durante l\'invio dell\'invito',
        variant: 'destructive',
      });
    },
  });

  // Mutation per aggiornare un utente
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number; role: string }) => {
      return axios.patch(`/api/admin/users/${data.id}`, { role: data.role });
    },
    onSuccess: () => {
      toast({
        title: 'Utente aggiornato',
        description: 'Il ruolo dell\'utente è stato aggiornato con successo',
      });
      setShowEditDialog(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error) => {
      toast({
        title: 'Errore',
        description: axios.isAxiosError(error) 
          ? error.response?.data.message || 'Errore durante l\'aggiornamento dell\'utente'
          : 'Errore durante l\'aggiornamento dell\'utente',
        variant: 'destructive',
      });
    },
  });

  // Mutation per eliminare un utente
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return axios.delete(`/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: 'Utente eliminato',
        description: 'L\'utente è stato eliminato con successo',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error) => {
      toast({
        title: 'Errore',
        description: axios.isAxiosError(error) 
          ? error.response?.data.message || 'Errore durante l\'eliminazione dell\'utente'
          : 'Errore durante l\'eliminazione dell\'utente',
        variant: 'destructive',
      });
    },
  });

  // Gestione invio del form di invito
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inviteMutation.mutate(inviteData);
  };

  // Gestione invio del form di modifica
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      updateUserMutation.mutate({
        id: selectedUser.id,
        role: selectedUser.role,
      });
    }
  };

  // Colore del badge in base al ruolo
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500';
      case 'moderator':
        return 'bg-orange-500';
      case 'supporter':
        return 'bg-purple-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Verifica permessi per modificare un utente
  const canModifyUser = (targetUser: User) => {
    // L'admin può modificare qualsiasi utente tranne se stesso
    if (currentUser?.role === 'admin' && currentUser.id !== targetUser.id) {
      return true;
    }
    
    // Il moderatore può modificare solo gli utenti member e supporter
    if (currentUser?.role === 'moderator' && 
        ['member', 'supporter'].includes(targetUser.role) &&
        currentUser.id !== targetUser.id) {
      return true;
    }
    
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestione Utenti</CardTitle>
        <CardDescription>
          Gestisci gli utenti e i loro ruoli nella piattaforma
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <div className="relative w-full max-w-sm">
            <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca utenti..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Solo gli amministratori possono invitare nuovi utenti */}
          {currentUser?.role === 'admin' && (
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button className="ml-4">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invita Utente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invita Nuovo Utente</DialogTitle>
                  <DialogDescription>
                    Invia un invito email a un nuovo utente. Il destinatario riceverà un link per completare la registrazione.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInviteSubmit}>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label htmlFor="email">Email</label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="email@esempio.com"
                        value={inviteData.email}
                        onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <label htmlFor="role">Ruolo</label>
                      <Select
                        value={inviteData.role}
                        onValueChange={(value) => setInviteData({ ...inviteData, role: value })}
                      >
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Seleziona un ruolo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Amministratore</SelectItem>
                          <SelectItem value="moderator">Moderatore</SelectItem>
                          <SelectItem value="member">Membro</SelectItem>
                          <SelectItem value="supporter">Supporter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? 'Invio in corso...' : 'Invia Invito'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableCaption>Lista degli utenti registrati nella piattaforma</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Utente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Discord</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Nessun utente trovato
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        {user.profileImageUrl ? (
                          <img 
                            src={user.profileImageUrl} 
                            alt={user.username} 
                            className="h-8 w-8 rounded-full mr-2 object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center mr-2">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {user.username}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge className={`${getRoleBadgeColor(user.role)}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.discordId ? (
                        <Badge variant="outline" className="bg-[#5865F2] text-white">
                          Collegato
                        </Badge>
                      ) : (
                        <Badge variant="outline">Non collegato</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        {canModifyUser(user) && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            {currentUser?.role === 'admin' && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-red-500"
                                onClick={() => {
                                  if (window.confirm(`Sei sicuro di voler eliminare l'utente ${user.username}?`)) {
                                    deleteUserMutation.mutate(user.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            // Qui implementeremo l'invio di un messaggio diretto all'utente
                            toast({
                              title: 'Funzionalità in arrivo',
                              description: 'L\'invio di messaggi diretti sarà disponibile a breve',
                            });
                          }}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Dialogo di modifica utente */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifica Utente</DialogTitle>
              <DialogDescription>
                Modifica i dettagli dell'utente {selectedUser?.username}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="edit-role">Ruolo</label>
                  <Select
                    value={selectedUser?.role}
                    onValueChange={(value) => {
                      if (selectedUser) {
                        setSelectedUser({ ...selectedUser, role: value as any });
                      }
                    }}
                  >
                    <SelectTrigger id="edit-role">
                      <SelectValue placeholder="Seleziona un ruolo" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Solo gli admin possono promuovere ad admin o moderator */}
                      {currentUser?.role === 'admin' && (
                        <>
                          <SelectItem value="admin">Amministratore</SelectItem>
                          <SelectItem value="moderator">Moderatore</SelectItem>
                        </>
                      )}
                      <SelectItem value="member">Membro</SelectItem>
                      <SelectItem value="supporter">Supporter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? 'Aggiornamento...' : 'Salva Modifiche'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}