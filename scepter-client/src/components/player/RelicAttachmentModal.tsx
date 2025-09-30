import { resolveAssetPath } from '../../utils/assets'
import type { PlayerExplorationCard } from '../../types/exploration'
import type { PlayerPlanet } from '../../types/planets'
import '../../styles/RelicAttachmentModal.css'

interface RelicAttachmentModalProps {
  relic: PlayerExplorationCard | null
  planets: PlayerPlanet[]
  isOpen: boolean
  loading?: boolean
  busy?: boolean
  error?: string | null
  onClose: () => void
  onAttach: (planet: PlayerPlanet) => void
}

function RelicAttachmentModal({
  relic,
  planets,
  isOpen,
  loading = false,
  busy = false,
  error = null,
  onClose,
  onAttach
}: RelicAttachmentModalProps) {
  if (!isOpen || !relic) {
    return null
  }

  const relicImage = resolveAssetPath(relic.asset)
  const hasPlanets = planets.length > 0

  return (
    <div className="relic-attach-backdrop" role="dialog" aria-modal="true">
      <div className="relic-attach-modal">
        <div className="relic-attach-header">
          <h2>Attach Relic</h2>
          <button type="button" className="relic-attach-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="relic-attach-relic">
          <img src={relicImage} alt={`${relic.name} relic card`} />
          <div className="relic-attach-relic-meta">
            <div className="relic-attach-relic-name">{relic.name}</div>
            <div className="relic-attach-relic-type">{relic.type}</div>
          </div>
        </div>

        <div className="relic-attach-body">
          {loading ? (
            <div className="relic-attach-loading">Loading available planets…</div>
          ) : hasPlanets ? (
            <>
              <p className="relic-attach-instructions">Select a planet to attach this relic.</p>
              <div className="relic-attach-grid">
                {planets.map((planet) => {
                  const planetImage = resolveAssetPath(planet.assetFront)
                  return (
                    <button
                      key={planet.key}
                      type="button"
                      className="relic-attach-planet"
                      onClick={() => onAttach(planet)}
                      disabled={busy}
                    >
                      <img src={planetImage} alt={`${planet.name} planet`} />
                      <div className="relic-attach-planet-meta">
                        <div className="relic-attach-planet-name">{planet.name}</div>
                        <div className="relic-attach-planet-type">{planet.type}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="relic-attach-empty">
              No planets available. Add planets to your roster before attaching this relic.
            </div>
          )}
        </div>

        {error ? <div className="relic-attach-error">{error}</div> : null}
      </div>
    </div>
  )
}

export default RelicAttachmentModal
