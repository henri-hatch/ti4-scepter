import Card from './Card'
import { resolveAssetPath } from '../../utils/assets'
import type { PlayerActionCard } from '../../types/actions'
import '../../styles/ActionCard.css'

type ActionCardProps = {
  card: PlayerActionCard
  onToggle: (card: PlayerActionCard) => void
  onRemove: (card: PlayerActionCard) => void
  disabled?: boolean
}

function ActionCard({ card, onToggle, onRemove, disabled = false }: ActionCardProps) {
  const front = resolveAssetPath(card.asset)
  const back = card.backAsset ? resolveAssetPath(card.backAsset) : front
  const isLegendary = card.type === 'legendary'

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
    <div className={`action-card-wrapper ${disabled ? 'is-disabled' : ''} ${isLegendary ? 'is-legendary' : ''}`}>
      <Card
        frontImage={front}
        backImage={back}
        alt={`${card.name} action card`}
        isFlipped={card.isExhausted}
        onPrimaryAction={handlePrimary}
        onSecondaryAction={handleSecondary}
        className="action-card"
      />
      <div className="action-card-meta">
        <div className="action-card-name">{card.name}</div>
        {isLegendary ? <div className="action-card-tag">Legendary</div> : null}
      </div>
    </div>
  )
}

export default ActionCard
