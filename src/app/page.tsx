"use client";

import { useState } from "react";
// Update the import path below to the correct relative path if alias is not configured
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const { data: session } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const onSubmit = async () => {
      authClient.signUp.email({ 
        email, 
        password, 
        name 
    }, {
      onError: () => {
        window.alert("An error occurred during sign up. Please try again.");
      },
      onSuccess: () => {
        window.alert("Sign up successful! Please check your email for verification.");
      }
  });
  }

  const onLogIn = async () => {
      authClient.signIn.email({ 
        email, 
        password, 
    }, {
      onError: () => {
        window.alert("An error occurred during sign in. Please try again.");
      },
      onSuccess: () => {
        window.alert("Sign in successful!");
      }
  });
      }


  if(session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-2xl font-bold mb-4">Welcome Back!</h1>
        <p className="mb-4">You are already signed in as {session.user.name || session.user.email}.</p>
        <Button 
          className="mt-4 w-24"
          onClick={() => authClient.signOut()}
        >
          Sign Out
        </Button>
      </div>
    );
  } 

  return (
    <div className="flex flex-col gap-y-10">
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
        <p className="mb-4">Create your account</p>
        <Input
          className="mt-4 w-96"
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          className="mt-4 w-96"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          className="mt-4 w-96"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button 
          className="mt-4 w-24"
          onClick={onSubmit}
        >
          Submit
        </Button>
      </div>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-2xl font-bold mb-4">Log In</h1>
        <p className="mb-4">Welcome back! Please enter your details.</p>
        <Input
          className="mt-4 w-96"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          className="mt-4 w-96"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button 
          className="mt-4 w-24"
          onClick={onLogIn}
        >
          Login
        </Button>
      </div>
    </div>
  );
}
