import { useCallback, useEffect, useMemo, useState } from 'react'
import '../../styles/PlayerView.css'
import '../../styles/Planets.css'
import { useSocket } from '../../contexts/useSocket'
import PlayerActionMenu from './PlayerActionMenu'
import PlanetCard from '../cards/PlanetCard'
import AddPlanetModal from './AddPlanetModal'
import type { PlanetDefinition, PlayerPlanet } from '../../types/planets'

function Planets() {
  const { playerInfo } = useSocket()
  const gameName = playerInfo.gameName ?? ''
  const playerId = playerInfo.playerId ?? ''

  const [planets, setPlanets] = useState<PlayerPlanet[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<PlanetDefinition[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [mutatingPlanetKey, setMutatingPlanetKey] = useState<string | null>(null)
  const [planetPendingDeletion, setPlanetPendingDeletion] = useState<PlayerPlanet | null>(null)

  const fetchPlayerPlanets = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/planets`)
      if (!response.ok) {
        throw new Error('Failed to fetch planets')
      }

      const payload = await response.json()
      const rows: PlayerPlanet[] = (payload.planets ?? []).map((planet: PlayerPlanet) => ({
        ...planet,
        techSpecialty: planet.techSpecialty ?? null,
        isExhausted: Boolean(planet.isExhausted)
      }))
      setPlanets(rows)
    } catch (err) {
      console.error(err)
      setError('Unable to load planets. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [gameName, playerId])

  useEffect(() => {
    fetchPlayerPlanets()
  }, [fetchPlayerPlanets])

  const refetchCatalog = useCallback(async () => {
    if (!gameName) {
      return
    }

    setCatalogLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/planets/definitions`)
      if (!response.ok) {
        throw new Error('Failed to load planet catalog')
      }

      const payload = await response.json()
      const definitions: PlanetDefinition[] = (payload.planets ?? []).map((planet: PlanetDefinition) => ({
        ...planet,
        techSpecialty: planet.techSpecialty ?? null
      }))
      definitions.sort((a, b) => a.name.localeCompare(b.name))
      setCatalog(definitions)
      setCatalogLoaded(true)
    } catch (err) {
      console.error(err)
      setError('Unable to load planet catalog. Please try again.')
    } finally {
      setCatalogLoading(false)
    }
  }, [gameName])

  const handleOpenAddModal = async () => {
    if (!catalogLoaded && !catalogLoading) {
      await refetchCatalog()
    }
    setShowAddModal(true)
  }

  const availablePlanets = useMemo(() => {
    const ownedKeys = new Set(planets.map((planet) => planet.key))
    return catalog.filter((planet) => !ownedKeys.has(planet.key))
  }, [catalog, planets])

  const handleAddPlanet = async (planet: PlanetDefinition) => {
    if (!gameName || !playerId || mutatingPlanetKey) {
      return
    }

    setMutatingPlanetKey(planet.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/planets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planetKey: planet.key })
      })

      if (!response.ok) {
        throw new Error('Failed to add planet')
      }

      const payload = await response.json()
      const saved = payload.planet as PlayerPlanet
      const merged: PlayerPlanet = {
        ...planet,
        ...saved,
        techSpecialty: saved.techSpecialty ?? planet.techSpecialty ?? null,
        isExhausted: Boolean(saved.isExhausted)
      }

      setPlanets((previous) => {
        const updated = [...previous, merged]
        updated.sort((a, b) => a.name.localeCompare(b.name))
        return updated
      })
      if (catalogLoaded) {
        setCatalog((previous) => previous.filter((item) => item.key !== planet.key))
      }
    } catch (err) {
      console.error(err)
      setError('Unable to add planet. Please try again.')
    } finally {
      setMutatingPlanetKey(null)
    }
  }

  const handleToggleExhausted = async (planet: PlayerPlanet) => {
    if (!gameName || !playerId || mutatingPlanetKey) {
      return
    }

    setMutatingPlanetKey(planet.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/planets/${encodeURIComponent(planet.key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExhausted: !planet.isExhausted })
      })

      if (!response.ok) {
        throw new Error('Failed to update planet')
      }

      setPlanets((previous) => previous.map((item) => (
        item.key === planet.key ? { ...item, isExhausted: !planet.isExhausted } : item
      )))
    } catch (err) {
      console.error(err)
      setError('Unable to update planet. Please try again.')
    } finally {
      setMutatingPlanetKey(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!planetPendingDeletion || !gameName || !playerId || mutatingPlanetKey) {
      return
    }

    setMutatingPlanetKey(planetPendingDeletion.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/planets/${encodeURIComponent(planetPendingDeletion.key)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete planet')
      }

      setPlanets((previous) => previous.filter((item) => item.key !== planetPendingDeletion.key))
      if (catalogLoaded) {
        setCatalog((previous) => {
          const updated = previous.slice()
          const exists = updated.some((item) => item.key === planetPendingDeletion.key)
          if (!exists) {
            const definition: PlanetDefinition = {
              key: planetPendingDeletion.key,
              name: planetPendingDeletion.name,
              type: planetPendingDeletion.type,
              techSpecialty: planetPendingDeletion.techSpecialty,
              resources: planetPendingDeletion.resources,
              influence: planetPendingDeletion.influence,
              legendary: planetPendingDeletion.legendary,
              assetFront: planetPendingDeletion.assetFront,
              assetBack: planetPendingDeletion.assetBack
            }
            updated.push(definition)
            updated.sort((a, b) => a.name.localeCompare(b.name))
          }
          return updated
        })
      }
      setPlanetPendingDeletion(null)
    } catch (err) {
      console.error(err)
      setError('Unable to delete planet. Please try again.')
    } finally {
      setMutatingPlanetKey(null)
    }
  }

  const handleSecondaryAction = (planet: PlayerPlanet) => {
    setPlanetPendingDeletion(planet)
  }

  useEffect(() => {
    if (!planetPendingDeletion) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPlanetPendingDeletion(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [planetPendingDeletion])

  return (
    <div className="player-page player-planets-page">
      <h1>Planets</h1>
      <p className="player-planets-description">
        Manage the planets under your control. Tap to exhaust a planet when it is used and press-and-hold or right-click to remove it from your inventory.
      </p>

      {error ? <div className="player-planets-error">{error}</div> : null}
      {loading ? <div className="player-planets-status">Loading planets...</div> : null}

      {planets.length === 0 && !loading ? (
        <div className="player-planets-empty">
          You have not added any planets yet. Use the action menu to add one from the catalog.
        </div>
      ) : null}

      {planets.length > 0 ? (
        <div className="player-planets-grid">
          {planets.map((planet) => (
            <PlanetCard
              key={planet.key}
              planet={planet}
              onPrimaryAction={() => handleToggleExhausted(planet)}
              onSecondaryAction={() => handleSecondaryAction(planet)}
            />
          ))}
        </div>
      ) : null}

      <PlayerActionMenu
        options={[
          {
            label: catalogLoading ? 'Loading…' : 'Add Planet',
            onSelect: handleOpenAddModal,
            disabled: catalogLoading || !gameName || !playerId
          }
        ]}
        ariaLabel="Planet actions"
      />

      <AddPlanetModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        planets={availablePlanets}
        onAddPlanet={handleAddPlanet}
        disabled={mutatingPlanetKey !== null}
      />

      {planetPendingDeletion ? (
        <div className="planet-action-dialog" role="dialog" aria-modal="true">
          <div className="planet-action-content">
            <h3>Remove Planet</h3>
            <p>Are you sure you want to remove {planetPendingDeletion.name}?</p>
            <div className="planet-action-buttons">
              <button
                type="button"
                className="danger"
                onClick={handleConfirmDelete}
                disabled={mutatingPlanetKey !== null}
              >
                Delete
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setPlanetPendingDeletion(null)}
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

export default Planets
