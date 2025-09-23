import { useEffect, useMemo, useState } from 'react'
import type { ExplorationCardDefinition, ExplorationSubtype, PlayerExplorationCard } from '../../types/exploration'
import { resolveAssetPath } from '../../utils/assets'
import '../../styles/ManageExplorationCardsModal.css'

const SUBTYPE_LABELS: Record<ExplorationSubtype, string> = {
  action: 'Exploration Actions',
  relic_fragment: 'Relic Fragments',
  relic: 'Relics',
  attach: 'Attachments'
}

function normaliseSearch(value: string): string {
  return value.trim().toLowerCase()
}

type ManageExplorationCardsModalProps = {
  isOpen: boolean
  title: string
  onClose: () => void
  owned: PlayerExplorationCard[]
  available: ExplorationCardDefinition[]
  onAdd: (card: ExplorationCardDefinition) => void
  onRemove: (card: PlayerExplorationCard) => void
  busyKey?: string | null
  subtypes?: ExplorationSubtype[]
}

function ManageExplorationCardsModal({
  isOpen,
  title,
  onClose,
  owned,
  available,
  onAdd,
  onRemove,
  busyKey = null,
  subtypes
}: ManageExplorationCardsModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('')
    }
  }, [isOpen])

  const visibleSubtypes = useMemo(() => {
    const allowed = subtypes?.length ? subtypes : ['action', 'relic_fragment', 'relic']
    return new Set<ExplorationSubtype>(allowed as ExplorationSubtype[])
  }, [subtypes])

  const search = normaliseSearch(searchTerm)

  const filteredOwned = useMemo(() => {
    return owned.filter((card) => {
      if (!visibleSubtypes.has(card.subtype)) {
        return false
      }
      if (!search) {
        return true
      }
      const haystack = `${card.name} ${card.type} ${card.subtype}`.toLowerCase()
      return haystack.includes(search)
    })
  }, [owned, visibleSubtypes, search])

  const filteredAvailable = useMemo(() => {
    return available.filter((card) => {
      if (!visibleSubtypes.has(card.subtype)) {
        return false
      }
      if (!search) {
        return true
      }
      const haystack = `${card.name} ${card.type} ${card.subtype}`.toLowerCase()
      return haystack.includes(search)
    })
  }, [available, visibleSubtypes, search])

  const subtypeOrdering = useMemo(() => {
    return ['action', 'relic_fragment', 'relic'].filter((key) => visibleSubtypes.has(key as ExplorationSubtype)) as ExplorationSubtype[]
  }, [visibleSubtypes])

  if (!isOpen) {
    return null
  }

  return (
    <div className="manage-exploration-backdrop" role="dialog" aria-modal="true">
      <div className="manage-exploration-modal">
        <div className="manage-exploration-header">
          <h2>{title}</h2>
          <button type="button" className="manage-exploration-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="manage-exploration-search">
          <input
            type="search"
            placeholder="Search cards..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="manage-exploration-content">
          {subtypeOrdering.map((subtype) => {
            const ownedGroup = filteredOwned.filter((card) => card.subtype === subtype)
            const availableGroup = filteredAvailable.filter((card) => card.subtype === subtype)

            if (ownedGroup.length === 0 && availableGroup.length === 0) {
              return null
            }

            return (
              <section key={subtype} className="manage-exploration-section">
                <div className="manage-exploration-section-header">
                  <h3>{SUBTYPE_LABELS[subtype] ?? subtype}</h3>
                </div>
                <div className="manage-exploration-columns">
                  <div className="manage-exploration-column">
                    <div className="manage-exploration-column-title">Owned</div>
                    {ownedGroup.length === 0 ? (
                      <div className="manage-exploration-empty">None owned.</div>
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
                                <div className="manage-exploration-card-type">{card.type}</div>
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
                      <div className="manage-exploration-empty">No cards available.</div>
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
                                <div className="manage-exploration-card-type">{card.type}</div>
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

export default ManageExplorationCardsModal
