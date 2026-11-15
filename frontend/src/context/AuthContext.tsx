"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiClient, UserProfile, AuthResponse } from "@/lib/api-client";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<AuthResponse>;
  register: (email: string, password: string, fullName?: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session from stored token
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const storedToken = localStorage.getItem("udip_access_token");
        if (storedToken) {
          apiClient.setAuthToken(storedToken);
          setToken(storedToken);
          const profile = await apiClient.getMe();
          if (isMounted) {
            setUser(profile);
          }
        }
      } catch (err: any) {
        console.warn("Session restoration failed:", err);
        // Clear invalid token
        apiClient.setAuthToken(null);
        localStorage.removeItem("udip_access_token");
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> => {
      setIsLoading(true);
      try {
        const response = await apiClient.login({ email, password, remember_me: rememberMe });
        setUser(response.user);
        setToken(response.access_token);
        return response;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string, fullName?: string): Promise<AuthResponse> => {
      setIsLoading(true);
      try {
        const response = await apiClient.register({ email, password, full_name: fullName });
        setUser(response.user);
        setToken(response.access_token);
        return response;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiClient.logout();
    } catch {
      // ignore logout network errors
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem("udip_access_token");
    }
  }, []);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const profile = await apiClient.getMe();
      setUser(profile);
      return profile;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
