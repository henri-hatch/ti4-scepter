import type { Socket } from 'socket.io-client'

export interface PlayerInfo {
  gameName: string | null
  playerId: string | null
  playerName: string | null
}

export interface PlayerSummary {
  playerId: string
  name: string
  faction?: string
}

export interface HostingStartedPayload {
  gameName: string
  localIp: string
  players: PlayerSummary[]
}

export interface PlayerEventPayload {
  playerId: string
  playerName: string
}

export interface JoinedGamePayload {
  gameName: string
  playerId: string
  playerName: string
}

export interface LeftGamePayload {
  gameName: string
}

export interface SessionEndedPayload {
  gameName: string
  message?: string
}

export interface SocketErrorPayload {
  message: string
}

export interface SocketContextValue {
  socket: Socket | null
  isConnected: boolean
  playerInfo: PlayerInfo
  connectionType: 'player' | 'host' | null
  initializeSocket: (type: 'player' | 'host') => void
  joinGame: (gameName: string, playerId: string, playerName: string) => void
  leaveGame: () => void
  hostGame: (gameName: string) => void
  stopHosting: () => void
  disconnect: () => void
  onLeftGame: (callback: (data: LeftGamePayload) => void) => (() => void) | undefined
  onSessionEnded: (callback: (data: SessionEndedPayload) => void) => (() => void) | undefined
}
