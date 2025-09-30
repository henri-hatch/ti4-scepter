import Card from './Card'
import { resolveAssetPath } from '../../utils/assets'
import type { PlayerExplorationCard } from '../../types/exploration'
import '../../styles/ExplorationCard.css'

type ExplorationCardProps = {
  card: PlayerExplorationCard
  onToggle?: (card: PlayerExplorationCard) => void
  onRemove: (card: PlayerExplorationCard) => void
  disabled?: boolean
  onSecondaryAction?: (card: PlayerExplorationCard) => void
  secondaryActionLabel?: string
  showRemoveButton?: boolean
  onPrimaryAction?: (card: PlayerExplorationCard) => void
}

function ExplorationCard({
  card,
  onToggle,
  onRemove,
  disabled = false,
  onSecondaryAction,
  secondaryActionLabel,
  showRemoveButton = false,
  onPrimaryAction
}: ExplorationCardProps) {
  const front = resolveAssetPath(card.asset)
  const canToggle = card.subtype === 'action' && Boolean(onToggle)
  const secondaryHandler = onSecondaryAction ?? onRemove

  const handlePrimary = () => {
    if (disabled) {
      return
    }
    if (canToggle) {
      onToggle?.(card)
      return
    }
    if (onPrimaryAction) {
      onPrimaryAction(card)
    }
  }

  const hasPrimaryAction = canToggle || Boolean(onPrimaryAction)

  const handleSecondary = () => {
    if (disabled || !secondaryHandler) {
      return
    }
    secondaryHandler(card)
  }

  return (
    <div className={`exploration-card-wrapper ${disabled ? 'is-disabled' : ''}`}>
      <Card
        frontImage={front}
        backImage={front}
        alt={`${card.name} exploration card`}
        isFlipped={canToggle ? card.isExhausted : false}
        onPrimaryAction={hasPrimaryAction ? handlePrimary : undefined}
        onSecondaryAction={(onSecondaryAction || showRemoveButton) ? handleSecondary : undefined}
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
        {secondaryActionLabel ? <div className="exploration-card-hint">{secondaryActionLabel}</div> : null}
        {showRemoveButton ? (
          <button
            type="button"
            className="exploration-card-remove"
            onClick={() => onRemove(card)}
            disabled={disabled}
          >
            Remove
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default ExplorationCard
