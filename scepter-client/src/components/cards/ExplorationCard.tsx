import Card from './Card'
import { resolveAssetPath } from '../../utils/assets'
import type { PlayerExplorationCard } from '../../types/exploration'
import '../../styles/ExplorationCard.css'

type ExplorationCardProps = {
  card: PlayerExplorationCard
  onToggle?: (card: PlayerExplorationCard) => void
  onRemove: (card: PlayerExplorationCard) => void
  disabled?: boolean
}

function ExplorationCard({ card, onToggle, onRemove, disabled = false }: ExplorationCardProps) {
  const front = resolveAssetPath(card.asset)
  const canToggle = card.subtype === 'action' && Boolean(onToggle)

  const handlePrimary = () => {
    if (!canToggle || disabled) {
      return
    }
    onToggle?.(card)
  }

  const handleSecondary = () => {
    if (disabled) {
      return
    }
    onRemove(card)
  }

  return (
    <div className={`exploration-card-wrapper ${disabled ? 'is-disabled' : ''}`}>
      <Card
        frontImage={front}
        backImage={front}
        alt={`${card.name} exploration card`}
        isFlipped={canToggle ? card.isExhausted : false}
        onPrimaryAction={canToggle ? handlePrimary : undefined}
        onSecondaryAction={handleSecondary}
        className={`exploration-card exploration-card--${card.subtype}`}
      />
      <div className="exploration-card-meta">
        <div className="exploration-card-name">{card.name}</div>
        <div className="exploration-card-tags">
          <span className="exploration-card-tag">{card.type}</span>
          <span className={`exploration-card-tag exploration-card-tag--${card.subtype}`}>
            {card.subtype.replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  )
}

export default ExplorationCard
