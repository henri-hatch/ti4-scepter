import { useEffect, useMemo, useState } from 'react'
import type { PlayerTechnology, TechnologyDefinition, TechnologyType } from '../../types/technology'
import { resolveAssetPath } from '../../utils/assets'
import { formatFactionLabel } from '../../utils/technology'
import '../../styles/ManageExplorationCardsModal.css'

const TYPE_ORDER: TechnologyType[] = ['Biotic', 'Propulsion', 'Cybernetic', 'Warfare', 'Unit']

function normalise(value: string): string {
  return value.trim().toLowerCase()
}

type ManageTechnologyModalProps = {
  isOpen: boolean
  onClose: () => void
  owned: PlayerTechnology[]
  available: TechnologyDefinition[]
  onAdd: (tech: TechnologyDefinition) => void
  onRemove: (tech: PlayerTechnology) => void
  busyKey?: string | null
}

const sortTechnologyItems = <T extends { tier: number; name: string; type: TechnologyType }>(items: T[]): T[] => {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) {
      return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
    }
    if (a.tier !== b.tier) {
      return a.tier - b.tier
    }
    return a.name.localeCompare(b.name)
  })
}

function ManageTechnologyModal({
  isOpen,
  onClose,
  owned,
  available,
  onAdd,
  onRemove,
  busyKey = null
}: ManageTechnologyModalProps) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
    }
  }, [isOpen])

  const filterValue = normalise(search)

  const groupedOwned = useMemo(() => {
    const groups: Record<TechnologyType, PlayerTechnology[]> = {
      Biotic: [],
      Propulsion: [],
      Cybernetic: [],
      Warfare: [],
      Unit: []
    }

    owned.forEach((tech) => {
      if (!groups[tech.type]) {
        return
      }
      if (filterValue) {
        const haystack = normalise(`${tech.name} ${tech.type} tier ${tech.tier} ${tech.faction ?? ''}`)
        if (!haystack.includes(filterValue)) {
          return
        }
      }
      groups[tech.type].push(tech)
    })

    TYPE_ORDER.forEach((type) => {
      groups[type] = sortTechnologyItems(groups[type])
    })

    return groups
  }, [owned, filterValue])

  const groupedAvailable = useMemo(() => {
    const groups: Record<TechnologyType, TechnologyDefinition[]> = {
      Biotic: [],
      Propulsion: [],
      Cybernetic: [],
      Warfare: [],
      Unit: []
    }

    available.forEach((tech) => {
      if (!groups[tech.type]) {
        return
      }
      if (filterValue) {
        const haystack = normalise(`${tech.name} ${tech.type} tier ${tech.tier} ${tech.faction ?? ''}`)
        if (!haystack.includes(filterValue)) {
          return
        }
      }
      groups[tech.type].push(tech)
    })

    TYPE_ORDER.forEach((type) => {
      groups[type] = sortTechnologyItems(groups[type])
    })

    return groups
  }, [available, filterValue])

  if (!isOpen) {
    return null
  }

  return (
    <div className="manage-exploration-backdrop" role="dialog" aria-modal="true">
      <div className="manage-exploration-modal">
        <div className="manage-exploration-header">
          <h2>Manage Technology</h2>
          <button type="button" className="manage-exploration-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="manage-exploration-search">
          <input
            type="search"
            placeholder="Search technology..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="manage-exploration-content">
          {TYPE_ORDER.map((type) => {
            const ownedGroup = groupedOwned[type] ?? []
            const availableGroup = groupedAvailable[type] ?? []

            if (ownedGroup.length === 0 && availableGroup.length === 0) {
              return null
            }

            return (
              <section key={type} className="manage-exploration-section">
                <div className="manage-exploration-section-header">
                  <h3>{type}</h3>
                </div>
                <div className="manage-exploration-columns">
                  <div className="manage-exploration-column">
                    <div className="manage-exploration-column-title">Owned</div>
                    {ownedGroup.length === 0 ? (
                      <div className="manage-exploration-empty">No technology learned.</div>
                    ) : (
                      <div className="manage-exploration-grid">
                        {ownedGroup.map((tech) => {
                          const preview = resolveAssetPath(tech.asset)
                          const disabled = busyKey === tech.key
                          return (
                            <button
                              key={tech.key}
                              type="button"
                              className="manage-exploration-card is-owned"
                              disabled={disabled}
                              onClick={() => {
                                onRemove(tech)
                              }}
                            >
                          <img src={preview} alt={`${tech.name} preview`} draggable={false} />
                          <div className="manage-exploration-card-meta">
                            <div className="manage-exploration-card-name">{tech.name}</div>
                            <div className="manage-exploration-card-type">Tier {tech.tier}</div>
                            {tech.faction && tech.faction !== 'none' ? (
                              <div className="manage-exploration-card-faction">{formatFactionLabel(tech.faction)}</div>
                            ) : null}
                            <div className="manage-exploration-card-hint">Tap to remove</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                    )}
                  </div>
                  <div className="manage-exploration-column">
                    <div className="manage-exploration-column-title">Available</div>
                    {availableGroup.length === 0 ? (
                      <div className="manage-exploration-empty">No technology remaining.</div>
                    ) : (
                      <div className="manage-exploration-grid">
                        {availableGroup.map((tech) => {
                          const preview = resolveAssetPath(tech.asset)
                          const disabled = busyKey === tech.key
                          return (
                            <button
                              key={tech.key}
                              type="button"
                              className="manage-exploration-card"
                              disabled={disabled}
                              onClick={() => {
                                onAdd(tech)
                              }}
                            >
                          <img src={preview} alt={`${tech.name} preview`} draggable={false} />
                          <div className="manage-exploration-card-meta">
                            <div className="manage-exploration-card-name">{tech.name}</div>
                            <div className="manage-exploration-card-type">Tier {tech.tier}</div>
                            {tech.faction && tech.faction !== 'none' ? (
                              <div className="manage-exploration-card-faction">{formatFactionLabel(tech.faction)}</div>
                            ) : null}
                            <div className="manage-exploration-card-hint">Tap to add</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                    )}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ManageTechnologyModal
