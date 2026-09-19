import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMessage, StateMessage } from "../../shared/src/index.ts";
import { MESSAGE_TYPE, WS_PATH } from "../../shared/src/index.ts";
import { RECONNECT_DELAY_MS } from "./constants.ts";

export const SOCKET_STATUS = {
  connecting: "connecting",
  open: "open",
  closed: "closed",
} as const;
export type SocketStatus = (typeof SOCKET_STATUS)[keyof typeof SOCKET_STATUS];

function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${WS_PATH}`;
}

export interface JevSocket {
  status: SocketStatus;
  send: (message: StateMessage) => boolean;
}

/** Keeps one websocket open to the backend and hands every parsed server message to `onMessage`. */
export function useJevSocket(onMessage: (message: ServerMessage) => void): JevSocket {
  const [status, setStatus] = useState<SocketStatus>(SOCKET_STATUS.connecting);
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = (): void => {
      setStatus(SOCKET_STATUS.connecting);
      const socket = new WebSocket(socketUrl());
      socketRef.current = socket;
      socket.onopen = () => setStatus(SOCKET_STATUS.open);
      socket.onmessage = (event: MessageEvent<string>) => {
        const parsed = JSON.parse(event.data) as ServerMessage;
        if (Object.values(MESSAGE_TYPE).includes(parsed.type)) {
          handlerRef.current(parsed);
        }
      };
      socket.onclose = () => {
        setStatus(SOCKET_STATUS.closed);
        socketRef.current = null;
        if (!disposed) {
          timer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    };
    connect();

    return () => {
      disposed = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket === null) {
        return;
      }
      socket.onmessage = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.CONNECTING) {
        // A close during CONNECTING logs a browser warning. Close once the handshake ends.
        socket.onopen = () => socket.close();
        socket.onerror = () => socket.close();
        return;
      }
      socket.close();
    };
  }, []);

  const send = useCallback((message: StateMessage): boolean => {
    const socket = socketRef.current;
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  return { status, send };
}
