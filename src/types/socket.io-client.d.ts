declare module 'socket.io-client' {
  interface Socket {
    on(event: string, callback: (...args: any[]) => void): Socket;
    off(event: string, callback?: (...args: any[]) => void): Socket;
    emit(event: string, ...args: any[]): Socket;
    connect(): Socket;
    disconnect(): Socket;
    close(): Socket;
    connected: boolean;
    disconnected: boolean;
  }

  interface ManagerOptions {
    autoConnect?: boolean;
    reconnection?: boolean;
    reconnectionAttempts?: number;
    reconnectionDelay?: number;
    reconnectionDelayMax?: number;
    timeout?: number;
    transports?: string[];
    upgrade?: boolean;
    forceNew?: boolean;
    path?: string;
    extraHeaders?: { [key: string]: string };
  }

  interface SocketOptions extends ManagerOptions {
    query?: { [key: string]: string };
    auth?: { [key: string]: any };
  }

  function io(uri?: string, opts?: Partial<SocketOptions>): Socket;
  export default io;
  export { Socket, ManagerOptions, SocketOptions };
}
