import { Switch, Route, useLocation, Redirect } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WebSocketProvider } from "@/components/WebSocketProvider";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import ResourceMonitor from "@/pages/ResourceMonitor";
import WireguardNetwork from "@/pages/WireguardNetwork";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import axios from "axios";

// Componente per verificare se l'utente è autenticato
const AuthRoute = ({ component: Component, ...rest }: any) => {
  const [location] = useLocation();
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/profile'],
    retry: false,
    enabled: !!localStorage.getItem('accessToken')
  });

  // Configura axios per includere il token di autenticazione in tutte le richieste
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    
    // Questo funzionerà come interceptor per aggiungere il token a tutte le richieste
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    return () => {
      // Rimuovi l'interceptor quando il componente viene smontato
      axios.interceptors.request.eject(requestInterceptor);
    };
  }, []);

  // Durante il caricamento, mostra un indicatore di caricamento
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se l'utente è autenticato, renderizza il componente, altrimenti reindirizza al login
  return user ? (
    <AppLayout>
      <Component {...rest} />
    </AppLayout>
  ) : (
    <Redirect to={`/login?redirect=${encodeURIComponent(location)}`} />
  );
};

// Router per l'applicazione
function Router() {
  return (
    <Switch>
      {/* Rotte pubbliche */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Rotte protette che richiedono autenticazione */}
      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>
      <Route path="/dashboard">
        {(params) => <AuthRoute component={Dashboard} params={params} />}
      </Route>
      <Route path="/resource-monitor">
        {(params) => <AuthRoute component={ResourceMonitor} params={params} />}
      </Route>
      <Route path="/wireguard">
        {(params) => <AuthRoute component={WireguardNetwork} params={params} />}
      </Route>
      <Route path="/wireguard-network">
        {(params) => <AuthRoute component={WireguardNetwork} params={params} />}
      </Route>
      <Route path="/wireguard/security">
        {(params) => <AuthRoute component={WireguardNetwork} params={params} />}
      </Route>
      <Route path="/wireguard/backup">
        {(params) => <AuthRoute component={WireguardNetwork} params={params} />}
      </Route>
      
      {/* Rotta 404 */}
      <Route>
        {() => <NotFound />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WebSocketProvider>
          <Toaster />
          <Router />
        </WebSocketProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
