import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSocket } from '../contexts/useSocket'
import type { HostingStartedPayload, PlayerEventPayload, SocketErrorPayload } from '../contexts/socketTypes'
import type { ObjectiveType } from '../types/objectives'
import { resolveAssetPath } from '../utils/assets'
import { formatFactionLabel } from '../utils/technology'
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

type PublicObjectiveSlot = {
  key: string
  name: string
  type: ObjectiveType
  slotIndex: number
  victoryPoints: number
  asset: string
  scoredBy: Array<{
    playerId: string
    playerName?: string
    faction?: string
  }>
}

type ApiPublicObjective = {
  key?: string
  name?: string
  type?: string
  slotIndex?: number
  victoryPoints?: number
  asset?: string
  addedBy?: string
  addedAt?: string
  scoredBy?: Array<{
    playerId?: string
    playerName?: string
    faction?: string
  }>
}

type ObjectiveBoard = Record<'public_tier1' | 'public_tier2', Array<PublicObjectiveSlot | null>>

type SocketPublicObjectivePayload = {
  gameName?: string
  objective?: {
    key?: string
    name?: string
    type?: string
    slotIndex?: number
    victoryPoints?: number
    asset?: string
  }
}

const OBJECTIVE_SLOT_COUNT = 5

function createEmptyBoard(): ObjectiveBoard {
  return {
    public_tier1: Array.from({ length: OBJECTIVE_SLOT_COUNT }, () => null),
    public_tier2: Array.from({ length: OBJECTIVE_SLOT_COUNT }, () => null)
  }
}

const OBJECTIVE_PLACEHOLDERS: Record<'public_tier1' | 'public_tier2', string> = {
  public_tier1: resolveAssetPath('objectives/tier1.back.jpg'),
  public_tier2: resolveAssetPath('objectives/tier2.back.jpg')
}

const getFactionTokenAsset = (faction?: string | null): string | null => {
  if (!faction || faction === 'none') {
    return null
  }
  return resolveAssetPath(`factions/${faction}/token/${faction}.jpg`)
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
  const [publicObjectives, setPublicObjectives] = useState<ObjectiveBoard>(() => createEmptyBoard())
  const hasRequestedHostingRef = useRef(false)

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

  const loadPublicObjectives = useCallback(async (name: string) => {
    if (!name) {
      setPublicObjectives(createEmptyBoard())
      return
    }

    try {
      const response = await fetch(`/api/game/${encodeURIComponent(name)}/objectives/public`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load public objectives')
      }

      const next = createEmptyBoard()
      const entries = (Array.isArray(payload.objectives) ? payload.objectives : []) as ApiPublicObjective[]
      entries.forEach((entry) => {
        const type = entry.type as ObjectiveType
        const rawSlot = entry.slotIndex
        const slotIndex = typeof rawSlot === 'number' && Number.isFinite(rawSlot) ? rawSlot : null
        if ((type === 'public_tier1' || type === 'public_tier2') && slotIndex !== null && slotIndex >= 0 && slotIndex < OBJECTIVE_SLOT_COUNT) {
          const victoryPointsRaw = Number(entry.victoryPoints ?? 0)
          const scoredEntries = Array.isArray(entry.scoredBy) ? entry.scoredBy : []
          const scoredBy = scoredEntries
            .filter((candidate): candidate is { playerId: string; playerName?: string; faction?: string } => typeof candidate?.playerId === 'string')
            .map((player) => ({
              playerId: player.playerId,
              playerName: player.playerName,
              faction: player.faction ?? 'none'
            }))

          next[type][slotIndex] = {
            key: String(entry.key ?? `objective-${type}-${slotIndex}`),
            name: String(entry.name ?? entry.key ?? 'Objective'),
            type,
            slotIndex,
            victoryPoints: Number.isNaN(victoryPointsRaw) ? 0 : victoryPointsRaw,
            asset: String(entry.asset ?? ''),
            scoredBy
          }
        }
      })

      setPublicObjectives(next)
    } catch (err) {
      console.error('Failed to load public objectives', err)
      setPublicObjectives(createEmptyBoard())
    }
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
        setPublicObjectives(createEmptyBoard())
        void loadPublicObjectives(data.gameName)
      }

      const activeGame = gameName || gameNameFromState || ''

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

      const handlePublicObjectiveAdded = (payload: SocketPublicObjectivePayload) => {
        if (!payload || payload.gameName !== activeGame) {
          return
        }

        const objective = payload.objective
        const type = objective?.type as ObjectiveType
        const rawSlot = objective?.slotIndex
        const slotIndex = typeof rawSlot === 'number' && Number.isFinite(rawSlot) ? rawSlot : null
        if (!objective || (type !== 'public_tier1' && type !== 'public_tier2') || slotIndex === null || slotIndex < 0 || slotIndex >= OBJECTIVE_SLOT_COUNT) {
          void loadPublicObjectives(activeGame)
          return
        }

        setPublicObjectives((previous) => {
          const next: ObjectiveBoard = {
            public_tier1: [...previous.public_tier1],
            public_tier2: [...previous.public_tier2]
          }
          next[type][slotIndex] = {
            key: String(objective.key ?? `objective-${type}-${slotIndex}`),
            name: String(objective.name ?? objective.key ?? 'Objective'),
            type,
            slotIndex,
            victoryPoints: Number.isFinite(Number(objective.victoryPoints)) ? Number(objective.victoryPoints) : 0,
            asset: String(objective.asset ?? ''),
            scoredBy: []
          }
          return next
        })
      }

      const handlePublicObjectiveRemoved = (payload: { gameName?: string; objectiveType?: ObjectiveType; slotIndex?: number }) => {
        if (!payload || payload.gameName !== activeGame) {
          return
        }

        const type = payload.objectiveType
        const rawSlot = payload.slotIndex
        const slotIndex = typeof rawSlot === 'number' && Number.isFinite(rawSlot) ? rawSlot : null
        if ((type !== 'public_tier1' && type !== 'public_tier2') || slotIndex === null || slotIndex < 0 || slotIndex >= OBJECTIVE_SLOT_COUNT) {
          void loadPublicObjectives(activeGame)
          return
        }

        setPublicObjectives((previous) => {
          const next: ObjectiveBoard = {
            public_tier1: [...previous.public_tier1],
            public_tier2: [...previous.public_tier2]
          }
          next[type][slotIndex] = null
          return next
        })
      }

      const handleObjectiveScoringState = (payload: {
        gameName?: string
        objectiveType?: ObjectiveType
        slotIndex?: number
        playerId?: string
        playerName?: string
        playerFaction?: string
        isCompleted?: boolean
      }) => {
        if (!payload || payload.gameName !== activeGame) {
          return
        }

        const type = payload.objectiveType
        const rawSlot = payload.slotIndex
        const slotIndex = typeof rawSlot === 'number' && Number.isFinite(rawSlot) ? rawSlot : null
        if ((type !== 'public_tier1' && type !== 'public_tier2') || slotIndex === null || slotIndex < 0 || slotIndex >= OBJECTIVE_SLOT_COUNT) {
          return
        }

        const playerId = payload.playerId
        if (!playerId) {
          return
        }

        let shouldReload = false
        setPublicObjectives((previous) => {
          const currentSlot = previous[type][slotIndex]
          if (!currentSlot) {
            shouldReload = true
            return previous
          }

          const next: ObjectiveBoard = {
            public_tier1: [...previous.public_tier1],
            public_tier2: [...previous.public_tier2]
          }
          const updatedSlot: PublicObjectiveSlot = {
            ...currentSlot,
            scoredBy: [...currentSlot.scoredBy]
          }

          const existingIndex = updatedSlot.scoredBy.findIndex((entry) => entry.playerId === playerId)
          if (payload.isCompleted) {
            const tokenEntry = {
              playerId,
              playerName: payload.playerName,
              faction: payload.playerFaction ?? 'none'
            }
            if (existingIndex >= 0) {
              updatedSlot.scoredBy[existingIndex] = tokenEntry
            } else {
              updatedSlot.scoredBy.push(tokenEntry)
            }
          } else if (existingIndex >= 0) {
            updatedSlot.scoredBy.splice(existingIndex, 1)
          }

          next[type][slotIndex] = updatedSlot
          return next
        })

        if (shouldReload && activeGame) {
          void loadPublicObjectives(activeGame)
        }
      }

      const handleError = (data: SocketErrorPayload) => {
        addLog(`Error: ${data.message}`, 'error')
      }

      const handleDisconnect = () => {
        setIsConnecting(true)
        setPublicObjectives(createEmptyBoard())
        addLog('Disconnected from server', 'error')
        hasRequestedHostingRef.current = false
      }

      const handleConnectError = (error: Error) => {
        addLog(`Connection error: ${error.message}`, 'error')
      }

      socket.on('hosting_started', handleHostingStarted)
      socket.on('player_joined', handlePlayerJoined)
      socket.on('player_left', handlePlayerLeft)
      socket.on('objective_completed', handleObjectiveCompleted)
      socket.on('public_objective_added', handlePublicObjectiveAdded)
      socket.on('public_objective_removed', handlePublicObjectiveRemoved)
      socket.on('objective_scoring_state', handleObjectiveScoringState)
      socket.on('error', handleError)
      socket.on('disconnect', handleDisconnect)
      socket.on('connect_error', handleConnectError)

      // If connected, start hosting the game
      if (isConnected && !hasRequestedHostingRef.current) {
        addLog(`Connected to server (Session: ${socket.id})`, 'info')
        hostGame(gameNameFromState)
        hasRequestedHostingRef.current = true
      }

      return () => {
        socket.off('hosting_started', handleHostingStarted)
        socket.off('player_joined', handlePlayerJoined)
        socket.off('player_left', handlePlayerLeft)
        socket.off('objective_completed', handleObjectiveCompleted)
        socket.off('public_objective_added', handlePublicObjectiveAdded)
        socket.off('public_objective_removed', handlePublicObjectiveRemoved)
        socket.off('objective_scoring_state', handleObjectiveScoringState)
        socket.off('error', handleError)
        socket.off('disconnect', handleDisconnect)
        socket.off('connect_error', handleConnectError)
      }
    }
  }, [socket, connectionType, gameNameFromState, addLog, hostGame, isConnected, gameName, loadPublicObjectives])

  useEffect(() => {
    hasRequestedHostingRef.current = false
  }, [gameNameFromState])

  useEffect(() => {
    if (!isConnected) {
      hasRequestedHostingRef.current = false
    }
  }, [isConnected])

  useEffect(() => {
    if (gameName) {
      void loadPublicObjectives(gameName)
    } else {
      setPublicObjectives(createEmptyBoard())
    }
  }, [gameName, loadPublicObjectives])

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

  const formatFaction = (value?: string) => {
    const label = formatFactionLabel(value ?? null)
    return label ? `Player Faction: ${label}` : 'Player Faction: Unassigned'
  }

  const renderObjectiveRow = (type: 'public_tier1' | 'public_tier2') => {
    const slots = publicObjectives[type]
    return (
      <div className={`objective-board-row objective-board-row--${type === 'public_tier1' ? 'tier1' : 'tier2'}`}>
        {slots.map((slot, index) => {
          const placeholder = OBJECTIVE_PLACEHOLDERS[type]
          const cardImage = slot?.asset ? resolveAssetPath(slot.asset) : placeholder
          const slotKey = slot ? slot.key : `${type}-${index}`
          return (
            <div key={slotKey} className={`objective-board-slot ${slot ? 'is-filled' : ''}`}>
              <img
                className={`objective-board-card ${slot ? '' : 'is-placeholder'}`}
                src={cardImage}
                alt={slot ? `${slot.name} objective` : `${type === 'public_tier1' ? 'Stage I' : 'Stage II'} objective slot ${index + 1}`}
                draggable={false}
              />
              {slot ? (
                <>
                  <div className="objective-board-label">
                    <span className="objective-board-name">{slot.name}</span>
                    <span className="objective-board-vp">{slot.victoryPoints} VP</span>
                  </div>
                  {slot.scoredBy.length ? (
                    <div className="objective-board-tokens">
                      {slot.scoredBy.map((player) => {
                        const tokenAsset = getFactionTokenAsset(player.faction)
                        if (!tokenAsset) {
                          return null
                        }
                        const tokenKey = `${slot.key}-${player.playerId}`
                        return (
                          <img
                            key={tokenKey}
                            src={tokenAsset}
                            alt={`${player.playerName ?? 'Player'} token`}
                            title={player.playerName ?? 'Player'}
                            draggable={false}
                          />
                        )
                      })}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    )
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
          <div className="objective-board-panel">
            <h3>Public Objectives</h3>
            <div className="objective-board">
              <div className="objective-board-heading">Stage I</div>
              {renderObjectiveRow('public_tier1')}
              <div className="objective-board-heading">Stage II</div>
              {renderObjectiveRow('public_tier2')}
            </div>
          </div>

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
                    <div className={player.faction && player.faction !== 'none' ? 'player-faction-label' : 'player-faction-label none'}>
                      {formatFaction(player.faction)}
                    </div>
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
