import { useCallback, useMemo, useState } from 'react'
import '../../styles/PlayerView.css'
import '../../styles/CardInventory.css'
import PlayerActionMenu from './PlayerActionMenu'
import CardDrawModal from './CardDrawModal'
import { useSocket } from '../../contexts/useSocket'
import type { ActionCardDefinition } from '../../types/actions'
import { resolveAssetPath } from '../../utils/assets'

function Overview() {
  const { playerInfo } = useSocket()
  const gameName = playerInfo.gameName ?? ''
  const playerId = playerInfo.playerId ?? ''

  const [drawModalOpen, setDrawModalOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
    if (!gameName || !playerId) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionKey: card.key })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to add action card')
      }
      setStatusMessage(`${card.name} added to your inventory.`)
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Unable to add action card.')
      throw err
    } finally {
      setBusy(false)
    }
  }, [gameName, playerId])

  const actionOptions = useMemo(() => (
    [
      {
        label: 'Draw Action Card',
        onSelect: () => {
          setStatusMessage(null)
          setError(null)
          setDrawModalOpen(true)
        },
        disabled: !gameName || !playerId || busy
      }
    ]
  ), [busy, gameName, playerId])

  return (
    <div className="player-page">
      <h1>Overview</h1>
      <p>
        Quick access to frequently used player actions. Draw an action card directly from here or open other sections for detailed management.
      </p>

      {statusMessage ? <div className="card-inventory-status">{statusMessage}</div> : null}
      {error ? <div className="card-inventory-error">{error}</div> : null}

      <PlayerActionMenu options={actionOptions} ariaLabel="Overview actions" />

      <CardDrawModal
        isOpen={drawModalOpen}
        title="Draw Action Card"
        drawCard={drawActionCard}
        onConfirm={async (card) => {
          await confirmDrawnAction(card)
          setDrawModalOpen(false)
        }}
        onDismiss={() => setDrawModalOpen(false)}
        renderCard={(card) => (
          <img src={resolveAssetPath(card.asset)} alt={`${card.name} preview`} />
        )}
        confirmLabel={busy ? 'Saving…' : 'Add to Inventory'}
      />
    </div>
  )
}

export default Overview
