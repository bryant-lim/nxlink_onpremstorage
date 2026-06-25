"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/providers/toast-provider";

export default function ConnectionStatus() {
  const { addToast } = useToast();
  const [connected, setConnected] = useState<boolean | null>(null);
  const prevConnected = useRef<boolean | null>(null);

  const checkStatus = async () => {
    try {
      const res = await fetch(
        "http://localhost:3009/api/configs/status/public",
      );

      if (!res.ok) {
        setConnected(false);
        return;
      }

      const data = await res.json();
      const isConnected = data.connected === true;

      if (
        prevConnected.current !== null &&
        prevConnected.current !== isConnected
      ) {
        if (isConnected) {
          addToast("NXLink server connected", "success");
        } else {
          addToast(
            `NXLink server disconnected${data.error ? `: ${data.error}` : ""}`,
            "error",
          );
        }
      }

      setConnected(isConnected);
      prevConnected.current = isConnected;
    } catch {
      if (prevConnected.current !== null && prevConnected.current !== false) {
        addToast("NXLink server disconnected", "error");
      }
      setConnected(false);
      prevConnected.current = false;
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  if (connected === null) {
    return (
      <div className="mt-1 h-2 w-2 animate-pulse rounded-full bg-gray-300" />
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <div
        className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
      />
      <span className="text-xs text-gray-500">
        {connected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}
