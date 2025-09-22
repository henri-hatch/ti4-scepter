import { resolveAssetPath } from '../../utils/assets'
import CardSelectionModal from './CardSelectionModal'
import type { ActionCardDefinition } from '../../types/actions'
import '../../styles/Planets.css'

type AddActionCardModalProps = {
  isOpen: boolean
  onClose: () => void
  actions: ActionCardDefinition[]
  onAdd: (card: ActionCardDefinition) => void
  disabled?: boolean
}

function AddActionCardModal({ isOpen, onClose, actions, onAdd, disabled = false }: AddActionCardModalProps) {
  return (
    <CardSelectionModal
      isOpen={isOpen}
      title="Add Action Card"
      items={actions}
      onClose={onClose}
      onSelect={onAdd}
      getSearchText={(card) => `${card.name}`}
      renderItems={(items, { onSelect, disabled: isDisabled }) => (
        <div className="technology-modal-grid">
          {items.map((card) => {
            const preview = resolveAssetPath(card.asset)
            return (
              <button
                key={card.key}
                type="button"
                className="technology-modal-item"
                onClick={() => onSelect(card)}
                disabled={isDisabled}
              >
                <img src={preview} alt={`${card.name} preview`} />
                <div className="technology-modal-meta">
                  <div className="technology-modal-name">{card.name}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
      searchPlaceholder="Search action cards..."
      disabled={disabled}
      emptyMessage="All action cards are already in your inventory."
      modalClassName="technology-modal"
      contentClassName="technology-modal-content"
    />
  )
}

export default AddActionCardModal
