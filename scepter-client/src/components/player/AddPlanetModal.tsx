import CardSelectionModal from './CardSelectionModal'
import type { PlanetDefinition } from '../../types/planets'
import { resolveAssetPath } from '../../utils/assets'
import '../../styles/Planets.css'

type AddPlanetModalProps = {
  isOpen: boolean
  onClose: () => void
  planets: PlanetDefinition[]
  onAddPlanet: (planet: PlanetDefinition) => void
  disabled?: boolean
}

function AddPlanetModal({ isOpen, onClose, planets, onAddPlanet, disabled = false }: AddPlanetModalProps) {
  return (
    <CardSelectionModal
      isOpen={isOpen}
      title="Add Planet"
      items={planets}
      onClose={onClose}
      onSelect={onAddPlanet}
      getSearchText={(planet) => planet.name}
      renderItems={(items, { onSelect, disabled: isDisabled }) => (
        items.map((planet) => {
          const preview = resolveAssetPath(planet.assetFront)
          return (
            <button
              key={planet.key}
              type="button"
              className="planet-modal-item"
              onClick={() => onSelect(planet)}
              disabled={isDisabled}
            >
              <img src={preview} alt={`${planet.name} preview`} />
              <div className="planet-modal-item-meta">
                <div className="planet-modal-item-name">{planet.name}</div>
                <div className="planet-modal-item-info">
                  <span>{planet.type}</span>
                  <span>{planet.resources}R / {planet.influence}I</span>
                </div>
                <div className="planet-modal-item-sub">
                  {planet.techSpecialty ?? 'No Tech Specialty'}
                </div>
              </div>
            </button>
          )
        })
      )}
      searchPlaceholder="Search planets..."
      disabled={disabled}
      emptyMessage="No planets match your search."
    />
  )
}

export default AddPlanetModal
