"use client";

import { useState, useEffect, useRef } from "react";
import fpPromise from "@fingerprintjs/fingerprintjs";
import { AlertTriangle, Lock, CheckCircle } from "lucide-react";

interface ActiveSessionModalProps {
  courseId: string;
  date: string;
  studentRollNo: string;
  idToken: string;
  onClose: () => void;
}

export default function ActiveSessionModal({ courseId, date, studentRollNo, idToken, onClose }: ActiveSessionModalProps) {
  const [otp, setOtp] = useState("");
  const [deviceHash, setDeviceHash] = useState<string | null>(null);
  
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const strikes = useRef(0);
  const blurTimeout = useRef<NodeJS.Timeout | null>(null);

  // 1. Initialize FingerprintJS
  useEffect(() => {
    const loadFingerprint = async () => {
      const fp = await fpPromise.load();
      const result = await fp.get();
      setDeviceHash(result.visitorId);
    };
    loadFingerprint();
  }, []);

  // 2. The 2-Strike Focus Rule (window.onblur)
  useEffect(() => {
    const handleBlur = () => {
      if (isLocked || status === "success") return;
      strikes.current += 1;
      blurTimeout.current = setTimeout(() => {
        setIsLocked(true);
        setLockReason("Submission Locked: You left the tab for more than 3 seconds.");
      }, 3000);
    };

    const handleFocus = () => {
      if (isLocked || status === "success") return;
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
      if (strikes.current >= 2) {
        setIsLocked(true);
        setLockReason("Submission Locked: You switched tabs twice during an active session.");
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, [isLocked, status]);

  const handleSubmit = async () => {
    if (isLocked || !deviceHash || otp.length !== 4) return;
    setStatus("submitting");

    try {
      const res = await fetch("/api/attendance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, date, studentRollNo, otp, deviceHash, idToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Submission failed.");
      } else {
        setStatus("success");
        setTimeout(onClose, 3000);
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      <div className="w-full max-w-md bg-surface border-2 border-accentRed rounded-xl shadow-[0_0_30px_rgba(255,0,51,0.2)] p-6 flex flex-col items-center text-center">
        <div className="w-full flex justify-between items-center mb-6">
          <div className="flex items-center text-accentRed font-bold animate-pulse">
            <div className="w-3 h-3 rounded-full bg-accentRed mr-2"></div>
            ACTIVE SESSION
          </div>
          <div className="text-textSecondary text-sm font-mono">{courseId}</div>
        </div>

        {isLocked ? (
          <div className="flex flex-col items-center py-8">
            <Lock className="w-16 h-16 text-danger mb-4" />
            <h2 className="text-xl font-bold text-danger mb-2">SECURITY LOCKOUT</h2>
            <p className="text-textSecondary text-sm">{lockReason}</p>
            <p className="text-xs text-textSecondary mt-4">Please see the TA to manually record attendance.</p>
          </div>
        ) : status === "success" ? (
          <div className="flex flex-col items-center py-8">
            <CheckCircle className="w-16 h-16 text-success mb-4" />
            <h2 className="text-xl font-bold text-success">Attendance Recorded</h2>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-textPrimary mb-2">Enter OTP or Scan QR</h2>
            <p className="text-textSecondary text-sm mb-6">Do not switch tabs. You are being monitored.</p>
            
            <input
              type="text"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-48 text-center text-4xl tracking-[0.5em] font-mono bg-background border border-textSecondary/30 rounded-lg py-4 text-textPrimary focus:outline-none focus:border-accentRed focus:ring-1 focus:ring-accentRed transition-all mb-6"
              placeholder="••••"
            />

            {status === "error" && (
              <div className="flex items-center text-danger text-sm mb-4 bg-danger/10 p-2 rounded w-full">
                <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={otp.length !== 4 || status === "submitting"}
              className="w-full bg-accentRed hover:bg-accentRed/80 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "submitting" ? "Verifying..." : "Submit Attendance"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}