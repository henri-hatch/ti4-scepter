import { useContext } from 'react'
import { SocketContext } from './socketContext'
import type { SocketContextValue } from './socketTypes'

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}
