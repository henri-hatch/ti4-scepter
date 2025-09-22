import { useCallback, useEffect, useMemo, useState } from 'react'
import '../../styles/PlayerView.css'
import '../../styles/Planets.css'
import { useSocket } from '../../contexts/useSocket'
import PlayerActionMenu from './PlayerActionMenu'
import PlanetCard from '../cards/PlanetCard'
import AddPlanetModal from './AddPlanetModal'
import CardDrawModal from './CardDrawModal'
import ManageAttachmentsModal from './ManageAttachmentsModal'
import AttachmentViewerModal from './AttachmentViewerModal'
import { resolveAssetPath } from '../../utils/assets'
import type { PlanetDefinition, PlayerPlanet } from '../../types/planets'
import type { PlanetAttachment, ExplorationCardDefinition } from '../../types/exploration'

function Planets() {
  const { playerInfo } = useSocket()
  const gameName = playerInfo.gameName ?? ''
  const playerId = playerInfo.playerId ?? ''

  const [planets, setPlanets] = useState<PlayerPlanet[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const [catalog, setCatalog] = useState<PlanetDefinition[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [mutatingPlanetKey, setMutatingPlanetKey] = useState<string | null>(null)

  const [planetActionTarget, setPlanetActionTarget] = useState<PlayerPlanet | null>(null)
  const [planetPendingDeletion, setPlanetPendingDeletion] = useState<PlayerPlanet | null>(null)

  const [attachmentsModalPlanet, setAttachmentsModalPlanet] = useState<PlayerPlanet | null>(null)
  const [availableAttachments, setAvailableAttachments] = useState<ExplorationCardDefinition[]>([])
  const [attachmentsBusyKey, setAttachmentsBusyKey] = useState<string | null>(null)
  const [attachmentViewer, setAttachmentViewer] = useState<PlanetAttachment | null>(null)

  const [explorationDrawCard, setExplorationDrawCard] = useState<ExplorationCardDefinition | null>(null)
  const [explorationDrawOpen, setExplorationDrawOpen] = useState(false)

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
        isExhausted: Boolean(planet.isExhausted),
        attachments: Array.isArray(planet.attachments)
          ? planet.attachments.map((attachment: PlanetAttachment) => ({ ...attachment }))
          : []
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
    setStatusMessage(null)
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
        isExhausted: Boolean(saved.isExhausted),
        attachments: []
      }
      setPlanets((previous) => {
        const updated = [...previous, merged]
        updated.sort((a, b) => a.name.localeCompare(b.name))
        return updated
      })
      setStatusMessage(`${planet.name} added to your roster.`)
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
    setStatusMessage(null)
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

  const handleConfirmDelete = useCallback(async () => {
    if (!planetPendingDeletion || !gameName || !playerId || mutatingPlanetKey) {
      return
    }

    setMutatingPlanetKey(planetPendingDeletion.key)
    setError(null)
    setStatusMessage(null)
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
      setStatusMessage(`${planetPendingDeletion.name} removed from your roster.`)
      setPlanetPendingDeletion(null)
    } catch (err) {
      console.error(err)
      setError('Unable to delete planet. Please try again.')
    } finally {
      setMutatingPlanetKey(null)
    }
  }, [planetPendingDeletion, gameName, playerId, catalogLoaded, mutatingPlanetKey])

  const handlePlanetAction = (planet: PlayerPlanet) => {
    setPlanetActionTarget(planet)
  }

  const updatePlanetAttachments = useCallback((planetKey: string, updater: (attachments: PlanetAttachment[]) => PlanetAttachment[]) => {
    setPlanets((previous) => previous.map((planet) => (
      planet.key === planetKey ? { ...planet, attachments: updater(planet.attachments) } : planet
    )))
  }, [])

  const handleExplorePlanet = useCallback(async (planet: PlayerPlanet) => {
    if (!gameName || !playerId) {
      return
    }
    setPlanetActionTarget(null)
    setError(null)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/planets/${encodeURIComponent(planet.key)}/explore`, {
        method: 'POST'
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to explore planet')
      }

      if (payload.result === 'attachment' && payload.attachment) {
        const attachment = payload.attachment as PlanetAttachment
        updatePlanetAttachments(planet.key, (current) => [...current, attachment])
        setStatusMessage(`${attachment.name} attached to ${planet.name}.`)
        return
      }

      if (payload.result === 'relic_fragment' && payload.exploration) {
        const fragment = payload.exploration as ExplorationCardDefinition
        setStatusMessage(`${fragment.name} added to your relic fragments.`)
        return
      }

      if (payload.result === 'action' && payload.exploration) {
        const actionCard = payload.exploration as ExplorationCardDefinition
        setExplorationDrawCard(actionCard)
        setExplorationDrawOpen(true)
        return
      }

      setStatusMessage('Exploration complete.')
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to explore planet. Please try again.')
    }
  }, [gameName, playerId, updatePlanetAttachments])

  const confirmExplorationAction = useCallback(async (card: ExplorationCardDefinition) => {
    if (!gameName || !playerId) {
      throw new Error('Game not ready')
    }
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explorationKey: card.key })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to add exploration card')
      }
      setStatusMessage(`${card.name} added to your exploration actions.`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to add exploration card.')
      throw err
    }
  }, [gameName, playerId])

  const loadAvailableAttachments = useCallback(async (planet: PlayerPlanet) => {
    if (!gameName || !playerId) {
      return
    }
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration/definitions?subtypes=attach&planetKey=${encodeURIComponent(planet.key)}`
      )
      if (!response.ok) {
        throw new Error('Failed to load attachments')
      }
      const payload = await response.json()
      const definitions: ExplorationCardDefinition[] = payload.exploration ?? []
      setAvailableAttachments(definitions)
    } catch (err) {
      console.error(err)
      setError('Unable to load attachments for this planet.')
      setAvailableAttachments([])
    }
  }, [gameName, playerId])

  const handleOpenAttachments = async (planet: PlayerPlanet) => {
    await loadAvailableAttachments(planet)
    setAttachmentsModalPlanet(planet)
  }

  const handleAddAttachment = async (card: ExplorationCardDefinition) => {
    if (!attachmentsModalPlanet || !gameName || !playerId) {
      return
    }
    setAttachmentsBusyKey(card.key)
    setError(null)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/planets/${encodeURIComponent(attachmentsModalPlanet.key)}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explorationKey: card.key })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to add attachment')
      }
      const payload = await response.json()
      const attachment = payload.attachment as PlanetAttachment
      updatePlanetAttachments(attachmentsModalPlanet.key, (current) => [...current, attachment])
      setAttachmentsModalPlanet((previous) => (
        previous && previous.key === attachmentsModalPlanet.key
          ? { ...previous, attachments: [...previous.attachments, attachment] }
          : previous
      ))
      setAvailableAttachments((previous) => previous.filter((item) => item.key !== card.key))
      setStatusMessage(`${card.name} attached to ${attachmentsModalPlanet.name}.`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to add attachment.')
    } finally {
      setAttachmentsBusyKey(null)
    }
  }

  const handleRemoveAttachment = async (attachment: PlanetAttachment) => {
    if (!attachmentsModalPlanet || !gameName || !playerId) {
      return
    }
    setAttachmentsBusyKey(attachment.key)
    setError(null)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/planets/${encodeURIComponent(attachmentsModalPlanet.key)}/attachments/${encodeURIComponent(attachment.key)}`,
        {
          method: 'DELETE'
        })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to remove attachment')
      }
      updatePlanetAttachments(attachmentsModalPlanet.key, (current) => current.filter((item) => item.key !== attachment.key))
      setAttachmentsModalPlanet((previous) => (
        previous && previous.key === attachmentsModalPlanet.key
          ? { ...previous, attachments: previous.attachments.filter((item) => item.key !== attachment.key) }
          : previous
      ))
      setAvailableAttachments((previous) => {
        const exists = previous.some((item) => item.key === attachment.key)
        if (exists) {
          return previous
        }
        return [...previous, attachment]
      })
      setStatusMessage(`${attachment.name} removed from ${attachmentsModalPlanet.name}.`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to remove attachment.')
    } finally {
      setAttachmentsBusyKey(null)
    }
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

  useEffect(() => {
    if (!planetActionTarget) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPlanetActionTarget(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [planetActionTarget])

  return (
    <div className="player-page player-planets-page">
      <h1>Planets</h1>
      <p className="player-planets-description">
        Manage the planets under your control. Tap to exhaust a planet. Press-and-hold or right-click to explore, manage attachments, or remove it from your inventory.
      </p>

      {statusMessage ? <div className="player-planets-status">{statusMessage}</div> : null}
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
            <div key={planet.key} className="planet-card-stack">
              <PlanetCard
                planet={planet}
                onPrimaryAction={() => handleToggleExhausted(planet)}
                onSecondaryAction={() => handlePlanetAction(planet)}
              />
              {planet.attachments.length > 0 ? (
                <div className="planet-card-attachments">
                  {planet.attachments.map((attachment) => (
                    <button
                      key={`${attachment.key}-${attachment.id}`}
                      type="button"
                      className="planet-card-attachment"
                      onClick={() => setAttachmentViewer(attachment)}
                    >
                      <img src={resolveAssetPath(attachment.asset)} alt={`${attachment.name} attachment`} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
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

      <CardDrawModal
        isOpen={explorationDrawOpen}
        title="Exploration Action"
        initialCard={explorationDrawCard}
        onConfirm={async (card) => {
          await confirmExplorationAction(card)
          setExplorationDrawOpen(false)
        }}
        onDismiss={() => {
          setExplorationDrawOpen(false)
          setExplorationDrawCard(null)
        }}
        renderCard={(card) => (
          <img src={resolveAssetPath(card.asset)} alt={`${card.name} preview`} />
        )}
        confirmLabel="Add to Inventory"
      />

      <ManageAttachmentsModal
        isOpen={Boolean(attachmentsModalPlanet)}
        onClose={() => {
          setAttachmentsModalPlanet(null)
          setAvailableAttachments([])
        }}
        planetName={attachmentsModalPlanet?.name ?? ''}
        attachments={attachmentsModalPlanet?.attachments ?? []}
        available={availableAttachments}
        onAdd={handleAddAttachment}
        onRemove={handleRemoveAttachment}
        busyKey={attachmentsBusyKey}
      />

      <AttachmentViewerModal attachment={attachmentViewer} onClose={() => setAttachmentViewer(null)} />

      {planetActionTarget ? (
        <div className="planet-action-dialog" role="dialog" aria-modal="true">
          <div className="planet-action-content planet-action-content--menu">
            <h3>{planetActionTarget.name}</h3>
            <div className="planet-action-buttons planet-action-buttons--stacked">
              <button
                type="button"
                onClick={() => handleExplorePlanet(planetActionTarget)}
                disabled={mutatingPlanetKey !== null}
              >
                Explore Planet
              </button>
              <button
                type="button"
                onClick={() => {
                  handleOpenAttachments(planetActionTarget)
                  setPlanetActionTarget(null)
                }}
              >
                Manage Attachments
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setPlanetPendingDeletion(planetActionTarget)
                  setPlanetActionTarget(null)
                }}
              >
                Delete Planet
              </button>
              <button type="button" className="secondary" onClick={() => setPlanetActionTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              <button type="button" className="secondary" onClick={() => setPlanetPendingDeletion(null)}>
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
