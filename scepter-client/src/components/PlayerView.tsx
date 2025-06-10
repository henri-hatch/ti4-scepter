import { useState, useEffect, useRef } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSocket } from '../contexts/SocketContext'
import '../styles/PlayerView.css'

function PlayerView() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const hasJoinedGame = useRef(false)
  
  const { 
    socket, 
    isConnected, 
    playerInfo, 
    connectionType,
    initializeSocket, 
    joinGame, 
    leaveGame,
    onLeftGame,
    onSessionEnded
  } = useSocket()

  // Get player info from location state (passed from JoinGameModal)
  const stateInfo = location.state as {
    gameName?: string
    playerId?: string
    playerName?: string
  } | null
  
  useEffect(() => {
    // Only initialize socket connection for player if not already connected as player
    if (connectionType !== 'player') {
      console.log('Initializing player socket connection')
      initializeSocket('player')
    }
  }, [connectionType, initializeSocket])

  useEffect(() => {
    // If we have state info and socket is ready, join the game
    // Only do this once when the component mounts with state info
    if (socket && stateInfo && stateInfo.gameName && stateInfo.playerId && stateInfo.playerName && !playerInfo.gameName && !hasJoinedGame.current) {
      console.log('Joining game with state info:', stateInfo)
      hasJoinedGame.current = true
      joinGame(stateInfo.gameName, stateInfo.playerId, stateInfo.playerName)
    }
  }, [socket, stateInfo, joinGame, playerInfo.gameName])

  useEffect(() => {
    // Handle session ended and left game events
    const handleSessionEnded = (data: any) => {
      console.log('Game session ended:', data.gameName)
      alert(data.message || `Game session "${data.gameName}" has ended. The host has stopped hosting.`)
      hasJoinedGame.current = false
      navigate('/')
    }

    const handleLeftGame = (data: any) => {
      console.log('Left game:', data.gameName)
      hasJoinedGame.current = false
      navigate('/')
    }

    // Set up event listeners
    const cleanupSessionEnded = onSessionEnded?.(handleSessionEnded)
    const cleanupLeftGame = onLeftGame?.(handleLeftGame)

    return () => {
      cleanupSessionEnded?.()
      cleanupLeftGame?.()
    }
  }, [navigate, onSessionEnded, onLeftGame])

  const handleLeaveGame = () => {
    if (playerInfo.gameName) {
      leaveGame()
    }
    hasJoinedGame.current = false
    navigate('/')
    setShowLeaveModal(false)
  }

  const handleConnectionStatusClick = () => {
    if (isConnected && playerInfo.gameName) {
      setShowLeaveModal(true)
    }
  }

  return (
    <div className="player-view">
      <div className="backdrop" />
      <button
        className={`menu-toggle ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        <span />
        <span />
        <span />
      </button>
      
      <nav className={`side-menu ${open ? 'open' : ''}`}>
        <div className="player-status">
          <div 
            className={`connection-status ${isConnected ? 'connected' : 'disconnected'} ${isConnected && playerInfo.gameName ? 'clickable' : ''}`}
            onClick={handleConnectionStatusClick}
            title={isConnected && playerInfo.gameName ? 'Click to leave session' : ''}
          >
            <span className="status-dot"></span>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          {playerInfo.gameName && (
            <div className="game-info">
              <div className="game-name">Game: {playerInfo.gameName}</div>
              <div className="player-name">Player: {playerInfo.playerName}</div>
            </div>
          )}
        </div>
        
        <ul>
          <li>
            <Link className="nav-button" to="/player/overview" replace onClick={() => setOpen(false)}>
              Overview
            </Link>
          </li>
          <li>
            <Link className="nav-button" to="/player/planets" replace onClick={() => setOpen(false)}>
              Planets
            </Link>
          </li>
          <li>
            <Link className="nav-button" to="/player/technology" replace onClick={() => setOpen(false)}>
              Technology
            </Link>
          </li>
          <li>
            <Link className="nav-button" to="/player/cards" replace onClick={() => setOpen(false)}>
              Card Inventory
            </Link>
          </li>
          <li>
            <Link className="nav-button" to="/player/objectives" replace onClick={() => setOpen(false)}>
              Objectives
            </Link>
          </li>
        </ul>
        
        <div className="menu-footer">
          <button className="leave-game-btn" onClick={handleLeaveGame}>
            {playerInfo.gameName ? 'Leave Game' : 'Back to Home'}
          </button>
        </div>
      </nav>
      <div className="page-content">
        <Outlet />
      </div>

      {/* Leave Session Modal */}
      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="leave-modal" onClick={e => e.stopPropagation()}>
            <h3>Leave Game Session</h3>
            <p>Are you sure you want to leave "{playerInfo.gameName}"?</p>
            <p>You'll be disconnected from the current game session.</p>
            <div className="modal-actions">
              <button 
                className="action-button secondary"
                onClick={() => setShowLeaveModal(false)}
              >
                Cancel
              </button>
              <button 
                className="action-button primary"
                onClick={handleLeaveGame}
              >
                Leave Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PlayerView
