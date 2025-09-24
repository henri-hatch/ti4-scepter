import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/HostGameModal.css'
import FactionSelectorModal from './FactionSelectorModal'
import type { FactionDefinition } from '../types/faction'

interface Player {
  name: string
  id: string
  factionKey: string | null
  factionName: string | null
}

interface Game {
  name: string
  created: string
  lastUpdated: string
}

interface HostGameModalProps {
  isOpen: boolean
  onClose: () => void
}

function HostGameModal({ isOpen, onClose }: HostGameModalProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'create' | 'resume'>('create')
  const [gameName, setGameName] = useState('')
  const [players, setPlayers] = useState<Player[]>([
    { name: '', id: '1', factionKey: null, factionName: null },
    { name: '', id: '2', factionKey: null, factionName: null }
  ])
  const [existingGames, setExistingGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [factionModalPlayerId, setFactionModalPlayerId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && activeTab === 'resume') {
      fetchExistingGames()
    }
  }, [isOpen, activeTab])

  const fetchExistingGames = async () => {
    try {
      const response = await fetch('/api/list-games')
      if (response.ok) {
        const data = await response.json()
        setExistingGames(data.games)
      }
    } catch (error) {
      console.error('Failed to fetch existing games:', error)
    }
  }

  const addPlayer = () => {
    const newId = (players.length + 1).toString()
    setPlayers([...players, { name: '', id: newId, factionKey: null, factionName: null }])
  }

  const removePlayer = (id: string) => {
    if (players.length > 2) {
      if (factionModalPlayerId === id) {
        setFactionModalPlayerId(null)
      }
      setPlayers(players.filter(player => player.id !== id))
    }
  }

  const updatePlayerName = (id: string, name: string) => {
    setPlayers(players.map(player => 
      player.id === id ? { ...player, name } : player
    ))
  }

  const handleOpenFactionModal = (id: string) => {
    setFactionModalPlayerId(id)
  }

  const handleConfirmFaction = async (selection: FactionDefinition | null) => {
    if (!factionModalPlayerId) {
      return
    }

    setPlayers((current) => current.map((player) => {
      if (player.id !== factionModalPlayerId) {
        return player
      }
      return {
        ...player,
        factionKey: selection ? selection.key : null,
        factionName: selection ? selection.name : null
      }
    }))

    setFactionModalPlayerId(null)
  }

  const handleCloseFactionModal = () => {
    setFactionModalPlayerId(null)
  }

  const activeFactionPlayer = useMemo(() => {
    if (!factionModalPlayerId) {
      return null
    }
    return players.find((player) => player.id === factionModalPlayerId) ?? null
  }, [players, factionModalPlayerId])

  const handleCreateGame = async () => {
    if (!gameName.trim()) {
      alert('Please enter a game name')
      return
    }

    const validPlayers = players.filter(player => player.name.trim())
    if (validPlayers.length < 2) {
      alert('Please enter at least 2 player names')
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch('/api/create-game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameName: gameName.trim(),
          players: validPlayers.map(player => ({
            name: player.name.trim(),
            factionKey: player.factionKey
          }))
        })      })

      const data = await response.json()

      if (response.ok) {
        onClose()
        navigate('/host', { state: { gameName: gameName.trim() } })
      } else {
        alert(data.error || 'Failed to create game')
      }
    } catch (error) {
      console.error('Failed to create game:', error)
      alert('Failed to create game. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }
  const handleResumeGame = () => {
    if (!selectedGame) {
      alert('Please select a game to resume')
      return
    }
    
    onClose()
    navigate('/host', { state: { gameName: selectedGame } })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Host Game</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="tab-container">
          <button 
            className={`tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create New Game
          </button>
          <button 
            className={`tab ${activeTab === 'resume' ? 'active' : ''}`}
            onClick={() => setActiveTab('resume')}
          >
            Resume Game
          </button>
        </div>

        {activeTab === 'create' && (
          <div className="tab-content">
            <div className="form-group">
              <label htmlFor="gameName">Game Name:</label>
              <input
                id="gameName"
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Enter game name..."
                className="text-input"
              />
            </div>

            <div className="form-group">
              <label>Players:</label>
              <div className="players-container">
                {players.map((player, index) => (
                  <div key={player.id} className="player-input-row">
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => updatePlayerName(player.id, e.target.value)}
                      placeholder={`Player ${index + 1} name...`}
                      className="text-input"
                    />
                    <div className="player-faction-column">
                      <span className={player.factionKey ? 'player-faction-badge selected' : 'player-faction-badge'}>
                        {player.factionName ?? 'No faction selected'}
                      </span>
                      <button
                        type="button"
                        className="select-faction-button"
                        onClick={() => handleOpenFactionModal(player.id)}
                      >
                        {player.factionKey ? 'Change Faction' : 'Select Faction'}
                      </button>
                    </div>
                    {players.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removePlayer(player.id)}
                        className="remove-player-button"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPlayer}
                  className="add-player-button"
                >
                  Add Player
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                onClick={handleCreateGame}
                disabled={isLoading}
                className="action-button primary"
              >
                {isLoading ? 'Creating...' : 'Create Game'}
              </button>
              <button onClick={onClose} className="action-button secondary">
                Cancel
              </button>
            </div>
          </div>
        )}

        {activeTab === 'resume' && (
          <div className="tab-content">
            <div className="form-group">
              <label>Select a game to resume:</label>
              {existingGames.length === 0 ? (
                <p className="no-games">No existing games found.</p>
              ) : (
                <div className="games-list">
                  {existingGames.map((game) => (
                    <div 
                      key={game.name}
                      className={`game-item ${selectedGame === game.name ? 'selected' : ''}`}
                      onClick={() => setSelectedGame(game.name)}
                    >
                      <div className="game-name">{game.name}</div>
                      <div className="game-date">Last updated: {formatDate(game.lastUpdated)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                onClick={handleResumeGame}
                disabled={!selectedGame}
                className="action-button primary"
              >
                Resume Game
              </button>
              <button onClick={onClose} className="action-button secondary">
                Cancel
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
      <FactionSelectorModal
        isOpen={Boolean(factionModalPlayerId)}
        onClose={handleCloseFactionModal}
        onConfirm={handleConfirmFaction}
        selectedKey={activeFactionPlayer?.factionKey}
        title={`Select Faction${activeFactionPlayer?.name ? ` for ${activeFactionPlayer.name}` : ''}`}
        allowUnset
      />
    </>
  )
}

export default HostGameModal
