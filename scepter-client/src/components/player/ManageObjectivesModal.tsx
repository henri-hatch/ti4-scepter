import { useEffect, useMemo, useState } from 'react'
import type { ObjectiveDefinition, ObjectiveType, PlayerObjective } from '../../types/objectives'
import { resolveAssetPath } from '../../utils/assets'
import '../../styles/ManageExplorationCardsModal.css'

const TYPE_LABELS: Record<ObjectiveType, string> = {
  public_tier1: 'Public Objectives – Tier 1',
  public_tier2: 'Public Objectives – Tier 2',
  secret: 'Secret Objectives'
}

const CATEGORY_ORDER: ObjectiveType[] = ['public_tier1', 'public_tier2', 'secret']

function normalise(value: string): string {
  return value.trim().toLowerCase()
}

type ManageObjectivesModalProps = {
  isOpen: boolean
  onClose: () => void
  owned: PlayerObjective[]
  available: ObjectiveDefinition[]
  onAdd: (card: ObjectiveDefinition) => void
  onRemove: (card: PlayerObjective) => void
  busyKey?: string | null
}

function ManageObjectivesModal({
  isOpen,
  onClose,
  owned,
  available,
  onAdd,
  onRemove,
  busyKey = null
}: ManageObjectivesModalProps) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
    }
  }, [isOpen])

  const filterValue = normalise(search)

  const groupedOwned = useMemo(() => {
    const groups: Record<ObjectiveType, PlayerObjective[]> = {
      public_tier1: [],
      public_tier2: [],
      secret: []
    }
    owned.forEach((card) => {
      if (!groups[card.type as ObjectiveType]) {
        return
      }
      if (filterValue) {
        const haystack = `${card.name} ${card.type}`.toLowerCase()
        if (!haystack.includes(filterValue)) {
          return
        }
      }
      groups[card.type as ObjectiveType].push(card)
    })
    CATEGORY_ORDER.forEach((category) => {
      groups[category] = groups[category].slice().sort((a, b) => a.name.localeCompare(b.name))
    })
    return groups
  }, [owned, filterValue])

  const groupedAvailable = useMemo(() => {
    const groups: Record<ObjectiveType, ObjectiveDefinition[]> = {
      public_tier1: [],
      public_tier2: [],
      secret: []
    }
    available.forEach((card) => {
      if (!groups[card.type as ObjectiveType]) {
        return
      }
      if (filterValue) {
        const haystack = `${card.name} ${card.type}`.toLowerCase()
        if (!haystack.includes(filterValue)) {
          return
        }
      }
      groups[card.type as ObjectiveType].push(card)
    })
    CATEGORY_ORDER.forEach((category) => {
      groups[category] = groups[category].slice().sort((a, b) => a.name.localeCompare(b.name))
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
          <h2>Manage Objectives</h2>
          <button type="button" className="manage-exploration-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="manage-exploration-search">
          <input
            type="search"
            placeholder="Search objectives..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="manage-exploration-content">
          {CATEGORY_ORDER.map((category) => {
            const ownedGroup = groupedOwned[category] ?? []
            const availableGroup = groupedAvailable[category] ?? []

            if (ownedGroup.length === 0 && availableGroup.length === 0) {
              return null
            }

            return (
              <section key={category} className="manage-exploration-section">
                <div className="manage-exploration-section-header">
                  <h3>{TYPE_LABELS[category] ?? category}</h3>
                </div>
                <div className="manage-exploration-columns">
                  <div className="manage-exploration-column">
                    <div className="manage-exploration-column-title">Owned</div>
                    {ownedGroup.length === 0 ? (
                      <div className="manage-exploration-empty">No objectives claimed.</div>
                    ) : (
                      <div className="manage-exploration-grid">
                        {ownedGroup.map((card) => {
                          const preview = resolveAssetPath(card.asset)
                          const disabled = busyKey === card.key
                          return (
                            <button
                              key={card.key}
                              type="button"
                              className="manage-exploration-card is-owned"
                              disabled={disabled}
                              onClick={() => {
                                void onRemove(card)
                              }}
                            >
                              <img src={preview} alt={`${card.name} preview`} />
                              <div className="manage-exploration-card-meta">
                                <div className="manage-exploration-card-name">{card.name}</div>
                                <div className="manage-exploration-card-type">{card.victoryPoints} VP</div>
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
                      <div className="manage-exploration-empty">No objectives remaining.</div>
                    ) : (
                      <div className="manage-exploration-grid">
                        {availableGroup.map((card) => {
                          const preview = resolveAssetPath(card.asset)
                          const disabled = busyKey === card.key
                          return (
                            <button
                              key={card.key}
                              type="button"
                              className="manage-exploration-card"
                              disabled={disabled}
                              onClick={() => {
                                void onAdd(card)
                              }}
                            >
                              <img src={preview} alt={`${card.name} preview`} />
                              <div className="manage-exploration-card-meta">
                                <div className="manage-exploration-card-name">{card.name}</div>
                                <div className="manage-exploration-card-type">{card.victoryPoints} VP</div>
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

export default ManageObjectivesModal
