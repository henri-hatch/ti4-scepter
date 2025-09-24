import { useMemo } from 'react'
import CardSelectionModal from './CardSelectionModal'
import type { TechnologyDefinition } from '../../types/technology'
import { resolveAssetPath } from '../../utils/assets'
import { formatFactionLabel } from '../../utils/technology'
import '../../styles/Planets.css'
import '../../styles/Technology.css'

type AddTechnologyModalProps = {
  isOpen: boolean
  onClose: () => void
  technology: TechnologyDefinition[]
  onAddTechnology: (technology: TechnologyDefinition) => void
  disabled?: boolean
}

const ORDERED_TYPES: Array<TechnologyDefinition['type']> = ['Biotic', 'Propulsion', 'Cybernetic', 'Warfare', 'Unit']

function AddTechnologyModal({ isOpen, onClose, technology, onAddTechnology, disabled = false }: AddTechnologyModalProps) {
  const sortedTechnology = useMemo(() => {
    const copy = [...technology]
    copy.sort((a, b) => {
      if (a.type !== b.type) {
        return ORDERED_TYPES.indexOf(a.type) - ORDERED_TYPES.indexOf(b.type)
      }
      if (a.tier !== b.tier) {
        return a.tier - b.tier
      }
      return a.name.localeCompare(b.name)
    })
    return copy
  }, [technology])

  return (
    <CardSelectionModal
      isOpen={isOpen}
      title="Add Technology"
      items={sortedTechnology}
      onClose={onClose}
      onSelect={onAddTechnology}
      getSearchText={(tech) => `${tech.name} ${tech.type}`}
      renderItems={(items, { onSelect, disabled: isDisabled }) => {
        const grouped = ORDERED_TYPES
          .map((type) => ({ type, items: items.filter((tech) => tech.type === type) }))
          .filter((group) => group.items.length > 0)

        return grouped.map((group) => (
          <div key={group.type} className="technology-modal-section">
            <div className="technology-modal-section-header">
              <h3>{group.type}</h3>
              <span className="technology-modal-divider" />
            </div>
            <div className="technology-modal-grid">
              {group.items.map((tech) => {
                const preview = resolveAssetPath(tech.asset)
                return (
                  <button
                    key={tech.key}
                    type="button"
                    className="technology-modal-item"
                    onClick={() => onSelect(tech)}
                    disabled={isDisabled}
                  >
                    <img src={preview} alt={`${tech.name} preview`} />
                    <div className="technology-modal-meta">
                      <div className="technology-modal-name">{tech.name}</div>
                      <div className="technology-modal-tier">Tier {tech.tier}</div>
                      {tech.faction !== 'none' ? (
                        <div className="technology-modal-faction">{formatFactionLabel(tech.faction)}</div>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))
      }}
      searchPlaceholder="Search technology..."
      disabled={disabled}
      emptyMessage="No technology cards match your search."
      modalClassName="technology-modal"
      contentClassName="technology-modal-content"
    />
  )
}

export default AddTechnologyModal
