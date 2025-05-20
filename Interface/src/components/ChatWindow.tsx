import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatWindowProps {
  friendName: string;
  isGroup: boolean;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isPayment?: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ friendName, isGroup }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  
  // When the selected friend/group changes, reset messages
  useEffect(() => {
    // In a real app, we would fetch conversation history here
    setMessages([]);
  }, [friendName]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        sender: 'You', // In a real app, this would be the user's name
        content: message,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prevMessages => [...prevMessages, newMessage]);
      setMessage('');
    }
  };

  const handlePayment = () => {
    console.log('Payment initiated to:', friendName);
    
    // Simulate a payment message
    const paymentMessage: Message = {
      id: Date.now().toString(),
      sender: 'system',
      content: `Paid ${friendName} $10`,
      timestamp: new Date().toISOString(),
      isPayment: true
    };
    
    setMessages(prevMessages => [...prevMessages, paymentMessage]);
  };

  const handleRequest = () => {
    console.log('Payment request initiated from:', friendName);
    
    // Simulate a request message
    const requestMessage: Message = {
      id: Date.now().toString(),
      sender: 'system',
      content: `Requested $10 from ${friendName}`,
      timestamp: new Date().toISOString(),
      isPayment: true
    };
    
    setMessages(prevMessages => [...prevMessages, requestMessage]);
  };

  return (
    <div className="flex-1 flex flex-col h-full border-l border-gray-200 bg-white">
      <div className="border-b-4 border-black p-5">
        <h2 className="text-xl font-bold">{friendName}</h2>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`mb-2 max-w-[30%] ${msg.sender === 'You' ? 'ml-auto' : ''}`}
          >
            <div className={`p-2 rounded-lg border-4 border-black shadow-brutal-sm ${
              msg.sender === 'You' 
                ? 'bg-blue-100' 
                : msg.isPayment 
                  ? 'bg-green-100' 
                  : 'bg-white'
            }`}>
              {msg.sender !== 'You' && !msg.isPayment && (
                <p className="font-bold mb-1">{msg.sender}</p>
              )}
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 fixed bottom-0 w-3/4 border-t-4 bg-slate-200 pr-10 border-black">
        <div className="flex gap-2 mb-4">
          <Button 
            className="w-6xl border-4 border-black bg-blue-600 hover:bg-blue-700 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
            
          >
            Pay
          </Button>
          <Button 
            variant="outline" 
            className="w-7xl border-4 border-black bg-white hover:bg-gray-100 hover:bg-green-400 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
            
          >
            Request
          </Button>
        </div>
        
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input 
            placeholder="Send message..." 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="border-4 border-black"
          />
          <Button 
            type="submit"
            className="border-4 border-black bg-blue-600 hover:bg-blue-700 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;