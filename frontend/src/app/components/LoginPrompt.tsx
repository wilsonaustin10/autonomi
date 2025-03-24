'use client'

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface LoginPromptProps {
  onSubmit: (credentials: { username: string; password: string }) => void;
  onCancel: () => void;
}

export default function LoginPrompt({ onSubmit, onCancel }: LoginPromptProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ username, password });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Login Required</h3>
        <p className="mb-4 text-sm">This page requires login credentials. Enter them below to continue:</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Username/Email</label>
            <Input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full" 
              autoComplete="username"
            />
          </div>
          
          <div>
            <label className="block text-sm mb-1">Password</label>
            <Input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full" 
              autoComplete="current-password"
            />
          </div>
          
          <div className="text-xs text-gray-500">
            Credentials are only used to fill the form and never stored.
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!username || !password}
            >
              Fill Login Form
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 