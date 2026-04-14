"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, ShieldCheck, AlertTriangle, LogOut, GraduationCap, Users } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";

const ALLOWED_DOMAIN = "@ahduni.edu.in";

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Double-check domain on initial load just in case
        if (currentUser.email?.endsWith(ALLOWED_DOMAIN)) {
          setUser(currentUser);
        } else {
          signOut(auth);
          setError(`Unauthorized: Please use your official Ahmedabad University email.`);
        }
      } else {
        setUser(null);
      }
      setIsAuthenticating(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsAuthenticating(true);
    try {
      const provider = new GoogleAuthProvider();
      // Force Google to prompt for the specific university domain
      provider.setCustomParameters({ hd: "ahduni.edu.in" }); 
      
      const result = await signInWithPopup(auth, provider);
      
      // Strict Domain Check
      if (!result.user.email?.endsWith(ALLOWED_DOMAIN)) {
        await signOut(auth);
        setError("Unauthorized: Please use your official Ahmedabad University email.");
        setUser(null);
      } else {
        setUser(result.user);
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      setError("Authentication failed. Please try again.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background text-textPrimary flex flex-col transition-colors duration-300">
      {/* Header & Theme Toggle */}
      <header className="p-6 flex justify-end">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-3 rounded-full bg-surface border border-textSecondary/20 hover:border-accentRed transition-colors"
        >
          {theme === "dark" ? <Sun className="w-5 h-5 text-warning" /> : <Moon className="w-5 h-5 text-textPrimary" />}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-surface border border-textSecondary/20 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
          
          {/* Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-accentRed" />

          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-background border-2 border-accentRed rounded-full flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(255,0,51,0.2)]">
              <ShieldCheck className="w-8 h-8 text-accentRed" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Ahmedabad University</h1>
            <p className="text-textSecondary text-sm mt-2 uppercase tracking-widest">Secure Attendance Portal</p>
          </div>

          {isAuthenticating ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-accentRed border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !user ? (
            <div className="space-y-6">
              {error && (
                <div className="bg-danger/10 border border-danger/50 text-danger p-4 rounded-lg flex items-start text-left text-sm">
                  <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
              
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center bg-background border border-textSecondary/30 hover:border-accentRed hover:text-accentRed text-textPrimary font-bold py-4 px-6 rounded-xl transition-all group"
              >
                <svg className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with University SSO
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center pb-4 border-b border-textSecondary/20">
                <p className="text-sm text-textSecondary">Welcome back,</p>
                <p className="font-bold text-lg truncate">{user.email}</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => router.push("/student")}
                  className="flex items-center p-4 bg-background border border-textSecondary/20 hover:border-accentRed rounded-xl transition-all group"
                >
                  <div className="bg-surface p-3 rounded-lg group-hover:bg-accentRed/10 transition-colors">
                    <GraduationCap className="w-6 h-6 text-textPrimary group-hover:text-accentRed transition-colors" />
                  </div>
                  <div className="ml-4 text-left">
                    <h3 className="font-bold text-lg group-hover:text-accentRed transition-colors">Student Portal</h3>
                    <p className="text-xs text-textSecondary">Submit attendance & view stats</p>
                  </div>
                </button>

                <button
                  onClick={() => router.push("/ta")}
                  className="flex items-center p-4 bg-background border border-textSecondary/20 hover:border-warning rounded-xl transition-all group"
                >
                  <div className="bg-surface p-3 rounded-lg group-hover:bg-warning/10 transition-colors">
                    <Users className="w-6 h-6 text-textPrimary group-hover:text-warning transition-colors" />
                  </div>
                  <div className="ml-4 text-left">
                    <h3 className="font-bold text-lg group-hover:text-warning transition-colors">TA Dashboard</h3>
                    <p className="text-xs text-textSecondary">Manage sessions & exports</p>
                  </div>
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center text-sm text-textSecondary hover:text-danger transition-colors pt-4"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}