import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import '../styles/HostView.css'

interface Player {
  playerId: string
  name: string
}

interface LogEntry {
  id: string
  timestamp: string
  message: string
  type: 'info' | 'join' | 'leave' | 'error'
}

function HostView() {
  const navigate = useNavigate()
  const location = useLocation()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [gameName, setGameName] = useState<string>('')
  const [localIp, setLocalIp] = useState<string>('')
  const [players, setPlayers] = useState<Player[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isConnecting, setIsConnecting] = useState(true)

  // Get game name from location state (passed from HostGameModal)
  const gameNameFromState = location.state?.gameName

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }
    setLogs(prev => [logEntry, ...prev].slice(0, 50)) // Keep last 50 logs
  }

  useEffect(() => {
    if (!gameNameFromState) {
      navigate('/')
      return
    }

    // Initialize socket connection
    const newSocket = io()
    setSocket(newSocket)

    // Socket event handlers
    newSocket.on('connect', () => {
      setIsConnecting(false)
      addLog(`Connected to server (Session: ${newSocket.id})`, 'info')
      
      // Start hosting the game
      newSocket.emit('host_game', { gameName: gameNameFromState })
    })

    newSocket.on('hosting_started', (data: any) => {
      setGameName(data.gameName)
      setLocalIp(data.localIp)
      setPlayers(data.players || [])
      addLog(`Started hosting game "${data.gameName}" on ${data.localIp}`, 'info')
      addLog(`Game has ${data.players?.length || 0} registered players`, 'info')
    })

    newSocket.on('player_joined', (data: any) => {
      addLog(`${data.playerName} joined the game`, 'join')
    })

    newSocket.on('player_left', (data: any) => {
      addLog(`${data.playerName} left the game`, 'leave')
    })

    newSocket.on('error', (data: any) => {
      addLog(`Error: ${data.message}`, 'error')
    })

    newSocket.on('disconnect', () => {
      setIsConnecting(true)
      addLog('Disconnected from server', 'error')
    })

    newSocket.on('connect_error', (error: any) => {
      addLog(`Connection error: ${error.message}`, 'error')
    })

    return () => {
      newSocket.close()
    }
  }, [gameNameFromState, navigate])

  const handleStopHosting = () => {
    if (socket) {
      socket.disconnect()
    }
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
