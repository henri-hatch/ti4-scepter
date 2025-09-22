import { useCallback, useEffect, useMemo, useState } from 'react'
import '../../styles/PlayerView.css'
import '../../styles/CardInventory.css'
import { useSocket } from '../../contexts/useSocket'
import PlayerActionMenu from './PlayerActionMenu'
import CardDrawModal from './CardDrawModal'
import AddActionCardModal from './AddActionCardModal'
import AddExplorationCardModal from './AddExplorationCardModal'
import ActionCard from '../cards/ActionCard'
import ExplorationCard from '../cards/ExplorationCard'
import type { PlayerActionCard, ActionCardDefinition } from '../../types/actions'
import type { ExplorationCardDefinition, PlayerExplorationCard } from '../../types/exploration'
import { resolveAssetPath } from '../../utils/assets'

function sortByName<T extends { name: string }>(items: T[]): T[] {
  const copy = [...items]
  copy.sort((a, b) => a.name.localeCompare(b.name))
  return copy
}

function CardInventory() {
  const { playerInfo } = useSocket()
  const gameName = playerInfo.gameName ?? ''
  const playerId = playerInfo.playerId ?? ''

  const [actions, setActions] = useState<PlayerActionCard[]>([])
  const [exploration, setExploration] = useState<PlayerExplorationCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [actionDefinitions, setActionDefinitions] = useState<ActionCardDefinition[]>([])
  const [explorationDefinitions, setExplorationDefinitions] = useState<ExplorationCardDefinition[]>([])
  const [definitionsLoaded, setDefinitionsLoaded] = useState({ actions: false, exploration: false })
  const [definitionsLoading, setDefinitionsLoading] = useState({ actions: false, exploration: false })

  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null)
  const [explorationBusyKey, setExplorationBusyKey] = useState<string | null>(null)

  const [pendingActionDelete, setPendingActionDelete] = useState<PlayerActionCard | null>(null)
  const [pendingExplorationDelete, setPendingExplorationDelete] = useState<PlayerExplorationCard | null>(null)

  const [drawModalOpen, setDrawModalOpen] = useState(false)
  const [addActionModalOpen, setAddActionModalOpen] = useState(false)
  const [addExplorationModalOpen, setAddExplorationModalOpen] = useState(false)

  const explorationActions = useMemo(
    () => exploration.filter((card) => card.subtype === 'action'),
    [exploration]
  )

  const relicFragments = useMemo(
    () => exploration.filter((card) => card.subtype === 'relic_fragment'),
    [exploration]
  )

  const fetchActionCards = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions`)
    if (!response.ok) {
      throw new Error('Failed to load action cards')
    }
    const payload = await response.json()
    const rows: PlayerActionCard[] = (payload.actions ?? []).map((card: PlayerActionCard) => ({
      ...card,
      isExhausted: Boolean(card.isExhausted)
    }))
    setActions(sortByName(rows))
  }, [gameName, playerId])

  const fetchExplorationCards = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration`)
    if (!response.ok) {
      throw new Error('Failed to load exploration cards')
    }
    const payload = await response.json()
    const rows: PlayerExplorationCard[] = (payload.exploration ?? []).map((card: PlayerExplorationCard) => ({
      ...card,
      isExhausted: Boolean(card.isExhausted)
    }))
    setExploration(sortByName(rows))
  }, [gameName, playerId])

  const fetchInventory = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    setLoading(true)
    setError(null)
    try {
      await Promise.all([fetchActionCards(), fetchExplorationCards()])
    } catch (err) {
      console.error(err)
      setError('Unable to load card inventory. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [fetchActionCards, fetchExplorationCards, gameName, playerId])

  useEffect(() => {
    setActions([])
    setExploration([])
    setError(null)
    setDefinitionsLoaded({ actions: false, exploration: false })
    setDefinitionsLoading({ actions: false, exploration: false })
    if (gameName && playerId) {
      fetchInventory()
    }
  }, [gameName, playerId, fetchInventory])

  const loadActionDefinitions = useCallback(async () => {
    if (!gameName || !playerId || definitionsLoading.actions) {
      return
    }
    setDefinitionsLoading((prev) => ({ ...prev, actions: true }))
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions/definitions`)
      if (!response.ok) {
        throw new Error('Failed to load action definitions')
      }
      const payload = await response.json()
      const defs: ActionCardDefinition[] = payload.actions ?? []
      setActionDefinitions(sortByName(defs))
      setDefinitionsLoaded((prev) => ({ ...prev, actions: true }))
    } catch (err) {
      console.error(err)
      setError('Unable to load action card options.')
    } finally {
      setDefinitionsLoading((prev) => ({ ...prev, actions: false }))
    }
  }, [gameName, playerId, definitionsLoading.actions])

  const loadExplorationDefinitions = useCallback(async () => {
    if (!gameName || !playerId || definitionsLoading.exploration) {
      return
    }
    setDefinitionsLoading((prev) => ({ ...prev, exploration: true }))
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration/definitions?subtypes=action,relic_fragment`
      )
      if (!response.ok) {
        throw new Error('Failed to load exploration definitions')
      }
      const payload = await response.json()
      const defs: ExplorationCardDefinition[] = payload.exploration ?? []
      setExplorationDefinitions(defs)
      setDefinitionsLoaded((prev) => ({ ...prev, exploration: true }))
    } catch (err) {
      console.error(err)
      setError('Unable to load exploration card options.')
    } finally {
      setDefinitionsLoading((prev) => ({ ...prev, exploration: false }))
    }
  }, [gameName, playerId, definitionsLoading.exploration])

  const handleToggleAction = async (card: PlayerActionCard) => {
    if (!gameName || !playerId) {
      return
    }
    setActionBusyKey(card.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions/${encodeURIComponent(card.key)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isExhausted: !card.isExhausted })
        }
      )
      if (!response.ok) {
        throw new Error('Failed to update action card')
      }
      setActions((previous) => previous.map((item) => (
        item.key === card.key ? { ...item, isExhausted: !item.isExhausted } : item
      )))
    } catch (err) {
      console.error(err)
      setError('Unable to update action card. Please try again.')
    } finally {
      setActionBusyKey(null)
    }
  }

  const removeActionDefinition = (definition: ActionCardDefinition) => {
    setActionDefinitions((previous) => sortByName(previous.filter((item) => item.key !== definition.key)))
  }

  const addActionDefinitionBack = (definition: ActionCardDefinition) => {
    setActionDefinitions((previous) => {
      const exists = previous.some((item) => item.key === definition.key)
      if (exists) {
        return previous
      }
      return sortByName([...previous, definition])
    })
  }

  const handleAddAction = useCallback(async (definition: ActionCardDefinition) => {
    if (!gameName || !playerId) {
      return
    }
    setActionBusyKey(definition.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionKey: definition.key })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to add action card')
      }
    const payload = await response.json()
    const saved: PlayerActionCard = {
      ...definition,
      ...(payload.action ?? {}),
      isExhausted: Boolean(payload.action?.isExhausted)
    }
    setActions((previous) => sortByName([...previous.filter((item) => item.key !== saved.key), saved]))
    removeActionDefinition(definition)
    } catch (err) {
      console.error(err)
      const failure = err instanceof Error ? err : new Error('Unable to add action card.')
      setError(failure.message)
      throw failure
    } finally {
      setActionBusyKey(null)
    }
  }, [gameName, playerId])

  const handleDeleteAction = async () => {
    if (!pendingActionDelete || !gameName || !playerId) {
      return
    }
    setActionBusyKey(pendingActionDelete.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions/${encodeURIComponent(pendingActionDelete.key)}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        throw new Error('Failed to delete action card')
      }
      setActions((previous) => previous.filter((item) => item.key !== pendingActionDelete.key))
      addActionDefinitionBack(pendingActionDelete)
      setPendingActionDelete(null)
    } catch (err) {
      console.error(err)
      setError('Unable to delete action card. Please try again.')
    } finally {
      setActionBusyKey(null)
    }
  }

  const handleToggleExploration = async (card: PlayerExplorationCard) => {
    if (!gameName || !playerId) {
      return
    }
    if (card.subtype !== 'action') {
      return
    }
    setExplorationBusyKey(card.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration/${encodeURIComponent(card.key)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isExhausted: !card.isExhausted })
        }
      )
      if (!response.ok) {
        throw new Error('Failed to update exploration card')
      }
      setExploration((previous) => previous.map((item) => (
        item.key === card.key ? { ...item, isExhausted: !item.isExhausted } : item
      )))
    } catch (err) {
      console.error(err)
      setError('Unable to update exploration card. Please try again.')
    } finally {
      setExplorationBusyKey(null)
    }
  }

  const removeExplorationDefinition = (definition: ExplorationCardDefinition) => {
    setExplorationDefinitions((previous) => previous.filter((item) => item.key !== definition.key))
  }

  const addExplorationDefinitionBack = (definition: ExplorationCardDefinition) => {
    setExplorationDefinitions((previous) => {
      const exists = previous.some((item) => item.key === definition.key)
      if (exists) {
        return previous
      }
      return sortByName([...previous, definition])
    })
  }

  const handleAddExploration = useCallback(async (definition: ExplorationCardDefinition) => {
    if (!gameName || !playerId) {
      return
    }
    setExplorationBusyKey(definition.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explorationKey: definition.key })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to add exploration card')
      }
      const payload = await response.json()
      const saved: PlayerExplorationCard = {
        ...definition,
        ...(payload.exploration ?? {}),
        isExhausted: Boolean(payload.exploration?.isExhausted)
      }
      setExploration((previous) => sortByName([...previous.filter((item) => item.key !== saved.key), saved]))
      removeExplorationDefinition(definition)
    } catch (err) {
      console.error(err)
      const failure = err instanceof Error ? err : new Error('Unable to add exploration card.')
      setError(failure.message)
      throw failure
    } finally {
      setExplorationBusyKey(null)
    }
  }, [gameName, playerId])

  const handleDeleteExploration = async () => {
    if (!pendingExplorationDelete || !gameName || !playerId) {
      return
    }
    setExplorationBusyKey(pendingExplorationDelete.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration/${encodeURIComponent(pendingExplorationDelete.key)}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        throw new Error('Failed to delete exploration card')
      }
      setExploration((previous) => previous.filter((item) => item.key !== pendingExplorationDelete.key))
      addExplorationDefinitionBack(pendingExplorationDelete)
      setPendingExplorationDelete(null)
    } catch (err) {
      console.error(err)
      setError('Unable to delete exploration card. Please try again.')
    } finally {
      setExplorationBusyKey(null)
    }
  }

  const drawActionCard = useCallback(async (): Promise<ActionCardDefinition> => {
    if (!gameName || !playerId) {
      throw new Error('Game not ready')
    }
    const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions/draw`, {
      method: 'POST'
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Unable to draw action card')
    }
    const payload = await response.json()
    return payload.action as ActionCardDefinition
  }, [gameName, playerId])

  const confirmDrawnAction = useCallback(async (card: ActionCardDefinition) => {
    await handleAddAction(card)
  }, [handleAddAction])

  const actionMenuOptions = useMemo(() => (
    [
      {
        label: 'Draw Action Card',
        onSelect: () => setDrawModalOpen(true),
        disabled: !gameName || !playerId
      },
      {
        label: definitionsLoading.actions ? 'Loading…' : 'Add Action Card',
        onSelect: async () => {
          if (!definitionsLoaded.actions) {
            await loadActionDefinitions()
          }
          setAddActionModalOpen(true)
        },
        disabled: !gameName || !playerId || definitionsLoading.actions
      },
      {
        label: definitionsLoading.exploration ? 'Loading…' : 'Add Exploration Card',
        onSelect: async () => {
          if (!definitionsLoaded.exploration) {
            await loadExplorationDefinitions()
          }
          setAddExplorationModalOpen(true)
        },
        disabled: !gameName || !playerId || definitionsLoading.exploration
      }
    ]
  ), [definitionsLoaded.actions, definitionsLoaded.exploration, definitionsLoading.actions, definitionsLoading.exploration, gameName, loadActionDefinitions, loadExplorationDefinitions, playerId])

  return (
    <div className="player-page card-inventory-page">
      <h1>Card Inventory</h1>
      <p className="card-inventory-description">
        Manage miscellaneous cards collected during play. Flip action cards to mark them exhausted and remove cards you no longer hold.
      </p>

      {error ? <div className="card-inventory-error">{error}</div> : null}
      {loading ? <div className="card-inventory-status">Loading cards...</div> : null}

      <section className="card-inventory-section">
        <div className="card-inventory-section-header">
          <h2>Actions</h2>
          <span className="card-inventory-counter">{actions.length}</span>
        </div>
        <hr className="card-inventory-divider" />
        {actions.length > 0 ? (
          <div className="card-inventory-grid">
            {actions.map((card) => (
              <ActionCard
                key={card.key}
                card={card}
                onToggle={handleToggleAction}
                onRemove={(item) => setPendingActionDelete(item)}
                disabled={actionBusyKey === card.key}
              />
            ))}
          </div>
        ) : (
          <div className="card-inventory-empty">You have not drawn any action cards yet.</div>
        )}
      </section>

      <section className="card-inventory-section">
        <div className="card-inventory-section-header">
          <h2>Exploration Actions</h2>
          <span className="card-inventory-counter">{explorationActions.length}</span>
        </div>
        <hr className="card-inventory-divider" />
        {explorationActions.length > 0 ? (
          <div className="card-inventory-grid">
            {explorationActions.map((card) => (
              <ExplorationCard
                key={card.key}
                card={card}
                onToggle={handleToggleExploration}
                onRemove={(item) => setPendingExplorationDelete(item)}
                disabled={explorationBusyKey === card.key}
              />
            ))}
          </div>
        ) : (
          <div className="card-inventory-empty">No exploration action cards in your inventory.</div>
        )}
      </section>

      <section className="card-inventory-section">
        <div className="card-inventory-section-header">
          <h2>Relic Fragments</h2>
          <span className="card-inventory-counter">{relicFragments.length}</span>
        </div>
        <hr className="card-inventory-divider" />
        {relicFragments.length > 0 ? (
          <div className="card-inventory-grid">
            {relicFragments.map((card) => (
              <ExplorationCard
                key={card.key}
                card={card}
                onRemove={(item) => setPendingExplorationDelete(item)}
                disabled={explorationBusyKey === card.key}
              />
            ))}
          </div>
        ) : (
          <div className="card-inventory-empty">No relic fragments discovered yet.</div>
        )}
      </section>

      <section className="card-inventory-section">
        <div className="card-inventory-section-header">
          <h2>Strategems</h2>
        </div>
        <hr className="card-inventory-divider" />
        <div className="card-inventory-subtle">Strategem tracking will arrive in a future update.</div>
      </section>

      <section className="card-inventory-section">
        <div className="card-inventory-section-header">
          <h2>Relics</h2>
        </div>
        <hr className="card-inventory-divider" />
        <div className="card-inventory-subtle">Relics are not yet implemented in this view.</div>
      </section>

      <PlayerActionMenu options={actionMenuOptions} ariaLabel="Card inventory actions" />

      <CardDrawModal
        isOpen={drawModalOpen}
        title="Draw Action Card"
        drawCard={drawActionCard}
        onConfirm={confirmDrawnAction}
        onDismiss={() => setDrawModalOpen(false)}
        renderCard={(card) => (
          <img src={resolveAssetPath(card.asset)} alt={`${card.name} preview`} />
        )}
      />

      <AddActionCardModal
        isOpen={addActionModalOpen}
        onClose={() => setAddActionModalOpen(false)}
        actions={actionDefinitions}
        onAdd={async (card) => {
          try {
            await handleAddAction(card)
            setAddActionModalOpen(false)
          } catch (err) {
            console.debug('Add action card aborted', err)
          }
        }}
        disabled={Boolean(actionBusyKey)}
      />

      <AddExplorationCardModal
        isOpen={addExplorationModalOpen}
        onClose={() => setAddExplorationModalOpen(false)}
        cards={explorationDefinitions}
        onAdd={async (card) => {
          try {
            await handleAddExploration(card)
            setAddExplorationModalOpen(false)
          } catch (err) {
            console.debug('Add exploration card aborted', err)
          }
        }}
        disabled={Boolean(explorationBusyKey)}
      />

      {pendingActionDelete ? (
        <div className="planet-action-dialog" role="dialog" aria-modal="true">
          <div className="planet-action-content">
            <h3>Remove Action Card</h3>
            <p>Remove {pendingActionDelete.name} from your inventory?</p>
            <div className="planet-action-buttons">
              <button
                type="button"
                className="danger"
                onClick={handleDeleteAction}
                disabled={actionBusyKey === pendingActionDelete.key}
              >
                Delete
              </button>
              <button type="button" className="secondary" onClick={() => setPendingActionDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingExplorationDelete ? (
        <div className="planet-action-dialog" role="dialog" aria-modal="true">
          <div className="planet-action-content">
            <h3>Remove Exploration Card</h3>
            <p>Remove {pendingExplorationDelete.name} from your inventory?</p>
            <div className="planet-action-buttons">
              <button
                type="button"
                className="danger"
                onClick={handleDeleteExploration}
                disabled={explorationBusyKey === pendingExplorationDelete.key}
              >
                Delete
              </button>
              <button type="button" className="secondary" onClick={() => setPendingExplorationDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default CardInventory
