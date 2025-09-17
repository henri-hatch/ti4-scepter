import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      window.setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const filteredPlanets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      return planets
    }

    return planets.filter((planet) => planet.name.toLowerCase().includes(term))
  }, [planets, searchTerm])

  if (!isOpen) {
    return null
  }

  return (
    <div className="planet-modal-backdrop" role="dialog" aria-modal="true">
      <div className="planet-modal">
        <div className="planet-modal-header">
          <h2>Add Planet</h2>
          <button type="button" onClick={onClose} className="planet-modal-close" aria-label="Close">
            ×
          </button>
        </div>
        <div className="planet-modal-search">
          <input
            ref={inputRef}
            type="search"
            placeholder="Search planets..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="planet-modal-list">
          {filteredPlanets.length > 0 ? (
            filteredPlanets.map((planet) => {
              const preview = resolveAssetPath(planet.assetFront)
              return (
                <button
                  key={planet.key}
                  type="button"
                  className="planet-modal-item"
                  onClick={() => onAddPlanet(planet)}
                  disabled={disabled}
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
          ) : (
            <div className="planet-modal-empty">No planets match your search.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AddPlanetModal
