import '../../styles/ObjectiveDrawModal.css'
import { resolveAssetPath } from '../../utils/assets'
import type { ObjectiveType } from '../../types/objectives'

type ObjectiveDrawModalProps = {
  isOpen: boolean
  busyType: ObjectiveType | null
  error: string | null
  onClose: () => void
  onDraw: (type: ObjectiveType) => void
}

const DRAW_OPTIONS: Array<{ type: ObjectiveType; label: string; asset: string; helper: string }> = [
  {
    type: 'public_tier1',
    label: 'Tier I Public',
    asset: 'objectives/tier1.back.jpg',
    helper: 'Standard objectives worth 1 VP'
  },
  {
    type: 'public_tier2',
    label: 'Tier II Public',
    asset: 'objectives/tier2.back.jpg',
    helper: 'High value objectives worth 2 VP'
  },
  {
    type: 'secret',
    label: 'Secret Objective',
    asset: 'objectives/secret.back.jpg',
    helper: 'Hidden objective worth 1 VP'
  }
]

function ObjectiveDrawModal({ isOpen, busyType, error, onClose, onDraw }: ObjectiveDrawModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="objective-draw-backdrop" role="dialog" aria-modal="true" aria-labelledby="objective-draw-title">
      <div className="objective-draw-modal">
        <div className="objective-draw-header">
          <h2 id="objective-draw-title">Draw Objective</h2>
          <button
            type="button"
            className="objective-draw-close"
            onClick={onClose}
            aria-label="Close draw objective dialog"
            disabled={Boolean(busyType)}
          >
            ×
          </button>
        </div>
        <div className="objective-draw-body">
          <p className="objective-draw-intro">Choose which deck to draw from. Drawn objectives are automatically added to your board.</p>
          {error ? <div className="objective-draw-error" role="alert">{error}</div> : null}
          <div className="objective-draw-grid">
            {DRAW_OPTIONS.map((option) => {
              const image = resolveAssetPath(option.asset)
              const isBusy = busyType === option.type
              const handleClick = () => {
                if (busyType) {
                  return
                }
                onDraw(option.type)
              }

              return (
                <button
                  key={option.type}
                  type="button"
                  className={`objective-draw-option ${isBusy ? 'is-busy' : ''}`}
                  onClick={handleClick}
                  disabled={Boolean(busyType)}
                  aria-busy={isBusy}
                >
                  <span className="objective-draw-card">
                    <img src={image} alt="" aria-hidden="true" draggable={false} />
                    {isBusy ? <span className="objective-draw-spinner" aria-hidden="true" /> : null}
                  </span>
                  <span className="objective-draw-label">{option.label}</span>
                  <span className="objective-draw-helper">{option.helper}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ObjectiveDrawModal
