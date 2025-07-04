import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HostGameModal from './HostGameModal'
import JoinGameModal from './JoinGameModal'
import '../styles/HomePage.css'

function HomePage() {
  const navigate = useNavigate()
  const [isHostModalOpen, setIsHostModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)

  const handleHostGame = () => {
    setIsHostModalOpen(true)
  }

  const handleJoinGame = () => {
    setIsJoinModalOpen(true)
  }

  const handleSettings = () => {
    navigate('/settings')
  }
  return (
    <div className="home-page">
      <div className="backdrop" />
      <div className="content">
        <div className="header">
          <img src="/scepter-icon.png" alt="Scepter Logo" className="logo" />
          <h1 className="title">Scepter</h1>
          <p className="subtitle">for Twilight Imperium 4th Edition</p>
        </div>
        
        <div className="button-container">
          <button className="nav-button" onClick={handleHostGame}>
            Host Game
          </button>
          <button className="nav-button" onClick={handleJoinGame}>
            Join as Player
          </button>
          <button className="nav-button" onClick={handleSettings}>
            Settings
          </button>
        </div>
      </div>      
      <HostGameModal 
        isOpen={isHostModalOpen}
        onClose={() => setIsHostModalOpen(false)}
      />
      
      <JoinGameModal 
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
    </div>
  )
}

export default HomePage
