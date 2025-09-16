import { createContext } from 'react'
import type { SocketContextValue } from './socketTypes'

export const SocketContext = createContext<SocketContextValue | undefined>(undefined)
