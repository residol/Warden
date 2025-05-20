import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// Tipi per i dati storici
interface ResourceHistoryPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  disk: number;
}

interface ServerResourceHistory {
  serverId: string;
  serverName: string;
  dataPoints: ResourceHistoryPoint[];
}

interface ResourceHistoryProps {
  serverId?: string; // Se fornito, mostra solo la storia di un server specifico
}

const ResourceHistory: React.FC<ResourceHistoryProps> = ({ serverId }) => {
  // Stato per selezionare l'intervallo di tempo
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('6h');
  
  // Mock dei dati storici - in una implementazione reale, questi dati sarebbero caricati dal backend
  const generateMockHistoryData = (): ServerResourceHistory[] => {
    // Genera punti dati per le ultime ore basati sull'intervallo selezionato
    const now = new Date();
    const dataPoints: ResourceHistoryPoint[] = [];
    
    // Determina quanti punti dati generare in base all'intervallo
    let hoursBack = 6;
    let intervalMinutes = 10;
    
    switch (timeRange) {
      case '1h':
        hoursBack = 1;
        intervalMinutes = 2;
        break;
      case '6h':
        hoursBack = 6;
        intervalMinutes = 10;
        break;
      case '24h':
        hoursBack = 24;
        intervalMinutes = 30;
        break;
      case '7d':
        hoursBack = 24 * 7;
        intervalMinutes = 120;
        break;
    }
    
    // Genera i dati
    for (let i = hoursBack * 60; i >= 0; i -= intervalMinutes) {
      const timestamp = new Date(now.getTime() - i * 60 * 1000);
      
      // Simulazione di dati per CPU, memoria e disco basata su un ciclo con picchi periodici
      const cycle = Math.sin((i / 60) * 0.5) * 0.3 + 0.5;
      const randomVariation = Math.random() * 0.2 - 0.1;
      
      dataPoints.push({
        timestamp: timestamp.toISOString(),
        cpu: Math.max(5, Math.min(95, Math.round((cycle * 70 + randomVariation * 30) * 10) / 10)),
        memory: Math.max(10, Math.min(90, Math.round((cycle * 60 + randomVariation * 20) * 10) / 10)),
        disk: Math.max(20, Math.min(85, 40 + Math.round(randomVariation * 15 * 10) / 10))
      });
    }
    
    return [
      {
        serverId: '1',
        serverName: 'Minecraft Survival',
        dataPoints
      },
      {
        serverId: '2',
        serverName: 'Rust Server',
        dataPoints: dataPoints.map(dp => ({
          ...dp,
          cpu: Math.max(5, Math.min(95, dp.cpu + (Math.random() * 20 - 10))),
          memory: Math.max(10, Math.min(90, dp.memory + (Math.random() * 15 - 7.5))),
        }))
      }
    ];
  };
  
  // Nella versione reale, questi dati verrebbero caricati da una API
  // const { data: resourceHistory = [], isLoading } = useQuery<ServerResourceHistory[]>({
  //   queryKey: ['/api/pterodactyl/resource-history', timeRange, serverId],
  //   refetchInterval: 60000 // Aggiorna ogni minuto
  // });
  
  // Per ora, generiamo dati di esempio
  const resourceHistory = generateMockHistoryData();
  const filteredHistory = serverId 
    ? resourceHistory.filter(h => h.serverId === serverId)
    : resourceHistory;
  
  // Formatta i dati per i grafici
  const formatChartData = (history: ServerResourceHistory) => {
    return history.dataPoints.map(point => ({
      timestamp: new Date(point.timestamp).toLocaleTimeString(),
      cpu: point.cpu,
      memory: point.memory,
      disk: point.disk
    }));
  };
  
  // Funzione per ottenere il colore in base all'utilizzo
  const getResourceColor = (usage: number) => {
    if (usage >= 90) return '#ef4444';  // Rosso per utilizzo critico
    if (usage >= 70) return '#f59e0b';  // Giallo per utilizzo alto
    return '#22c55e';                   // Verde per utilizzo normale
  };
  
  // Calcola valori medi attuali per ogni risorsa
  const calculateAverages = (history: ServerResourceHistory) => {
    // Prendi gli ultimi 3 punti dati per calcolare la media attuale
    const recentPoints = history.dataPoints.slice(-3);
    if (recentPoints.length === 0) return { cpu: 0, memory: 0, disk: 0 };
    
    return {
      cpu: recentPoints.reduce((sum, point) => sum + point.cpu, 0) / recentPoints.length,
      memory: recentPoints.reduce((sum, point) => sum + point.memory, 0) / recentPoints.length,
      disk: recentPoints.reduce((sum, point) => sum + point.disk, 0) / recentPoints.length
    };
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (timeRange === '7d') {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="bg-discord-sidebar rounded-md overflow-hidden mb-6">
      <div className="bg-discord-dark px-4 py-3 flex items-center justify-between">
        <h3 className="font-semibold flex items-center">
          <i className="fas fa-chart-line text-discord-blurple mr-2"></i> Storico Risorse
        </h3>
        <div className="flex space-x-2">
          <select 
            className="text-xs bg-discord-input hover:bg-opacity-80 px-2 py-1 rounded text-discord-muted"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
          >
            <option value="1h">Ultima ora</option>
            <option value="6h">6 ore</option>
            <option value="24h">24 ore</option>
            <option value="7d">7 giorni</option>
          </select>
        </div>
      </div>
      
      <div className="p-4">
        {filteredHistory.length === 0 ? (
          <div className="bg-discord-dark p-4 rounded-md text-center">
            <div className="text-discord-muted mb-3">Nessun dato storico disponibile</div>
            <p className="text-sm text-discord-muted">
              I dati storici saranno disponibili dopo che il server avrà funzionato per un po'.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredHistory.map(serverHistory => {
              const chartData = formatChartData(serverHistory);
              const averages = calculateAverages(serverHistory);
              
              return (
                <div key={serverHistory.serverId} className="bg-discord-dark rounded-md p-4">
                  <h4 className="font-medium text-white mb-4">{serverHistory.serverName}</h4>
                  
                  {/* Riassunto delle risorse attuali */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-discord-sidebar p-3 rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="text-discord-muted">CPU</span>
                        <span className={`font-medium ${getResourceColor(averages.cpu)}`}>
                          {averages.cpu.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-2 w-full h-2 bg-discord-input rounded-full overflow-hidden">
                        <div 
                          className="h-full" 
                          style={{ 
                            width: `${Math.min(averages.cpu, 100)}%`,
                            backgroundColor: getResourceColor(averages.cpu)
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="bg-discord-sidebar p-3 rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="text-discord-muted">Memoria</span>
                        <span className={`font-medium ${getResourceColor(averages.memory)}`}>
                          {averages.memory.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-2 w-full h-2 bg-discord-input rounded-full overflow-hidden">
                        <div 
                          className="h-full" 
                          style={{ 
                            width: `${Math.min(averages.memory, 100)}%`,
                            backgroundColor: getResourceColor(averages.memory)
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="bg-discord-sidebar p-3 rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="text-discord-muted">Disco</span>
                        <span className={`font-medium ${getResourceColor(averages.disk)}`}>
                          {averages.disk.toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-2 w-full h-2 bg-discord-input rounded-full overflow-hidden">
                        <div 
                          className="h-full" 
                          style={{ 
                            width: `${Math.min(averages.disk, 100)}%`,
                            backgroundColor: getResourceColor(averages.disk)
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Grafici storici */}
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm text-discord-muted mb-2">Storico utilizzo CPU</h5>
                      {/* Qui in un'implementazione reale useremmo Recharts o una libreria simile */}
                      <div className="bg-discord-sidebar p-2 rounded-md h-32 flex items-end">
                        {chartData.map((point, i) => (
                          <div 
                            key={i} 
                            className="h-full flex-1 flex flex-col justify-end items-center mx-px"
                            title={`${point.timestamp}: ${point.cpu}%`}
                          >
                            <div 
                              className="w-full rounded-t" 
                              style={{ 
                                height: `${point.cpu}%`,
                                backgroundColor: getResourceColor(point.cpu)
                              }}
                            ></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm text-discord-muted mb-2">Storico utilizzo memoria</h5>
                      <div className="bg-discord-sidebar p-2 rounded-md h-32 flex items-end">
                        {chartData.map((point, i) => (
                          <div 
                            key={i} 
                            className="h-full flex-1 flex flex-col justify-end items-center mx-px"
                            title={`${point.timestamp}: ${point.memory}%`}
                          >
                            <div 
                              className="w-full rounded-t" 
                              style={{ 
                                height: `${point.memory}%`,
                                backgroundColor: getResourceColor(point.memory)
                              }}
                            ></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceHistory;