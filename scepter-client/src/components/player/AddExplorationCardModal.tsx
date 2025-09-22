import { useMemo } from 'react'
import CardSelectionModal from './CardSelectionModal'
import { resolveAssetPath } from '../../utils/assets'
import type { ExplorationCardDefinition } from '../../types/exploration'
import '../../styles/Planets.css'

const GROUPS: Array<{ heading: string; subtype: ExplorationCardDefinition['subtype'] }> = [
  { heading: 'Action', subtype: 'action' },
  { heading: 'Relic Fragments', subtype: 'relic_fragment' }
]

type AddExplorationCardModalProps = {
  isOpen: boolean
  onClose: () => void
  cards: ExplorationCardDefinition[]
  onAdd: (card: ExplorationCardDefinition) => void
  disabled?: boolean
}

function AddExplorationCardModal({ isOpen, onClose, cards, onAdd, disabled = false }: AddExplorationCardModalProps) {
  const sorted = useMemo(() => {
    const copy = [...cards]
    copy.sort((a, b) => {
      if (a.subtype !== b.subtype) {
        return GROUPS.findIndex((group) => group.subtype === a.subtype) - GROUPS.findIndex((group) => group.subtype === b.subtype)
      }
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type)
      }
      return a.name.localeCompare(b.name)
    })
    return copy
  }, [cards])

  return (
    <CardSelectionModal
      isOpen={isOpen}
      title="Add Exploration Card"
      items={sorted}
      onClose={onClose}
      onSelect={onAdd}
      getSearchText={(card) => `${card.name} ${card.type} ${card.subtype}`}
      renderItems={(items, { onSelect, disabled: isDisabled }) => (
        <div className="technology-modal-content">
          {GROUPS.map((group) => {
            const sectionItems = items.filter((item) => item.subtype === group.subtype)
            if (sectionItems.length === 0) {
              return null
            }
            return (
              <div key={group.subtype} className="technology-modal-section">
                <div className="technology-modal-section-header">
                  <h3>{group.heading}</h3>
                  <span className="technology-modal-divider" />
                </div>
                <div className="technology-modal-grid">
                  {sectionItems.map((item) => {
                    const preview = resolveAssetPath(item.asset)
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className="technology-modal-item"
                        onClick={() => onSelect(item)}
                        disabled={isDisabled}
                      >
                        <img src={preview} alt={`${item.name} preview`} />
                        <div className="technology-modal-meta">
                          <div className="technology-modal-name">{item.name}</div>
                          <div className="technology-modal-tier">{item.type}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      searchPlaceholder="Search exploration cards..."
      disabled={disabled}
      emptyMessage="All exploration cards are already in your inventory."
      modalClassName="technology-modal"
    />
  )
}

export default AddExplorationCardModal
