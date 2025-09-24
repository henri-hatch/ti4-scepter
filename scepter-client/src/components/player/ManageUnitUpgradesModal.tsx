import { resolveAssetPath } from '../../utils/assets'
import type { TechnologyDefinition } from '../../types/technology'
import type { UnitSlotKey } from '../../data/unitSlots'
import '../../styles/Overview.css'

type UnitSlotEntry = {
  slot: UnitSlotKey
  label: string
  definition: TechnologyDefinition | null
  owned: boolean
}

type ManageUnitUpgradesModalProps = {
  isOpen: boolean
  entries: UnitSlotEntry[]
  busyKey: string | null
  onAdd: (definition: TechnologyDefinition) => Promise<void> | void
  onRemove: (definition: TechnologyDefinition) => Promise<void> | void
  onClose: () => void
  errorMessage?: string | null
}

function ManageUnitUpgradesModal({
  isOpen,
  entries,
  busyKey,
  onAdd,
  onRemove,
  onClose,
  errorMessage = null
}: ManageUnitUpgradesModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="overview-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="overview-modal large" onClick={(event) => event.stopPropagation()}>
        <div className="overview-modal-header">
          <h2>Manage Unit Upgrades</h2>
          <button type="button" className="overview-modal-close" onClick={onClose} aria-label="Close manage unit upgrades modal">
            ×
          </button>
        </div>
        <div className="overview-modal-body">
          <p className="overview-modal-description">
            Toggle which unit upgrades you currently possess. Faction-specific variants automatically replace the standard unit card.
          </p>
          <div className="unit-upgrade-grid">
            {entries.map((entry) => {
              const { definition, owned, label } = entry
              const isBusy = busyKey === definition?.key

              if (!definition) {
                return (
                  <div key={entry.slot} className="unit-upgrade-card unavailable">
                    <div className="unit-upgrade-header">
                      <h3>{label}</h3>
                      <span className="unit-upgrade-status">Unavailable</span>
                    </div>
                    <div className="unit-upgrade-placeholder">No card data</div>
                  </div>
                )
              }

              const preview = resolveAssetPath(definition.asset)

              return (
                <div key={definition.key} className={owned ? 'unit-upgrade-card owned' : 'unit-upgrade-card'}>
                  <div className="unit-upgrade-header">
                    <h3>{label}</h3>
                    <span className={owned ? 'unit-upgrade-status owned' : 'unit-upgrade-status'}>
                      {owned ? 'Owned' : 'Available'}
                    </span>
                  </div>
                  <div className="unit-upgrade-preview">
                    <img src={preview} alt={`${definition.name} card`} />
                  </div>
                  <button
                    type="button"
                    className={owned ? 'unit-upgrade-action remove' : 'unit-upgrade-action add'}
                    onClick={() => (owned ? onRemove(definition) : onAdd(definition))}
                    disabled={Boolean(isBusy)}
                  >
                    {isBusy ? 'Saving…' : owned ? 'Remove Upgrade' : 'Add Upgrade'}
                  </button>
                </div>
              )
            })}
          </div>
          {errorMessage ? <div className="overview-modal-error">{errorMessage}</div> : null}
        </div>
        <div className="overview-modal-footer">
          <button type="button" className="overview-modal-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export type { UnitSlotEntry }
export default ManageUnitUpgradesModal
