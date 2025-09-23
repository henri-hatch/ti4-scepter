import { useEffect, useMemo, useState } from 'react'
import type { ActionCardDefinition, PlayerActionCard } from '../../types/actions'
import { resolveAssetPath } from '../../utils/assets'
import '../../styles/ManageExplorationCardsModal.css'

type ManageActionCardsModalProps = {
  isOpen: boolean
  onClose: () => void
  title?: string
  owned: PlayerActionCard[]
  available: ActionCardDefinition[]
  onAdd: (card: ActionCardDefinition) => void
  onRemove: (card: PlayerActionCard) => void
  busyKey?: string | null
}

function ManageActionCardsModal({
  isOpen,
  onClose,
  title = 'Manage Action Cards',
  owned,
  available,
  onAdd,
  onRemove,
  busyKey = null
}: ManageActionCardsModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('')
    }
  }, [isOpen])

  const search = searchTerm.trim().toLowerCase()

  const filteredOwned = useMemo(() => {
    return owned.filter((card) => {
      if (!search) {
        return true
      }
      return card.name.toLowerCase().includes(search)
    })
  }, [owned, search])

  const filteredAvailable = useMemo(() => {
    return available.filter((card) => {
      if (!search) {
        return true
      }
      return card.name.toLowerCase().includes(search)
    })
  }, [available, search])

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
            placeholder="Search action cards..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="manage-exploration-content">
          <section className="manage-exploration-section">
            <div className="manage-exploration-columns">
              <div className="manage-exploration-column">
                <div className="manage-exploration-column-title">Owned</div>
                {filteredOwned.length === 0 ? (
                  <div className="manage-exploration-empty">No action cards owned.</div>
                ) : (
                  <div className="manage-exploration-grid">
                    {filteredOwned.map((card) => {
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
                {filteredAvailable.length === 0 ? (
                  <div className="manage-exploration-empty">No action cards available.</div>
                ) : (
                  <div className="manage-exploration-grid">
                    {filteredAvailable.map((card) => {
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
        </div>
      </div>
    </div>
  )
}

export default ManageActionCardsModal
