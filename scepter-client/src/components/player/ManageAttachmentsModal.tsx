import { useMemo, useState } from 'react'
import type { ExplorationCardDefinition, PlanetAttachment } from '../../types/exploration'
import { resolveAssetPath } from '../../utils/assets'
import '../../styles/ManageAttachmentsModal.css'

type ManageAttachmentsModalProps = {
  isOpen: boolean
  onClose: () => void
  planetName: string
  planetType: string
  attachments: PlanetAttachment[]
  available: ExplorationCardDefinition[]
  onAdd: (card: ExplorationCardDefinition) => void
  onRemove: (attachment: PlanetAttachment) => void
  busyKey?: string | null
}

function ManageAttachmentsModal({
  isOpen,
  onClose,
  planetName,
  planetType,
  attachments,
  available,
  onAdd,
  onRemove,
  busyKey = null
}: ManageAttachmentsModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const normalizedType = planetType.trim().toLowerCase()
    const matchesType = (item: { type: string }) => {
      if (!normalizedType) {
        return true
      }
      return (item.type ?? '').toLowerCase() === normalizedType
    }
    const typeFilteredCandidates = available.filter(matchesType)

    if (!term) {
      return {
        attached: attachments,
        candidates: typeFilteredCandidates
      }
    }
    const filterFn = (item: { name: string; type: string }) => (
      item.name.toLowerCase().includes(term) || item.type.toLowerCase().includes(term)
    )
    return {
      attached: attachments.filter(filterFn),
      candidates: typeFilteredCandidates.filter(filterFn)
    }
  }, [attachments, available, planetType, searchTerm])

  if (!isOpen) {
    return null
  }

  return (
    <div className="manage-attachments-backdrop" role="dialog" aria-modal="true">
      <div className="manage-attachments-modal">
        <div className="manage-attachments-header">
          <h2>Manage Attachments</h2>
          <button type="button" className="manage-attachments-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="manage-attachments-subtitle">{planetName}</div>
        <div className="manage-attachments-search">
          <input
            type="search"
            placeholder="Search attachments..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="manage-attachments-content">
          <section className="manage-attachments-section">
            <div className="manage-attachments-section-title">Added</div>
            {filters.attached.length === 0 ? (
              <div className="manage-attachments-empty">No attachments assigned.</div>
            ) : (
              <div className="manage-attachments-grid">
                {filters.attached.map((attachment) => {
                  const preview = resolveAssetPath(attachment.asset)
                  const isBusy = busyKey === attachment.key
                  return (
                    <button
                      key={`${attachment.key}-${attachment.id}`}
                      type="button"
                      className="manage-attachments-item is-added"
                      onClick={() => onRemove(attachment)}
                      disabled={isBusy}
                    >
                      <img src={preview} alt={`${attachment.name} preview`} />
                      <div className="manage-attachments-meta">
                        <div className="manage-attachments-name">{attachment.name}</div>
                        <div className="manage-attachments-type">{attachment.type}</div>
                        <div className="manage-attachments-hint">Tap to remove</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
          <hr className="manage-attachments-divider" />
          <section className="manage-attachments-section">
            <div className="manage-attachments-section-title">Available</div>
            {filters.candidates.length === 0 ? (
              <div className="manage-attachments-empty">No matching attachments.</div>
            ) : (
              <div className="manage-attachments-grid">
                {filters.candidates.map((card) => {
                  const preview = resolveAssetPath(card.asset)
                  const isBusy = busyKey === card.key
                  return (
                    <button
                      key={card.key}
                      type="button"
                      className="manage-attachments-item"
                      onClick={() => onAdd(card)}
                      disabled={isBusy}
                    >
                      <img src={preview} alt={`${card.name} preview`} />
                      <div className="manage-attachments-meta">
                        <div className="manage-attachments-name">{card.name}</div>
                        <div className="manage-attachments-type">{card.type}</div>
                        <div className="manage-attachments-hint">Tap to add</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default ManageAttachmentsModal
