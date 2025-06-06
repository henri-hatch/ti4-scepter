import { useNavigate } from 'react-router-dom'
import '../styles/HomePage.css'

function HomePage() {
  const navigate = useNavigate()

  const handleHostGame = () => {
    navigate('/host')
  }

  const handleJoinGame = () => {
    navigate('/player')
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
    </div>
  )
}

export default HomePage
