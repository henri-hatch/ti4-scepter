import Card from './Card'
import { resolveAssetPath } from '../../utils/assets'
import type { PlayerStrategem } from '../../types/strategems'
import '../../styles/StrategemCard.css'

type StrategemCardProps = {
  card: PlayerStrategem
  onToggle: (card: PlayerStrategem) => void
  onRemove: (card: PlayerStrategem) => void
  onTradeGoodsChange: (card: PlayerStrategem, nextTradeGoods: number) => void
  disabled?: boolean
  tradeGoodsBusy?: boolean
}

function StrategemCard({
  card,
  onToggle,
  onRemove,
  onTradeGoodsChange,
  disabled = false,
  tradeGoodsBusy = false
}: StrategemCardProps) {
  const asset = resolveAssetPath(card.asset)
  const tradeGoodIcon = resolveAssetPath('tokens/trade_good.png')

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

  const handleIncrement = () => {
    if (disabled || tradeGoodsBusy) {
      return
    }
    onTradeGoodsChange(card, card.tradeGoods + 1)
  }

  const handleDecrement = () => {
    if (disabled || tradeGoodsBusy) {
      return
    }
    onTradeGoodsChange(card, card.tradeGoods - 1)
  }

  return (
    <div className={`strategem-card-wrapper ${disabled ? 'is-disabled' : ''}`}>
      <Card
        frontImage={asset}
        backImage={asset}
        alt={`${card.name} strategem`}
        isFlipped={card.isExhausted}
        onPrimaryAction={handlePrimary}
        onSecondaryAction={handleSecondary}
        className="strategem-card"
      />
      <div className="strategem-card-footer">
        <div className="strategem-card-name">{card.name}</div>
        <div className="strategem-card-trade">
          <button
            type="button"
            className="strategem-card-trade-button"
            onClick={handleDecrement}
            disabled={disabled || tradeGoodsBusy || card.tradeGoods <= 0}
            aria-label={`Remove trade good from ${card.name}`}
          >
            -
          </button>
          <span className="strategem-card-trade-value">
            <img src={tradeGoodIcon} alt="Trade good" />
            <span>{card.tradeGoods}</span>
          </span>
          <button
            type="button"
            className="strategem-card-trade-button"
            onClick={handleIncrement}
            disabled={disabled || tradeGoodsBusy}
            aria-label={`Add trade good to ${card.name}`}
          >
            +
          </button>
        </div>
        <div className="strategem-card-hint">Hold or right-click to remove</div>
      </div>
    </div>
  )
}

export default StrategemCard
