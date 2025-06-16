"use client"

import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';

export const HomeView = () => {
  const { data: session } = authClient.useSession();

  if(!session){
    return <p>Loading...</p>
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <h1 className="text-2xl font-bold mb-4">Welcome Back!</h1>
        <p className="mb-4">You are already signed in as {session.user.name || session.user.email}.</p>
        <Button 
          className="mt-4 w-24"
          onClick={() => authClient.signOut()}
        >
          Sign Out
        </Button>
    </div>
  )
}