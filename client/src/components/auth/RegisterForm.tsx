import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// Schema di validazione
const registerSchema = z.object({
  username: z.string().min(3, { message: 'Il nome utente deve contenere almeno 3 caratteri' }),
  email: z.string().email({ message: 'Inserisci un indirizzo email valido' }),
  password: z.string().min(6, { message: 'La password deve contenere almeno 6 caratteri' }),
  inviteToken: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  inviteToken?: string;
  onSuccess?: () => void;
}

export function RegisterForm({ inviteToken, onSuccess }: RegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      inviteToken: inviteToken || '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      // Se abbiamo un token di invito, usa l'endpoint di registrazione con invito
      const endpoint = data.inviteToken 
        ? '/api/auth/register-with-invite' 
        : '/api/auth/register';
      
      const response = await axios.post(endpoint, data);
      
      // Salva il token di accesso
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      
      toast({
        title: 'Registrazione completata',
        description: `Benvenuto, ${response.data.user.username}!`,
      });
      
      // Callback di successo
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Errore durante la registrazione:', error);
      
      // Mostra messaggio di errore appropriato
      if (axios.isAxiosError(error) && error.response) {
        toast({
          title: 'Errore durante la registrazione',
          description: error.response.data.message || 'Errore durante la registrazione',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Errore durante la registrazione',
          description: 'Si è verificato un errore durante la registrazione. Riprova più tardi.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Registrazione</CardTitle>
        <CardDescription>
          {inviteToken 
            ? 'Completa la registrazione con il tuo invito' 
            : 'Crea un nuovo account'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome utente</FormLabel>
                  <FormControl>
                    <Input placeholder="Inserisci il tuo nome utente" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="Inserisci la tua email" 
                      {...field}
                      disabled={!!inviteToken} // Disabilita se registrazione con invito
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Crea una password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {!inviteToken && (
              <FormField
                control={form.control}
                name="inviteToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Codice di invito (opzionale)</FormLabel>
                    <FormControl>
                      <Input placeholder="Inserisci il codice di invito, se ne hai uno" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Registrazione in corso...' : 'Registrati'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-gray-500">
          Hai già un account? <a href="/login" className="text-blue-500 hover:underline">Accedi</a>
        </p>
      </CardFooter>
    </Card>
  );
}