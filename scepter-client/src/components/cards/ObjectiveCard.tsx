import Card from './Card'
import { resolveAssetPath } from '../../utils/assets'
import type { PlayerObjective } from '../../types/objectives'
import '../../styles/ObjectiveCard.css'

type ObjectiveCardProps = {
  card: PlayerObjective
  onToggle: (card: PlayerObjective) => void
  onRemove: (card: PlayerObjective) => void
  disabled?: boolean
}

function ObjectiveCard({ card, onToggle, onRemove, disabled = false }: ObjectiveCardProps) {
  const asset = resolveAssetPath(card.asset)

  const handlePrimary = () => {
    if (disabled) {
      return
    }
    onToggle(card)
  }

  const handleSecondary = () => {
    if (disabled) {
      return
    }
    onRemove(card)
  }

  return (
    <div className={`objective-card-wrapper ${disabled ? 'is-disabled' : ''} ${card.isCompleted ? 'is-completed' : ''}`}>
      <div className="objective-card-glow" aria-hidden="true" />
      <Card
        frontImage={asset}
        backImage={asset}
        alt={`${card.name} objective`}
        isFlipped={card.isCompleted}
        onPrimaryAction={handlePrimary}
        onSecondaryAction={handleSecondary}
        className="objective-card"
      />
      <div className="objective-card-check" aria-hidden="true">
        <span className="objective-card-check-icon">✓</span>
      </div>
      <div className="objective-card-meta">
        <div className="objective-card-name">{card.name}</div>
        <div className="objective-card-points">{card.victoryPoints} VP</div>
      </div>
    </div>
  )
}

export default ObjectiveCard
