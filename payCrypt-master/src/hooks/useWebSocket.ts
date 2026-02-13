import { useEffect, useRef, useState } from 'react';
import { WebSocketMessage } from '../types';

export const useWebSocket = (url: string, userId?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Mock WebSocket connection
    const mockConnect = () => {
      setIsConnected(true);
      
      // Simulate periodic updates
      const interval = setInterval(() => {
        const mockMessage: WebSocketMessage = {
          type: Math.random() > 0.7 ? 'balance_update' : 'transaction_update',
          data: {
            userId,
            balance: Math.random() * 10000,
            transaction: {
              id: Date.now().toString(),
              type: 'deposit',
              amount: Math.random() * 100
            }
          },
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev.slice(-9), mockMessage]);
      }, 5000);

      return () => {
        clearInterval(interval);
        setIsConnected(false);
      };
    };

    const cleanup = mockConnect();

    return cleanup;
  }, [userId]);

  const sendMessage = (message: any) => {
    // Mock send message
    console.log('Sending message:', message);
  };

  return {
    isConnected,
    messages,
    sendMessage
  };
};