"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  role: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, role: string, username: string) => void;
  logout: () => void;
  checkAccess: (role: string, pathname: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkAccess = useCallback((role: string, path: string) => {
    if (role === "superadmin") return true;
    if (path.startsWith("/registrasi") && role === "register") return true;
    if (path.startsWith("/operator") && role === "operator") return true;
    if (path.startsWith("/matches") && role === "match") return true;
    if (path.startsWith("/dashboard") && role === "superadmin") return true;
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_username");
    setUser(null);
    window.location.href = "/";
  }, []);

  const login = useCallback((token: string, role: string, username: string) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("user_role", role);
    localStorage.setItem("user_username", username);
    setUser({ role, username });
    
    // Initial redirect
    if (role === "register") router.push("/registrasi");
    else if (role === "operator") router.push("/operator");
    else if (role === "match") router.push("/matches");
    else if (role === "superadmin") router.push("/dashboard");
    else router.push("/");
  }, [router]);

  useEffect(() => {
    const initAuth = () => {
      const role = localStorage.getItem("user_role");
      const username = localStorage.getItem("user_username");
      const token = localStorage.getItem("auth_token");

      if (!token) {
        setUser(null);
        setLoading(false);
        // Protected route check
        const protectedPaths = ["/dashboard", "/registrasi", "/operator", "/matches"];
        if (protectedPaths.some(p => pathname.startsWith(p))) {
          router.push("/login");
        }
        return;
      }

      if (role && role !== "undefined" && role !== "null") {
        setUser({ role });
        
        const protectedPaths = ["/dashboard", "/registrasi", "/operator", "/matches"];
        if (protectedPaths.some(p => pathname.startsWith(p))) {
          if (!checkAccess(role, pathname)) {
            // Redirect to appropriate page
            if (role === "register") router.replace("/registrasi");
            else if (role === "operator") router.replace("/operator");
            else if (role === "match") router.replace("/matches");
            else if (role === "superadmin") router.replace("/dashboard");
            else router.replace("/");
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();
  }, [pathname, router, checkAccess]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAccess }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
