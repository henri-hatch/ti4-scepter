import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'

export interface PlayerInfo {
  gameName: string | null
  playerId: string | null
  playerName: string | null
}

interface SocketContextType {
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
  onLeftGame: (callback: (data: any) => void) => (() => void) | undefined
  onSessionEnded: (callback: (data: any) => void) => (() => void) | undefined
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export const useSocket = () => {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}

interface SocketProviderProps {
  children: ReactNode
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionType, setConnectionType] = useState<'player' | 'host' | null>(null)
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo>({
    gameName: null,
    playerId: null,
    playerName: null
  })
  const initializeSocket = useCallback((type: 'player' | 'host') => {
    // If we already have a socket of the same type that's connected, don't recreate
    if (socket && connectionType === type && socket.connected) {
      console.log(`Socket already connected for type: ${type}`)
      return
    }

    // If we already have a socket of the same type but it's not connected, try to reconnect
    if (socket && connectionType === type && !socket.connected) {
      console.log(`Reconnecting existing socket for type: ${type}`)
      socket.connect()
      return
    }

    // Only create a new socket if we don't have one or if the type is different
    if (!socket || connectionType !== type) {
      console.log(`Creating new socket for type: ${type}`)
      
      // Clean up existing socket if type is different
      if (socket && connectionType !== type) {
        socket.disconnect()
      }

      const newSocket = io({
        query: { type },
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      })

      setSocket(newSocket)
      setConnectionType(type)

      newSocket.on('connect', () => {
        setIsConnected(true)
        console.log(`${type} connected to server`)
      })

      newSocket.on('disconnect', () => {
        setIsConnected(false)
        console.log(`${type} disconnected from server`)
      })

      // Player-specific events
      if (type === 'player') {
        newSocket.on('joined_game', (data) => {
          setPlayerInfo({
            gameName: data.gameName,
            playerId: data.playerId,
            playerName: data.playerName
          })
          console.log('Successfully joined game as:', data.playerName)
        })

        newSocket.on('left_game', (data) => {
          setPlayerInfo({
            gameName: null,
            playerId: null,
            playerName: null
          })
          console.log('Left game:', data.gameName)
        })

        newSocket.on('session_ended', (data: any) => {
          setPlayerInfo({
            gameName: null,
            playerId: null,
            playerName: null
          })
          console.log('Game session ended:', data.gameName)
        })
      }

      newSocket.on('error', (data) => {
        console.error('Socket error:', data.message)
      })
    }
  }, [socket, connectionType]) // Only depend on socket and connectionType

  const joinGame = useCallback((gameName: string, playerId: string, playerName: string) => {
    if (!socket || connectionType !== 'player') {
      console.error('Cannot join game: No player socket connection')
      return
    }

    socket.emit('join_game', {
      gameName,
      playerId,
      playerName
    })
  }, [socket, connectionType])

  const leaveGame = useCallback(() => {
    if (!socket || connectionType !== 'player') {
      console.error('Cannot leave game: No player socket connection')
      return
    }

    socket.emit('leave_game')
  }, [socket, connectionType])

  const hostGame = useCallback((gameName: string) => {
    if (!socket || connectionType !== 'host') {
      console.error('Cannot host game: No host socket connection')
      return
    }

    socket.emit('host_game', { gameName })
  }, [socket, connectionType])

  const stopHosting = useCallback(() => {
    if (!socket || connectionType !== 'host') {
      console.error('Cannot stop hosting: No host socket connection')
      return
    }

    socket.disconnect()
  }, [socket, connectionType])
  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect()
      setSocket(null)
      setConnectionType(null)
      setIsConnected(false)
      setPlayerInfo({
        gameName: null,
        playerId: null,
        playerName: null
      })
    }
  }, [socket])
  const onLeftGame = useCallback((callback: (data: any) => void) => {
    if (socket && connectionType === 'player') {
      socket.on('left_game', callback)
      return () => socket.off('left_game', callback)
    }
  }, [socket, connectionType])

  const onSessionEnded = useCallback((callback: (data: any) => void) => {
    if (socket && connectionType === 'player') {
      socket.on('session_ended', callback)
      return () => socket.off('session_ended', callback)
    }
  }, [socket, connectionType])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [socket])
  const value: SocketContextType = {
    socket,
    isConnected,
    playerInfo,
    connectionType,
    initializeSocket,
    joinGame,
    leaveGame,
    hostGame,
    stopHosting,
    disconnect,
    onLeftGame,
    onSessionEnded
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}
