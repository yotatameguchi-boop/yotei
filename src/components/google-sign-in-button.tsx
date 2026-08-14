"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { GOOGLE_CALENDAR_SCOPES } from "@/lib/google-config";

type TokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
            }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

type GoogleSignInButtonProps = {
  clientId: string;
  onConnected: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
  label?: string;
};

export function GoogleSignInButton({
  clientId,
  onConnected,
  onError,
  disabled = false,
  label = "Googleカレンダーと連携",
}: GoogleSignInButtonProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const tokenClientRef = useRef<TokenClient | null>(null);
  const onConnectedRef = useRef(onConnected);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onConnectedRef.current = onConnected;
    onErrorRef.current = onError;
  }, [onConnected, onError]);

  const persistToken = useCallback(async (accessToken: string, expiresIn: number) => {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, expiresIn }),
    });

    if (!response.ok) {
      throw new Error("セッションの保存に失敗しました");
    }
  }, []);

  const initClient = useCallback(() => {
    if (!window.google || !clientId) {
      return;
    }

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPES,
      callback: (response) => {
        setConnecting(false);

        if (response.error || !response.access_token) {
          onErrorRef.current("Googleカレンダーへの接続がキャンセルされました");
          return;
        }

        void persistToken(response.access_token, response.expires_in ?? 3600)
          .then(() => onConnectedRef.current())
          .catch((error: unknown) => {
            onErrorRef.current(
              error instanceof Error ? error.message : "接続に失敗しました",
            );
          });
      },
    });
  }, [clientId, persistToken]);

  useEffect(() => {
    if (scriptReady) {
      initClient();
    }
  }, [scriptReady, initClient]);

  function connect(prompt: "" | "consent" = "consent") {
    if (!tokenClientRef.current) {
      onError("Google Sign-In の読み込み中です。少し待ってからお試しください。");
      return;
    }

    setConnecting(true);
    tokenClientRef.current.requestAccessToken({ prompt });
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <button
        type="button"
        className="btn-primary inline-flex items-center gap-2"
        disabled={disabled || connecting || !scriptReady}
        onClick={() => connect("consent")}
      >
        <GoogleIcon />
        {connecting ? "接続中..." : label}
      </button>
    </>
  );
}

export function useGoogleTokenRefresh(clientId: string, connected: boolean) {
  const tokenClientRef = useRef<TokenClient | null>(null);

  const refreshSilently = useCallback(async () => {
    if (!clientId || !window.google) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      tokenClientRef.current = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_CALENDAR_SCOPES,
        callback: (response) => {
          if (response.error || !response.access_token) {
            resolve(false);
            return;
          }

          void fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: response.access_token,
              expiresIn: response.expires_in ?? 3600,
            }),
          }).then((result) => resolve(result.ok));
        },
      });

      tokenClientRef.current.requestAccessToken({ prompt: "" });
    });
  }, [clientId]);

  useEffect(() => {
    if (!connected || !clientId) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetch("/api/auth/status")
        .then((response) => response.json())
        .then((data: { expiringSoon?: boolean }) => {
          if (data.expiringSoon) {
            void refreshSilently();
          }
        });
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [connected, clientId, refreshSilently]);

  return { refreshSilently };
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-5.522 0-10-4.478-10-10s4.478-10 10-10c2.837 0 5.352 1.178 7.188 3.068l5.657-5.657C34.046 10.671 29.268 8 24 8 12.955 8 4 16.955 4 28s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.82C14.655 16.108 18.961 13 24 13c2.837 0 5.352 1.178 7.188 3.068l5.657-5.657C34.046 10.671 29.268 8 24 8 16.318 8 9.656 12.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 48c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 38.967 26.715 40 24 40c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 43.901 16.227 48 24 48z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l6.19 5.238C42.022 35.026 44 31.926 44 28c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
