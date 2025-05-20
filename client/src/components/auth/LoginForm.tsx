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
import { useQueryClient } from '@tanstack/react-query';

// Schema di validazione
const loginSchema = z.object({
  username: z.string().min(3, { message: 'Il nome utente deve contenere almeno 3 caratteri' }),
  password: z.string().min(6, { message: 'La password deve contenere almeno 6 caratteri' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const response = await axios.post('/api/auth/login', data);
      
      // Salva il token di accesso
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      
      // Invalida le query per ricaricare i dati dell'utente
      queryClient.invalidateQueries({ queryKey: ['/api/auth/profile'] });
      
      toast({
        title: 'Login effettuato con successo',
        description: `Benvenuto, ${response.data.user.username}!`,
      });
      
      // Callback di successo
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Errore durante il login:', error);
      
      // Mostra messaggio di errore appropriato
      if (axios.isAxiosError(error) && error.response) {
        toast({
          title: 'Errore durante il login',
          description: error.response.data.message || 'Credenziali non valide',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Errore durante il login',
          description: 'Si è verificato un errore durante il login. Riprova più tardi.',
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
        <CardTitle>Accedi</CardTitle>
        <CardDescription>
          Inserisci le tue credenziali per accedere al pannello di controllo
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Inserisci la tua password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Accesso in corso...' : 'Accedi'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-gray-500">
          Non hai un account? Contatta un amministratore per richiedere un invito.
        </p>
      </CardFooter>
    </Card>
  );
}