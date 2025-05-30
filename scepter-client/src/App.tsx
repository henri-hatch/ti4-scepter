import { Routes, Route } from 'react-router-dom'
import HomePage from './components/HomePage.tsx'
import './styles/App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/host" element={
        <div className="placeholder-page">
          <h1>Host Game</h1>
          <p>Coming Soon</p>
        </div>
      } />
      <Route path="/join" element={
        <div className="placeholder-page">
          <h1>Join as Player</h1>
          <p>Coming Soon</p>
        </div>
      } />
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
