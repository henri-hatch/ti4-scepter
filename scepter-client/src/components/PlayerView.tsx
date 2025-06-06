import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import '../styles/PlayerView.css'

function PlayerView() {
  const [open, setOpen] = useState(false)

  return (
    <div className="player-view">
      <div className="backdrop" />
      <button className="menu-toggle" onClick={() => setOpen(!open)}>
        &#9776;
      </button>
      <nav className={`side-menu ${open ? 'open' : ''}`}>
        <ul>
          <li>
            <Link className="nav-button" to="overview" onClick={() => setOpen(false)}>
              Overview
            </Link>
          </li>
          <li>
            <Link className="nav-button" to="planets" onClick={() => setOpen(false)}>
              Planets
            </Link>
          </li>
          <li>
            <Link className="nav-button" to="technology" onClick={() => setOpen(false)}>
              Technology
            </Link>
          </li>
          <li>
            <Link className="nav-button" to="cards" onClick={() => setOpen(false)}>
              Card Inventory
            </Link>
          </li>
          <li>
            <Link className="nav-button" to="objectives" onClick={() => setOpen(false)}>
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
