import { useCallback, useEffect, useMemo, useState } from 'react'
import '../../styles/PlayerView.css'
import '../../styles/CardInventory.css'
import '../../styles/ObjectivesPage.css'
import PlayerActionMenu from './PlayerActionMenu'
import ObjectiveCard from '../cards/ObjectiveCard'
import ManageObjectivesModal from './ManageObjectivesModal'
import { useSocket } from '../../contexts/useSocket'
import type { ObjectiveDefinition, ObjectiveType, PlayerObjective } from '../../types/objectives'

const CATEGORY_ORDER: ObjectiveType[] = ['public_tier1', 'public_tier2', 'secret']
const CATEGORY_LABELS: Record<ObjectiveType, string> = {
  public_tier1: 'Public Objectives – Tier 1',
  public_tier2: 'Public Objectives – Tier 2',
  secret: 'Secret Objectives'
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name))
}

function Objectives() {
  const { playerInfo } = useSocket()
  const gameName = playerInfo.gameName ?? ''
  const playerId = playerInfo.playerId ?? ''

  const [objectives, setObjectives] = useState<PlayerObjective[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const [definitions, setDefinitions] = useState<ObjectiveDefinition[]>([])
  const [definitionsLoaded, setDefinitionsLoaded] = useState(false)
  const [definitionsLoading, setDefinitionsLoading] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PlayerObjective | null>(null)

  const [victoryPoints, setVictoryPoints] = useState(0)
  const [victoryLoading, setVictoryLoading] = useState(false)

  const resetState = useCallback(() => {
    setObjectives([])
    setDefinitions([])
    setDefinitionsLoaded(false)
    setManageOpen(false)
    setPendingDelete(null)
    setBusyKey(null)
    setVictoryPoints(0)
  }, [])

  useEffect(() => {
    if (!gameName || !playerId) {
      resetState()
    }
  }, [gameName, playerId, resetState])

  const fetchVictoryPoints = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    setVictoryLoading(true)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}`)
      if (!response.ok) {
        return
      }
      const payload = await response.json()
      const nextPoints = Number(payload.player?.victoryPoints ?? 0)
      if (!Number.isNaN(nextPoints)) {
        setVictoryPoints(nextPoints)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setVictoryLoading(false)
    }
  }, [gameName, playerId])

  const fetchObjectives = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/objectives`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load objectives')
      }
      const rows: PlayerObjective[] = Array.isArray(payload.objectives)
        ? payload.objectives.map((card: PlayerObjective) => ({
            ...card,
            isCompleted: Boolean(card.isCompleted)
          }))
        : []
      setObjectives(() => sortByName(rows))
    } catch (err) {
      console.error(err)
      setError('Unable to load objectives. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [gameName, playerId])

  useEffect(() => {
    void fetchObjectives()
    void fetchVictoryPoints()
  }, [fetchObjectives, fetchVictoryPoints])

  const loadObjectiveDefinitions = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    setDefinitionsLoading(true)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/objectives/definitions`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load objective definitions')
      }
      const defs: ObjectiveDefinition[] = Array.isArray(payload.objectives)
        ? payload.objectives.map((definition: ObjectiveDefinition) => ({
            ...definition,
            victoryPoints: Number(definition.victoryPoints ?? 0)
          }))
        : []
      setDefinitions(sortByName(defs))
      setDefinitionsLoaded(true)
    } catch (err) {
      console.error(err)
      setError('Unable to load objective options. Please try again.')
    } finally {
      setDefinitionsLoading(false)
    }
  }, [gameName, playerId])

  const objectivesByType = useMemo(() => {
    const groups: Record<ObjectiveType, PlayerObjective[]> = {
      public_tier1: [],
      public_tier2: [],
      secret: []
    }

    objectives.forEach((card) => {
      groups[card.type as ObjectiveType]?.push(card)
    })

    CATEGORY_ORDER.forEach((type) => {
      groups[type] = sortByName(groups[type])
    })

    return groups
  }, [objectives])

  const handleToggleObjective = useCallback(async (card: PlayerObjective) => {
    if (!gameName || !playerId || busyKey === card.key) {
      return
    }
    setBusyKey(card.key)
    setError(null)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/objectives/${encodeURIComponent(card.key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !card.isCompleted })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update objective')
      }

      const updated = (payload.objective ?? {}) as Partial<PlayerObjective>
      const nextPoints = Number(payload.victoryPoints ?? victoryPoints)

      setObjectives((previous) => sortByName(previous.map((item) => {
        if (item.key !== card.key) {
          return item
        }
        return {
          ...item,
          ...updated,
          isCompleted: Boolean(updated.isCompleted ?? !card.isCompleted)
        }
      })))

      if (!Number.isNaN(nextPoints)) {
        setVictoryPoints(nextPoints)
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to update objective. Please try again.')
    } finally {
      setBusyKey(null)
    }
  }, [busyKey, gameName, playerId, victoryPoints])

  const handleAddObjective = useCallback(async (definition: ObjectiveDefinition) => {
    if (!gameName || !playerId || busyKey === definition.key) {
      return
    }
    setBusyKey(definition.key)
    setError(null)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/objectives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectiveKey: definition.key })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to add objective')
      }

      const saved = (payload.objective ?? {}) as Partial<PlayerObjective>
      const normalised: PlayerObjective = {
        ...definition,
        ...saved,
        isCompleted: Boolean(saved.isCompleted)
      }

      setObjectives((previous) => sortByName([...previous, normalised]))
      setDefinitions((previous) => previous.filter((item) => item.key !== definition.key))
      setStatusMessage(`${definition.name} added to your objectives.`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to add objective. Please try again.')
    } finally {
      setBusyKey(null)
    }
  }, [busyKey, gameName, playerId])

  const performRemoveObjective = useCallback(async (card: PlayerObjective) => {
    if (!gameName || !playerId) {
      return
    }
    setBusyKey(card.key)
    setError(null)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/objectives/${encodeURIComponent(card.key)}`, {
        method: 'DELETE'
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to remove objective')
      }

      const nextPoints = Number(payload.victoryPoints ?? victoryPoints)
      setObjectives((previous) => previous.filter((item) => item.key !== card.key))
      if (!Number.isNaN(nextPoints)) {
        setVictoryPoints(nextPoints)
      }
      setDefinitions((previous) => {
        const reinstate: ObjectiveDefinition = {
          key: card.key,
          name: card.name,
          type: card.type,
          victoryPoints: card.victoryPoints,
          asset: card.asset
        }
        const filtered = previous.filter((item) => item.key !== reinstate.key)
        return sortByName([...filtered, reinstate])
      })
      setStatusMessage(`${card.name} removed.`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to remove objective. Please try again.')
    } finally {
      setBusyKey(null)
    }
  }, [gameName, playerId, victoryPoints])

  const handleDeleteObjective = useCallback(async () => {
    if (!pendingDelete) {
      return
    }
    await performRemoveObjective(pendingDelete)
    setPendingDelete(null)
  }, [pendingDelete, performRemoveObjective])

  const handleOpenManage = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    setError(null)
    if (!definitionsLoaded && !definitionsLoading) {
      await loadObjectiveDefinitions()
    } else if (definitionsLoaded && !definitionsLoading && definitions.length === 0) {
      await loadObjectiveDefinitions()
    }
    setManageOpen(true)
  }, [definitions.length, definitionsLoaded, definitionsLoading, gameName, playerId, loadObjectiveDefinitions])

  const actionOptions = useMemo(() => (
    [
      {
        label: definitionsLoading ? 'Loading…' : 'Manage Objectives',
        onSelect: () => {
          void handleOpenManage()
        },
        disabled: !gameName || !playerId || definitionsLoading
      }
    ]
  ), [definitionsLoading, gameName, handleOpenManage, playerId])

  const renderSectionContent = (type: ObjectiveType) => {
    if (loading) {
      return <div className="card-inventory-empty">Loading objectives…</div>
    }

    const cards = objectivesByType[type] ?? []

    if (cards.length === 0) {
      return <div className="card-inventory-empty">No objectives assigned yet.</div>
    }

    return (
      <div className="card-inventory-grid">
        {cards.map((card) => (
          <ObjectiveCard
            key={card.key}
            card={card}
            onToggle={handleToggleObjective}
            onRemove={(item) => setPendingDelete(item)}
            disabled={busyKey === card.key}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="player-page objectives-page">
      <h1>Objectives</h1>
      <p className="card-inventory-description">
        Track scored and unscored objectives here. Tap an objective to mark it complete when you score it; hold or right-click to remove it from your board.
      </p>

      <div className="objectives-toolbar">
        <div className="objectives-summary" aria-live="polite">
          <span className="objectives-summary-label">Victory Points</span>
          <span className="objectives-summary-value">{victoryPoints}</span>
          {victoryLoading ? <span className="objectives-summary-loading">Updating…</span> : null}
        </div>
        <PlayerActionMenu options={actionOptions} ariaLabel="Objective actions" />
      </div>

      {statusMessage ? <div className="card-inventory-status">{statusMessage}</div> : null}
      {error ? <div className="card-inventory-error">{error}</div> : null}

      <div className="card-inventory-page">
        {CATEGORY_ORDER.map((type) => (
          <section key={type} className="card-inventory-section">
            <div className="card-inventory-section-header">
              <h2>{CATEGORY_LABELS[type]}</h2>
              <span className="card-inventory-counter">{objectivesByType[type]?.length ?? 0}</span>
            </div>
            {renderSectionContent(type)}
          </section>
        ))}
      </div>

      <ManageObjectivesModal
        isOpen={manageOpen}
        onClose={() => setManageOpen(false)}
        owned={objectives}
        available={definitions}
        onAdd={(card) => {
          void handleAddObjective(card)
        }}
        onRemove={(card) => {
          void performRemoveObjective(card)
        }}
        busyKey={busyKey}
      />

      {pendingDelete ? (
        <div className="planet-action-dialog" role="dialog" aria-modal="true">
          <div className="planet-action-content">
            <h3>Remove Objective</h3>
            <p>Remove {pendingDelete.name} from your objectives?</p>
            <div className="planet-action-buttons">
              <button
                type="button"
                className="danger"
                onClick={handleDeleteObjective}
                disabled={busyKey === pendingDelete.key}
              >
                Delete
              </button>
              <button type="button" className="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Objectives
