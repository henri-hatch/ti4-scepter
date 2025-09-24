import { useCallback, useEffect, useMemo, useState } from 'react'
import '../../styles/PlayerView.css'
import '../../styles/Technology.css'
import '../../styles/Planets.css'
import { useSocket } from '../../contexts/useSocket'
import PlayerActionMenu from './PlayerActionMenu'
import TechnologyCard from '../cards/TechnologyCard'
import AddTechnologyModal from './AddTechnologyModal'
import type { PlayerTechnology, TechnologyDefinition, TechnologyType } from '../../types/technology'
import { formatFactionLabel } from '../../utils/technology'

const TYPE_ORDER: TechnologyType[] = ['Biotic', 'Propulsion', 'Cybernetic', 'Warfare', 'Unit']

type TechnologyMap = Record<TechnologyType, PlayerTechnology[]>

type SortableTechnology = {
  type: TechnologyType
  tier: number
  name: string
}

function sortTechnology<T extends SortableTechnology>(items: T[]): void {
  items.sort((a, b) => {
    if (a.type !== b.type) {
      return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
    }
    if (a.tier !== b.tier) {
      return a.tier - b.tier
    }
    return a.name.localeCompare(b.name)
  })
}

function Technology() {
  const { playerInfo } = useSocket()
  const gameName = playerInfo.gameName ?? ''
  const playerId = playerInfo.playerId ?? ''

  const [technology, setTechnology] = useState<PlayerTechnology[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<TechnologyDefinition[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [mutatingTechnologyKey, setMutatingTechnologyKey] = useState<string | null>(null)
  const [pendingDeletion, setPendingDeletion] = useState<PlayerTechnology | null>(null)
  const [playerFaction, setPlayerFaction] = useState('none')
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    setCatalog([])
    setCatalogLoaded(false)
    setCatalogLoading(false)
    setProfileLoaded(false)
  }, [gameName, playerId])

  const fetchPlayerTechnology = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/technology`)
      if (!response.ok) {
        throw new Error('Failed to fetch technology')
      }

      const payload = await response.json()
      const rows: PlayerTechnology[] = (payload.technology ?? []).map((item: PlayerTechnology) => ({
        ...item,
        faction: (item.faction ?? 'none').toLowerCase(),
        tier: Number(item.tier ?? 0),
        isExhausted: Boolean(item.isExhausted)
      }))
      sortTechnology(rows)
      setTechnology(rows)
    } catch (err) {
      console.error(err)
      setError('Unable to load technology. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [gameName, playerId])

  useEffect(() => {
    fetchPlayerTechnology()
  }, [fetchPlayerTechnology])

  const fetchPlayerProfile = useCallback(async () => {
    if (!gameName || !playerId || profileLoaded) {
      return
    }

    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}`)
      if (!response.ok) {
        throw new Error('Failed to fetch player profile')
      }

      const payload = await response.json()
      if (payload.player) {
        setPlayerFaction((payload.player.faction ?? 'none').toLowerCase())
      }
      setProfileLoaded(true)
    } catch (err) {
      console.warn('Unable to fetch player profile', err)
    }
  }, [gameName, playerId, profileLoaded])

  useEffect(() => {
    fetchPlayerProfile()
  }, [fetchPlayerProfile])

  const refetchCatalog = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }

    setCatalogLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/technology/definitions`)
      if (!response.ok) {
        throw new Error('Failed to load technology catalog')
      }

      const payload = await response.json()
      const definitions: TechnologyDefinition[] = (payload.technology ?? []).map((item: TechnologyDefinition) => ({
        ...item,
        faction: (item.faction ?? 'none').toLowerCase(),
        tier: Number(item.tier ?? 0)
      }))
      sortTechnology(definitions)
      setCatalog(definitions)
      setCatalogLoaded(true)
    } catch (err) {
      console.error(err)
      setError('Unable to load technology catalog. Please try again.')
    } finally {
      setCatalogLoading(false)
    }
  }, [gameName, playerId])

  const handleOpenAddModal = async () => {
    if (!catalogLoaded && !catalogLoading) {
      await refetchCatalog()
    }
    setShowAddModal(true)
  }

  const availableTechnology = useMemo(() => {
    const ownedKeys = new Set(technology.map((item) => item.key))
    return catalog.filter((item) => !ownedKeys.has(item.key))
  }, [catalog, technology])

  const handleAddTechnology = async (tech: TechnologyDefinition) => {
    if (!gameName || !playerId || mutatingTechnologyKey) {
      return
    }

    setMutatingTechnologyKey(tech.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/technology`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technologyKey: tech.key })
      })

      if (!response.ok) {
        throw new Error('Failed to add technology')
      }

      const payload = await response.json()
      const saved = payload.technology as PlayerTechnology
      const merged: PlayerTechnology = {
        ...tech,
        ...saved,
        faction: (saved?.faction ?? tech.faction ?? 'none').toLowerCase(),
        tier: Number(saved?.tier ?? tech.tier ?? 0),
        isExhausted: Boolean(saved?.isExhausted)
      }

      setTechnology((previous) => {
        const updated = [...previous, merged]
        sortTechnology(updated)
        return updated
      })

      if (catalogLoaded) {
        setCatalog((previous) => previous.filter((item) => item.key !== tech.key))
      }
    } catch (err) {
      console.error(err)
      setError('Unable to add technology. Please try again.')
    } finally {
      setMutatingTechnologyKey(null)
    }
  }

  const handleToggleExhausted = async (tech: PlayerTechnology) => {
    if (!gameName || !playerId || mutatingTechnologyKey) {
      return
    }

    setMutatingTechnologyKey(tech.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/technology/${encodeURIComponent(tech.key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExhausted: !tech.isExhausted })
      })

      if (!response.ok) {
        throw new Error('Failed to update technology')
      }

      setTechnology((previous) => previous.map((item) => (
        item.key === tech.key ? { ...item, isExhausted: !tech.isExhausted } : item
      )))
    } catch (err) {
      console.error(err)
      setError('Unable to update technology. Please try again.')
    } finally {
      setMutatingTechnologyKey(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!pendingDeletion || !gameName || !playerId || mutatingTechnologyKey) {
      return
    }

    setMutatingTechnologyKey(pendingDeletion.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/technology/${encodeURIComponent(pendingDeletion.key)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete technology')
      }

      setTechnology((previous) => previous.filter((item) => item.key !== pendingDeletion.key))
      if (catalogLoaded) {
        setCatalog((previous) => {
          const exists = previous.some((item) => item.key === pendingDeletion.key)
          if (!exists) {
            const definition: TechnologyDefinition = {
              key: pendingDeletion.key,
              name: pendingDeletion.name,
              type: pendingDeletion.type,
              faction: pendingDeletion.faction,
              tier: pendingDeletion.tier,
              asset: pendingDeletion.asset
            }
            const updated = [...previous, definition]
            sortTechnology(updated)
            return updated
          }
          return previous
        })
      }
      setPendingDeletion(null)
    } catch (err) {
      console.error(err)
      setError('Unable to delete technology. Please try again.')
    } finally {
      setMutatingTechnologyKey(null)
    }
  }

  const handleSecondaryAction = (tech: PlayerTechnology) => {
    setPendingDeletion(tech)
  }

  useEffect(() => {
    if (!pendingDeletion) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPendingDeletion(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pendingDeletion])

  const groupedTechnology = useMemo(() => {
    const groups: TechnologyMap = {
      Biotic: [],
      Propulsion: [],
      Cybernetic: [],
      Warfare: [],
      Unit: []
    }

    technology.forEach((tech) => {
      groups[tech.type].push(tech)
    })

    TYPE_ORDER.forEach((type) => {
      sortTechnology(groups[type])
    })

    return groups
  }, [technology])

  const formattedFaction = formatFactionLabel(playerFaction)
  const factionNote = formattedFaction
    ? `Faction technology available: ${formattedFaction}`
    : null

  return (
    <div className="player-page technology-page">
      <h1>Technology</h1>
      <p className="technology-description">
        Track your researched technology. Tap to exhaust a card when it is used and press-and-hold or right-click to remove it from your sheet.
        {factionNote ? ` ${factionNote}.` : ''}
      </p>

      {error ? <div className="technology-error">{error}</div> : null}
      {loading ? <div className="technology-status">Loading technology...</div> : null}

      {technology.length === 0 && !loading ? (
        <div className="technology-empty">
          You have not added any technology yet. Use the action menu to add cards from the catalog.
        </div>
      ) : null}

      {technology.length > 0 ? (
        <div className="technology-board">
          {TYPE_ORDER.map((type) => (
            <section key={type} className="technology-section">
              <div className="technology-section-header">
                <h2>{type}</h2>
                <span className="technology-section-divider" />
              </div>
              {groupedTechnology[type].length > 0 ? (
                <div className="technology-cards-row">
                  {groupedTechnology[type].map((tech) => (
                    <TechnologyCard
                      key={tech.key}
                      technology={tech}
                      onPrimaryAction={() => handleToggleExhausted(tech)}
                      onSecondaryAction={() => handleSecondaryAction(tech)}
                    />
                  ))}
                </div>
              ) : (
                <div className="technology-status">No {type.toLowerCase()} technology learned yet.</div>
              )}
            </section>
          ))}
        </div>
      ) : null}

      <PlayerActionMenu
        options={[
          {
            label: catalogLoading ? 'Loading…' : 'Add Technology',
            onSelect: handleOpenAddModal,
            disabled: catalogLoading || !gameName || !playerId
          }
        ]}
        ariaLabel="Technology actions"
      />

      <AddTechnologyModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        technology={availableTechnology}
        onAddTechnology={handleAddTechnology}
        disabled={mutatingTechnologyKey !== null}
      />

      {pendingDeletion ? (
        <div className="technology-action-dialog" role="dialog" aria-modal="true">
          <div className="technology-action-content">
            <h3>Remove Technology</h3>
            <p>Are you sure you want to remove {pendingDeletion.name}?</p>
            <div className="technology-action-buttons">
              <button
                type="button"
                className="danger"
                onClick={handleConfirmDelete}
                disabled={mutatingTechnologyKey !== null}
              >
                Delete
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setPendingDeletion(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Technology
