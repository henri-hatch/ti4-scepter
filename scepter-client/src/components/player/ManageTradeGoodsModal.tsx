import { useEffect, useState } from 'react'
import { resolveAssetPath } from '../../utils/assets'
import '../../styles/Overview.css'

type ManageTradeGoodsModalProps = {
  isOpen: boolean
  tradeGoods: number
  commodities: number
  onClose: () => void
  onConfirm: (values: { tradeGoods: number; commodities: number }) => Promise<void> | void
  saving?: boolean
  errorMessage?: string | null
}

function ManageTradeGoodsModal({
  isOpen,
  tradeGoods,
  commodities,
  onClose,
  onConfirm,
  saving = false,
  errorMessage = null
}: ManageTradeGoodsModalProps) {
  const [localTradeGoods, setLocalTradeGoods] = useState(tradeGoods)
  const [localCommodities, setLocalCommodities] = useState(commodities)

  useEffect(() => {
    if (isOpen) {
      setLocalTradeGoods(tradeGoods)
      setLocalCommodities(commodities)
    }
  }, [commodities, isOpen, tradeGoods])

  if (!isOpen) {
    return null
  }

  const handleConfirm = async () => {
    await onConfirm({ tradeGoods: localTradeGoods, commodities: localCommodities })
  }

  const adjustTradeGoods = (delta: number) => {
    setLocalTradeGoods((value) => Math.max(0, value + delta))
  }

  const adjustCommodities = (delta: number) => {
    setLocalCommodities((value) => Math.max(0, value + delta))
  }

  const tradeGoodIcon = resolveAssetPath('tokens/trade_good.png')
  const commodityIcon = resolveAssetPath('tokens/commodity.png')

  return (
    <div className="overview-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="overview-modal" onClick={(event) => event.stopPropagation()}>
        <div className="overview-modal-header">
          <h2>Manage Trade Goods</h2>
          <button type="button" className="overview-modal-close" onClick={onClose} aria-label="Close manage trade goods modal">
            ×
          </button>
        </div>
        <div className="overview-modal-body">
          <div className="economy-control">
            <img src={tradeGoodIcon} alt="Trade good icon" />
            <div className="economy-control-content">
              <div className="economy-label">Trade Goods</div>
              <div className="economy-counter">
                <button type="button" onClick={() => adjustTradeGoods(-1)} disabled={saving || localTradeGoods === 0} aria-label="Decrease trade goods">
                  −
                </button>
                <span>{localTradeGoods}</span>
                <button type="button" onClick={() => adjustTradeGoods(1)} disabled={saving} aria-label="Increase trade goods">
                  +
                </button>
              </div>
            </div>
          </div>
          <div className="economy-control">
            <img src={commodityIcon} alt="Commodity icon" />
            <div className="economy-control-content">
              <div className="economy-label">Commodities</div>
              <div className="economy-counter">
                <button type="button" onClick={() => adjustCommodities(-1)} disabled={saving || localCommodities === 0} aria-label="Decrease commodities">
                  −
                </button>
                <span>{localCommodities}</span>
                <button type="button" onClick={() => adjustCommodities(1)} disabled={saving} aria-label="Increase commodities">
                  +
                </button>
              </div>
            </div>
          </div>
          {errorMessage ? <div className="overview-modal-error">{errorMessage}</div> : null}
        </div>
        <div className="overview-modal-footer">
          <button type="button" className="overview-modal-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="overview-modal-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ManageTradeGoodsModal
