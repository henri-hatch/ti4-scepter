import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import '../styles/PlayerView.css'

function PlayerView() {
  const [open, setOpen] = useState(false)

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
      </nav>
      <div className="page-content">
        <Outlet />
      </div>
    </div>
  )
}

export default PlayerView
