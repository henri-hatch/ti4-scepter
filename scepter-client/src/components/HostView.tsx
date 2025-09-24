import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSocket } from '../contexts/useSocket'
import type { HostingStartedPayload, PlayerEventPayload, SocketErrorPayload } from '../contexts/socketTypes'
import '../styles/HostView.css'

type Player = HostingStartedPayload['players'][number]

interface LogEntry {
  id: string
  timestamp: string
  message: string
  type: 'info' | 'join' | 'leave' | 'error'
}

interface ObjectiveCompletedPayload {
  playerId?: string
  playerName?: string
  objectiveKey?: string
  objectiveName?: string
  victoryPoints?: number
  totalVictoryPoints?: number
}

function HostView() {
  const navigate = useNavigate()
  const location = useLocation()
  const { socket, isConnected, connectionType, initializeSocket, hostGame, stopHosting } = useSocket()
  const [gameName, setGameName] = useState<string>('')
  const [localIp, setLocalIp] = useState<string>('')
  const [players, setPlayers] = useState<Player[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isConnecting, setIsConnecting] = useState(true)

  // Get game name from location state (passed from HostGameModal)
  const gameNameFromState = location.state?.gameName

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry: LogEntry = {
      id: `${timestamp}-${message}-${type}`, // More unique ID based on content
      timestamp,
      message,
      type
    }
    
    setLogs(prev => {
      // Check if we already have this exact log entry to prevent duplicates
      const isDuplicate = prev.some(log => 
        log.message === message && 
        log.type === type && 
        Math.abs(new Date(`1970-01-01 ${log.timestamp}`).getTime() - new Date(`1970-01-01 ${timestamp}`).getTime()) < 1000
      )
      
      if (isDuplicate) {
        return prev
      }
      
      return [logEntry, ...prev].slice(0, 50) // Keep last 50 logs
    })
  }, [])
  useEffect(() => {
    if (!gameNameFromState) {
      navigate('/')
      return
    }

    // Initialize socket connection for hosting only if not already connected as host
    if (connectionType !== 'host') {
      console.log('Initializing host socket connection')
      initializeSocket('host')
    }
  }, [gameNameFromState, navigate, connectionType, initializeSocket])

  useEffect(() => {
    // Set up socket event listeners and start hosting when socket is ready
    if (socket && connectionType === 'host' && gameNameFromState) {
      setIsConnecting(false)

      const handleHostingStarted = (data: HostingStartedPayload) => {
        setGameName(data.gameName)
        setLocalIp(data.localIp)
        setPlayers(data.players ?? [])
        addLog(`Started hosting game "${data.gameName}" on ${data.localIp}`, 'info')
        addLog(`Game has ${data.players?.length || 0} registered players`, 'info')
      }

      const handlePlayerJoined = (data: PlayerEventPayload) => {
        addLog(`${data.playerName} joined the game`, 'join')
      }

      const handlePlayerLeft = (data: PlayerEventPayload) => {
        addLog(`${data.playerName} left the game`, 'leave')
      }

      const handleObjectiveCompleted = (data: ObjectiveCompletedPayload) => {
        const playerLabel = data.playerName || data.playerId || 'A player'
        const objectiveLabel = data.objectiveName || data.objectiveKey || 'an objective'
        const vpValue = typeof data.victoryPoints === 'number' && !Number.isNaN(data.victoryPoints)
          ? data.victoryPoints
          : null
        const totalValue = typeof data.totalVictoryPoints === 'number' && !Number.isNaN(data.totalVictoryPoints)
          ? data.totalVictoryPoints
          : null

        const messageParts = [`${playerLabel} completed ${objectiveLabel}`]
        if (vpValue !== null) {
          messageParts.push(`(+${vpValue} VP${totalValue !== null ? `, total ${totalValue}` : ''})`)
        }

        addLog(messageParts.join(' '), 'info')
      }

      const handleError = (data: SocketErrorPayload) => {
        addLog(`Error: ${data.message}`, 'error')
      }

      const handleDisconnect = () => {
        setIsConnecting(true)
        addLog('Disconnected from server', 'error')
      }

      const handleConnectError = (error: Error) => {
        addLog(`Connection error: ${error.message}`, 'error')
      }

      socket.on('hosting_started', handleHostingStarted)
      socket.on('player_joined', handlePlayerJoined)
      socket.on('player_left', handlePlayerLeft)
      socket.on('objective_completed', handleObjectiveCompleted)
      socket.on('error', handleError)
      socket.on('disconnect', handleDisconnect)
      socket.on('connect_error', handleConnectError)

      // If connected, start hosting the game
      if (isConnected) {
        addLog(`Connected to server (Session: ${socket.id})`, 'info')
        hostGame(gameNameFromState)
      }

      return () => {
        socket.off('hosting_started', handleHostingStarted)
        socket.off('player_joined', handlePlayerJoined)
        socket.off('player_left', handlePlayerLeft)
        socket.off('objective_completed', handleObjectiveCompleted)
        socket.off('error', handleError)
        socket.off('disconnect', handleDisconnect)
        socket.off('connect_error', handleConnectError)
      }
    }
  }, [socket, connectionType, gameNameFromState, addLog, hostGame, isConnected])

  const handleStopHosting = () => {
    stopHosting()
    navigate('/')
  }

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'join': return '👋'
      case 'leave': return '👋'
      case 'error': return '❌'
      default: return 'ℹ️'
    }
  }

  const getLogClass = (type: LogEntry['type']) => {
    return `log-entry log-${type}`
  }

  if (isConnecting) {
    return (
      <div className="host-view">
        <div className="backdrop" />
        <div className="connecting-overlay">
          <div className="spinner"></div>
          <h2>Connecting to server...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="host-view">
      <div className="backdrop" />
      
      <div className="host-content">
        <div className="host-header">
          <div className="game-info">
            <h1>Hosting: {gameName}</h1>
            {localIp && (
              <div className="connection-info">
                <p><strong>Host IP:</strong> {localIp}</p>
                <p><strong>Players can connect from their devices to join this game</strong></p>
              </div>
            )}
          </div>
          
          <button 
            className="stop-hosting-btn"
            onClick={handleStopHosting}
          >
            Stop Hosting
          </button>
        </div>

        <div className="host-dashboard">
          <div className="players-panel">
            <h3>Registered Players ({players.length})</h3>
            <div className="players-list">
              {players.length === 0 ? (
                <p className="no-players">No players registered for this game</p>
              ) : (
                players.map((player) => (
                  <div key={player.playerId} className="player-item">
                    <div className="player-name">{player.name}</div>
                    <div className="player-id">{player.playerId}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="activity-panel">
            <h3>Activity Log</h3>
            <div className="logs-container">
              {logs.length === 0 ? (
                <p className="no-logs">No activity yet</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className={getLogClass(log.type)}>
                    <span className="log-icon">{getLogIcon(log.type)}</span>
                    <span className="log-timestamp">{log.timestamp}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HostView
