import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../contexts/useSocket'
import type { JoinedGamePayload, SocketErrorPayload } from '../contexts/socketTypes'
import '../styles/JoinGameModal.css'

interface ActiveGame {
  name: string
  hostIp: string
  createdAt: string
  lastActivity: string
  playerCount: number
  connectedPlayers: number
}

interface Player {
  playerId: string
  name: string
  faction: string
}

interface JoinGameModalProps {
  isOpen: boolean
  onClose: () => void
}

function JoinGameModal({ isOpen, onClose }: JoinGameModalProps) {
  const navigate = useNavigate()
  const { socket, connectionType, initializeSocket, joinGame } = useSocket()
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([])
  const [selectedGame, setSelectedGame] = useState<string>('')
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [step, setStep] = useState<'select-game' | 'select-player'>('select-game')

  const handleClose = useCallback(() => {
    setSelectedGame('')
    setSelectedPlayer('')
    setAvailablePlayers([])
    setError('')
    setStep('select-game')
    onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      // Initialize socket connection for joining only if not already connected as player
      if (connectionType !== 'player') {
        console.log('Initializing player socket for joining game')
        initializeSocket('player')
      }

      // Fetch active games
      fetchActiveGames()
    }
  }, [isOpen, connectionType, initializeSocket])

  useEffect(() => {
    // Set up socket event listeners when socket is available
    if (socket && isOpen) {
      const handleJoinedGame = (data: JoinedGamePayload) => {
        console.log('Successfully joined game:', data)
        handleClose()
        navigate('/player', { 
          state: { 
            gameName: data.gameName,
            playerId: data.playerId,
            playerName: data.playerName
          }
        })
      }

      const handleError = (data: SocketErrorPayload) => {
        console.error('Socket error:', data.message)
        setError(data.message)
        setIsLoading(false)
        
        // If joining failed, close modal and return to home after showing error for 3 seconds
        setTimeout(() => {
          handleClose()
        }, 3000)
      }

      socket.on('joined_game', handleJoinedGame)
      socket.on('error', handleError)

      return () => {
        socket.off('joined_game', handleJoinedGame)
        socket.off('error', handleError)
      }
    }
  }, [socket, isOpen, navigate, handleClose])

  const fetchActiveGames = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/active-games')
      if (response.ok) {
        const data = await response.json()
        setActiveGames(data.games || [])
      } else {
        setError('Failed to fetch active games')
      }
    } catch (error) {
      console.error('Failed to fetch active games:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchGamePlayers = async (gameName: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/players`)
      if (response.ok) {
        const data = await response.json()
        const players: Player[] = Array.isArray(data.players)
          ? data.players.map((player: Player) => ({
              playerId: player.playerId,
              name: player.name,
              faction: (player.faction ?? 'none').toLowerCase()
            }))
          : []
        setAvailablePlayers(players)
        setStep('select-player')
      } else {
        setError('Failed to fetch game players')
      }
    } catch (error) {
      console.error('Failed to fetch game players:', error)
      setError('Failed to fetch game players')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGameSelect = (gameName: string) => {
    setSelectedGame(gameName)
    setError('')
  }
  const handleGameContinue = () => {
    if (!selectedGame) {
      setError('Please select a game')
      return
    }
    fetchGamePlayers(selectedGame)
  }
  const handleJoinGame = () => {
    if (!selectedPlayer) {
      setError('Please select a player')
      return
    }

    const selectedPlayerInfo = availablePlayers.find(p => p.playerId === selectedPlayer)
    if (!selectedPlayerInfo) {
      setError('Invalid player selection')
      return
    }

    setIsLoading(true)
    joinGame(selectedGame, selectedPlayer, selectedPlayerInfo.name)
  }

  const handleBack = () => {
    if (step === 'select-player') {
      setStep('select-game')
      setSelectedPlayer('')
      setAvailablePlayers([])
    }
  }
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFactionName = (factionKey: string) => {
    if (!factionKey || factionKey === 'none') {
      return 'Faction: Unassigned'
    }
    const label = factionKey
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
    return `Faction: ${label}`
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {step === 'select-game' ? 'Join Game' : `Join "${selectedGame}"`}
          </h2>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {step === 'select-game' && (
            <div className="games-section">
              <div className="section-header">
                <h3>Active Games</h3>
                <button 
                  className="refresh-button"
                  onClick={fetchActiveGames}
                  disabled={isLoading}
                >
                  🔄 Refresh
                </button>
              </div>

              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading active games...</p>
                </div>
              ) : activeGames.length === 0 ? (
                <div className="no-games">
                  <p>No active games found.</p>
                  <p>Ask your host to start hosting a game session.</p>
                </div>
              ) : (
                <div className="games-list">
                  {activeGames.map((game) => (
                    <div 
                      key={game.name}
                      className={`game-item ${selectedGame === game.name ? 'selected' : ''}`}
                      onClick={() => handleGameSelect(game.name)}
                    >
                      <div className="game-header">
                        <div className="game-name">{game.name}</div>
                        <div className="game-status">
                          <span className="status-dot"></span>
                          Active
                        </div>
                      </div>
                      <div className="game-details">
                        <div className="detail-item">
                          <span className="label">Host:</span>
                          <span className="value">{game.hostIp}</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Players:</span>
                          <span className="value">{game.connectedPlayers}/{game.playerCount}</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Last Activity:</span>
                          <span className="value">{formatDate(game.lastActivity)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'select-player' && (
            <div className="players-section">
              <h3>Select Your Player</h3>
              
              {isLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading players...</p>
                </div>
              ) : availablePlayers.length === 0 ? (
                <div className="no-players">
                  <p>No players found for this game.</p>
                </div>
              ) : (
                <div className="players-list">
                  {availablePlayers.map((player) => (
                    <div
                      key={player.playerId}
                      className={`player-item ${selectedPlayer === player.playerId ? 'selected' : ''}`}
                      onClick={() => setSelectedPlayer(player.playerId)}
                    >
                      <div className="player-name">{player.name}</div>
                      <div className="player-meta">
                        <span className="player-faction">{formatFactionName(player.faction)}</span>
                        <span className="player-id">{player.playerId.substring(0, 8)}...</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions">
          {step === 'select-player' && (
            <button 
              onClick={handleBack}
              className="action-button secondary"
              disabled={isLoading}
            >
              Back
            </button>
          )}
          
          {step === 'select-game' ? (
            <button 
              onClick={handleGameContinue}
              disabled={!selectedGame || isLoading}
              className="action-button primary"
            >
              Continue
            </button>
          ) : (
            <button 
              onClick={handleJoinGame}
              disabled={!selectedPlayer || isLoading}
              className="action-button primary"
            >
              {isLoading ? 'Joining...' : 'Join Game'}
            </button>
          )}
          
          <button 
            onClick={handleClose} 
            className="action-button secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default JoinGameModal
