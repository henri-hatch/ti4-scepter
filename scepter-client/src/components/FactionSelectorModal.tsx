import { useEffect, useMemo, useState } from 'react'
import '../styles/FactionSelectorModal.css'
import type { FactionDefinition } from '../types/faction'
import { resolveAssetPath } from '../utils/assets'
import { formatIdentifier } from '../utils/technology'

interface FactionSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (faction: FactionDefinition | null) => void | Promise<void>
  selectedKey?: string | null
  title?: string
  allowUnset?: boolean
}

type FetchState = 'idle' | 'loading' | 'loaded' | 'error'

function FactionSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  selectedKey = null,
  title = 'Select Faction',
  allowUnset = false
}: FactionSelectorModalProps) {
  const [factions, setFactions] = useState<FactionDefinition[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setSubmitError(null)
    setExpandedKey(selectedKey ?? null)

    if (fetchState === 'loaded' || fetchState === 'loading') {
      return
    }

    const fetchFactions = async () => {
      setFetchState('loading')
      setError(null)
      try {
        const response = await fetch('/api/factions')
        if (!response.ok) {
          throw new Error('Failed to load faction catalog')
        }
        const payload = await response.json()
        const entries = Array.isArray(payload?.factions) ? payload.factions : []
        setFactions(entries)
        setFetchState('loaded')
      } catch (err) {
        console.error(err)
        setError('Unable to load faction catalog. Please try again.')
        setFetchState('error')
      }
    }

    fetchFactions()
  }, [fetchState, isOpen, selectedKey])

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false)
      setSubmitError(null)
    }
  }, [isOpen])

  const selectedFaction = useMemo(() => {
    if (!expandedKey) {
      return null
    }
    return factions.find((item) => item.key === expandedKey) ?? null
  }, [expandedKey, factions])

  const handleToggleFaction = (key: string) => {
    setExpandedKey((current) => (current === key ? null : key))
    setSubmitError(null)
  }

  const handleConfirm = async () => {
    if (!selectedFaction && !allowUnset) {
      setSubmitError('Please choose a faction before confirming.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      await onConfirm(selectedFaction)
      onClose()
    } catch (err) {
      console.error(err)
      setSubmitError('Failed to save faction. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClear = async () => {
    if (!allowUnset) {
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onConfirm(null)
      onClose()
    } catch (err) {
      console.error(err)
      setSubmitError('Failed to clear faction. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="faction-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="faction-modal-title"
      onClick={onClose}
    >
      <div className="faction-modal" onClick={(event) => event.stopPropagation()}>
        <div className="faction-modal-header">
          <h2 id="faction-modal-title">{title}</h2>
          <button type="button" className="faction-modal-close" onClick={onClose} aria-label="Close faction selector">
            ×
          </button>
        </div>

        <div className="faction-modal-body">
          {fetchState === 'loading' ? (
            <div className="faction-modal-status">Loading factions…</div>
          ) : null}

          {fetchState === 'error' ? (
            <div className="faction-modal-error">
              <p>{error ?? 'Unable to load factions.'}</p>
              <button type="button" onClick={() => setFetchState('idle')} className="faction-modal-retry">
                Retry
              </button>
            </div>
          ) : null}

          {fetchState === 'loaded' ? (
            factions.length === 0 ? (
              <div className="faction-modal-empty">No factions available.</div>
            ) : (
              <ul className="faction-modal-list">
                {factions.map((faction) => {
                  const isExpanded = faction.key === expandedKey
                  return (
                    <li key={faction.key} className={isExpanded ? 'faction-item expanded' : 'faction-item'}>
                      <button
                        type="button"
                        className="faction-item-toggle"
                        onClick={() => handleToggleFaction(faction.key)}
                        aria-expanded={isExpanded}
                      >
                        <span className="faction-item-name">{faction.name}</span>
                        <span className="faction-item-key">{faction.key}</span>
                      </button>
                      {isExpanded ? (
                        <div className="faction-item-details">
                          {faction.referenceAsset ? (
                            <div className="faction-reference">
                              <img
                                src={resolveAssetPath(faction.referenceAsset)}
                                alt={`${faction.name} reference sheet`}
                              />
                            </div>
                          ) : null}
                          {faction.startingTech.length > 0 ? (
                            <div className="faction-detail-group">
                              <h3>Starting Technology</h3>
                              <ul>
                                {faction.startingTech.map((tech) => (
                                  <li key={tech}>{formatIdentifier(tech)}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {faction.homePlanet.length > 0 ? (
                            <div className="faction-detail-group">
                              <h3>Home Planet</h3>
                              <ul>
                                {faction.homePlanet.map((planet) => (
                                  <li key={planet}>{formatIdentifier(planet)}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          <button
                            type="button"
                            className="faction-confirm"
                            onClick={handleConfirm}
                            disabled={submitting}
                          >
                            {submitting ? 'Saving…' : 'Confirm Faction'}
                          </button>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )
          ) : null}

          {submitError ? <div className="faction-modal-error inline">{submitError}</div> : null}
        </div>

        <div className="faction-modal-footer">
          {allowUnset ? (
            <button
              type="button"
              className="faction-clear"
              onClick={handleClear}
              disabled={submitting}
            >
              {submitting ? 'Updating…' : 'Clear Faction'}
            </button>
          ) : null}
          <button type="button" className="faction-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default FactionSelectorModal
