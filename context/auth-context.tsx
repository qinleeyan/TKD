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
    const initAuth = async () => {
      const token = localStorage.getItem("auth_token");
      const role = localStorage.getItem("user_role");
      const username = localStorage.getItem("user_username");

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      // If we have token but missing details (e.g. from old version), fetch them
      if (!role || !username || role === "undefined" || username === "undefined") {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"}/auth/me/`, {
            headers: { "Authorization": `Token ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem("user_role", data.role);
            localStorage.setItem("user_username", data.username);
            setUser({ role: data.role, username: data.username });
          } else {
            logout();
          }
        } catch (err) {
          console.error("Auth initialization failed:", err);
          logout();
        } finally {
          setLoading(false);
        }
      } else {
        // We have everything
        setUser({ role, username });
        setLoading(false);
      }
    };

    initAuth();
  }, []);

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
