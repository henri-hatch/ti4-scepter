import { Routes, Route } from 'react-router-dom'
import HomePage from './components/HomePage.tsx'
import HostView from './components/HostView.tsx'
import PlayerView from './components/PlayerView.tsx'
import Overview from './components/player/Overview.tsx'
import Planets from './components/player/Planets.tsx'
import Technology from './components/player/Technology.tsx'
import CardInventory from './components/player/CardInventory.tsx'
import Objectives from './components/player/Objectives.tsx'
import './styles/App.css'

function App() {  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/host" element={<HostView />} />
      <Route path="/player/*" element={<PlayerView />}>
        <Route index element={<Overview />} />
        <Route path="overview" element={<Overview />} />
        <Route path="planets" element={<Planets />} />
        <Route path="technology" element={<Technology />} />
        <Route path="cards" element={<CardInventory />} />
        <Route path="objectives" element={<Objectives />} />
      </Route>
      <Route path="/settings" element={
        <div className="placeholder-page">
          <h1>Settings</h1>
          <p>Coming Soon</p>
        </div>
      } />
    </Routes>
  )
}

export default App
