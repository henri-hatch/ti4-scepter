import { useMemo } from 'react'
import { resolveAssetPath } from '../utils/assets'

type VictoryLimit = 10 | 14

type VictoryTrackPlayer = {
  playerId: string
  name: string
  faction: string
  victoryPoints: number
}

type HostVictoryTrackProps = {
  players: VictoryTrackPlayer[]
  victoryLimit: VictoryLimit
  onLimitChange: (limit: VictoryLimit) => void
  resolveTokenAsset: (faction: string | null | undefined) => string | null
  isUpdating?: boolean
  isLoading?: boolean
  errorMessage?: string | null
}

const VICTORY_LIMIT_OPTIONS: VictoryLimit[] = [10, 14]

function HostVictoryTrack({
  players,
  victoryLimit,
  onLimitChange,
  resolveTokenAsset,
  isUpdating = false,
  isLoading = false,
  errorMessage = null
}: HostVictoryTrackProps) {
  const scoreboardAsset = useMemo(
    () => resolveAssetPath(victoryLimit === 14 ? 'ti4_scoreboard_14.png' : 'ti4_scoreboard_10.png'),
    [victoryLimit]
  )

  const tokensBySlot = useMemo(() => {
    const ordered = [...players].sort((a, b) => a.name.localeCompare(b.name))
    const buckets = new Map<number, VictoryTrackPlayer[]>()

    ordered.forEach((player) => {
      const rawPoints = Number.isFinite(player.victoryPoints) ? player.victoryPoints : 0
      const cellValue = Math.max(0, Math.min(rawPoints, victoryLimit))
      const existing = buckets.get(cellValue) ?? []
      existing.push(player)
      buckets.set(cellValue, existing)
    })

    return buckets
  }, [players, victoryLimit])

  const handleLimitClick = (limit: VictoryLimit) => {
    if (limit === victoryLimit || isUpdating || isLoading) {
      return
    }
    onLimitChange(limit)
  }

  const renderToken = (player: VictoryTrackPlayer) => {
    const tokenAsset = resolveTokenAsset(player.faction)
    const key = `${player.playerId}-${player.victoryPoints}`
    const title = `${player.name} – ${player.victoryPoints} VP`
    if (!tokenAsset) {
      return (
        <div key={key} className="victory-track-token victory-track-token--placeholder" title={title}>
          {player.name.slice(0, 2).toUpperCase()}
        </div>
      )
    }

    return (
      <img
        key={key}
        className="victory-track-token"
        src={tokenAsset}
        alt={`${player.name} faction token`}
        title={title}
        draggable={false}
      />
    )
  }

  return (
    <div className="victory-track-panel">
      <div className="victory-track-header">
        <h3>Victory Point Track</h3>
        <div className="victory-track-controls" role="group" aria-label="Victory point limit">
          <span className="victory-track-controls-label">Victory Limit</span>
          {VICTORY_LIMIT_OPTIONS.map((limit) => {
            const active = limit === victoryLimit
            return (
              <button
                key={`victory-limit-${limit}`}
                type="button"
                className={`victory-track-control${active ? ' is-active' : ''}`}
                onClick={() => handleLimitClick(limit)}
                disabled={isUpdating || isLoading}
                aria-pressed={active}
              >
                {limit}
              </button>
            )
          })}
        </div>
      </div>

      <div className={`victory-track-board${isLoading ? ' is-loading' : ''}`} style={{ backgroundImage: `url(${scoreboardAsset})` }}>
        <div className="victory-track-grid" style={{ gridTemplateColumns: `repeat(${victoryLimit + 1}, 1fr)` }}>
          {Array.from({ length: victoryLimit + 1 }, (_, index) => {
            const slotValue = index
            const slotTokens = tokensBySlot.get(slotValue) ?? []
            return (
              <div key={`victory-slot-${slotValue}`} className="victory-track-cell">
                {slotTokens.map(renderToken)}
              </div>
            )
          })}
        </div>
        {isLoading ? <div className="victory-track-overlay">Loading victory track…</div> : null}
      </div>

      {errorMessage ? <div className="victory-track-error">{errorMessage}</div> : null}
    </div>
  )
}

export type { VictoryLimit, VictoryTrackPlayer }
export default HostVictoryTrack
