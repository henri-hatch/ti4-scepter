import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import '../styles/PlayerView.css'

function PlayerView() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [playerInfo, setPlayerInfo] = useState<{
    gameName: string | null
    playerId: string | null
    playerName: string | null
  }>({
    gameName: null,
    playerId: null,
    playerName: null
  })

  // Get player info from location state (passed from JoinGameModal)
  const stateInfo = location.state as {
    gameName?: string
    playerId?: string
    playerName?: string
  } | null

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io()
    setSocket(newSocket)

    newSocket.on('connect', () => {
      setIsConnected(true)
      console.log('Player connected to server')
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
      console.log('Player disconnected from server')
    })

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
      navigate('/')
    })

    newSocket.on('session_ended', (data) => {
      console.log('Game session ended:', data.gameName)
      alert(`Game session "${data.gameName}" has ended. The host has stopped hosting.`)
      navigate('/')
    })

    newSocket.on('error', (data) => {
      console.error('Socket error:', data.message)
      alert(`Error: ${data.message}`)
    })

    // If we have state info, join the game
    if (stateInfo && stateInfo.gameName && stateInfo.playerId && stateInfo.playerName) {
      newSocket.emit('join_game', {
        gameName: stateInfo.gameName,
        playerId: stateInfo.playerId,
        playerName: stateInfo.playerName
      })
    }

    return () => {
      newSocket.close()
    }
  }, [navigate, stateInfo])

  const handleLeaveGame = () => {
    if (socket && playerInfo.gameName) {
      socket.emit('leave_game')
    } else {
      navigate('/')
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
      </button>      <nav className={`side-menu ${open ? 'open' : ''}`}>
        <div className="player-status">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
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
    </div>
  )
}

export default PlayerView
