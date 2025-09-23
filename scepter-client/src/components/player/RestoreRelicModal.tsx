import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlayerExplorationCard } from '../../types/exploration'
import { resolveAssetPath } from '../../utils/assets'
import '../../styles/RestoreRelicModal.css'

const REQUIRED_SELECTION = 3

type RestoreRelicModalProps = {
  isOpen: boolean
  fragments: PlayerExplorationCard[]
  initialFragment?: PlayerExplorationCard | null
  onClose: () => void
  onRestore: (fragmentKeys: string[]) => Promise<PlayerExplorationCard>
}

type StagePhase = 'select' | 'focus' | 'merging' | 'revealed'

function isFrontier(fragment: PlayerExplorationCard): boolean {
  return fragment.type.toLowerCase() === 'frontier'
}

function selectionIsValid(selected: PlayerExplorationCard[]): boolean {
  if (selected.length !== REQUIRED_SELECTION) {
    return false
  }
  const nonFrontier = new Set<string>()
  selected.forEach((fragment) => {
    if (!isFrontier(fragment)) {
      nonFrontier.add(fragment.type.toLowerCase())
    }
  })
  return nonFrontier.size <= 1
}

function RestoreRelicModal({
  isOpen,
  fragments,
  initialFragment = null,
  onClose,
  onRestore
}: RestoreRelicModalProps) {
  const [phase, setPhase] = useState<StagePhase>('select')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [result, setResult] = useState<PlayerExplorationCard | null>(null)
  const [fragmentPool, setFragmentPool] = useState<PlayerExplorationCard[]>([])
  const animationTimers = useRef<number[]>([])

  const clearAnimationTimers = () => {
    animationTimers.current.forEach((timerId) => {
      window.clearTimeout(timerId)
    })
    animationTimers.current = []
  }

  useEffect(() => {
    clearAnimationTimers()

    if (!isOpen) {
      setSelectedKeys([])
      setPhase('select')
      setResult(null)
      setError(null)
      setWorking(false)
      return
    }

    setPhase('select')
    setWorking(false)
    setError(null)
    setResult(null)
    return () => {
      clearAnimationTimers()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || phase !== 'select') {
      return
    }

    setFragmentPool(fragments)
    const availableKeys = new Set(fragments.map((fragment) => fragment.key))
    setSelectedKeys((previous) => {
      const filtered = previous.filter((key) => availableKeys.has(key))
      if (filtered.length > 0) {
        return filtered
      }
      if (initialFragment && availableKeys.has(initialFragment.key)) {
        return [initialFragment.key]
      }
      return filtered
    })
  }, [isOpen, phase, fragments, initialFragment])

  const selectedFragments = useMemo(() => {
    return selectedKeys
      .map((key) => fragmentPool.find((fragment) => fragment.key === key))
      .filter((fragment): fragment is PlayerExplorationCard => Boolean(fragment))
  }, [selectedKeys, fragmentPool])

  const canRestore = phase === 'select' && selectionIsValid(selectedFragments) && !working

  const selectionHint = useMemo(() => {
    if (selectedFragments.length === 0) {
      return 'Select three relic fragments to restore a relic.'
    }
    if (selectedFragments.length < REQUIRED_SELECTION) {
      return `${REQUIRED_SELECTION - selectedFragments.length} more fragment${REQUIRED_SELECTION - selectedFragments.length === 1 ? '' : 's'} required.`
    }
    if (!selectionIsValid(selectedFragments)) {
      return 'Fragments must share a planet type. Frontier fragments are wild.'
    }
    const nonFrontier = selectedFragments.find((fragment) => !isFrontier(fragment))
    return nonFrontier ? `Ready to restore a ${nonFrontier.type} relic.` : 'Ready to assemble a relic from frontier fragments.'
  }, [selectedFragments])

  const toggleSelection = (fragment: PlayerExplorationCard) => {
    if (phase !== 'select' || working) {
      return
    }
    setSelectedKeys((previous) => {
      if (previous.includes(fragment.key)) {
        return previous.filter((key) => key !== fragment.key)
      }
      if (previous.length >= REQUIRED_SELECTION) {
        return previous
      }
      return [...previous, fragment.key]
    })
  }

  const handleRestore = async () => {
    if (!canRestore) {
      return
    }

    setWorking(true)
    setError(null)
    clearAnimationTimers()
    try {
      const relic = await onRestore(selectedFragments.map((fragment) => fragment.key))
      setResult({ ...relic, isExhausted: Boolean(relic.isExhausted) })
      setPhase('focus')

      const focusTimer = window.setTimeout(() => {
        setPhase('merging')
      }, 1900)

      const revealTimer = window.setTimeout(() => {
        setPhase('revealed')
        setWorking(false)
      }, 2600)

      animationTimers.current = [focusTimer, revealTimer]
    } catch (err) {
      console.error('Failed to restore relic', err)
      const message = err instanceof Error ? err.message : 'Unable to restore relic. Please try again.'
      setError(message)
      setWorking(false)
      setPhase('select')
    }
  }

  const handleClose = () => {
    if (working && phase !== 'revealed') {
      return
    }
    clearAnimationTimers()
    onClose()
  }

  if (!isOpen) {
    return null
  }

  const stageCaption = phase === 'focus'
    ? 'Stabilizing relics…'
    : phase === 'merging'
      ? 'Forging relic…'
      : null

  return (
    <div className="restore-relic-backdrop" role="dialog" aria-modal="true">
      <div className="restore-relic-modal">
        <div className="restore-relic-header">
          <h2>Restore Relic</h2>
          <button
            type="button"
            className="restore-relic-close"
            onClick={handleClose}
            aria-label="Close"
            disabled={working && phase !== 'revealed'}
          >
            ×
          </button>
        </div>
        <div className="restore-relic-body">
          {phase === 'select' ? (
            <>
              <p className="restore-relic-instructions">
                Combine three relic fragments of the same planet type to recover an ancient relic.
                Frontier fragments may stand in for any type.
              </p>
              {fragmentPool.length === 0 ? (
                <div className="restore-relic-empty">You do not have enough relic fragments yet.</div>
              ) : (
                <div className="restore-relic-grid">
                  {fragmentPool.map((fragment) => {
                    const selected = selectedKeys.includes(fragment.key)
                    return (
                      <button
                        key={fragment.key}
                        type="button"
                        className={`restore-relic-card ${selected ? 'is-selected' : ''}`}
                        onClick={() => toggleSelection(fragment)}
                        disabled={working}
                      >
                        <img src={resolveAssetPath(fragment.asset)} alt={`${fragment.name} fragment`} />
                        <div className="restore-relic-card-label">
                          <span className="restore-relic-card-name">{fragment.name}</span>
                          <span className="restore-relic-card-type">{fragment.type}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}

          {phase !== 'select' ? (
            <div className={`restore-relic-stage ${phase}`}>
              <div className="restore-relic-stage-fragments">
                {selectedFragments.map((fragment) => (
                  <div key={fragment.key} className="restore-relic-stage-fragment">
                    <img src={resolveAssetPath(fragment.asset)} alt={`${fragment.name} fragment`} />
                  </div>
                ))}
              </div>
              <div className="restore-relic-stage-effect" />
              {phase === 'revealed' && result ? (
                <div className="restore-relic-stage-result">
                  <img src={resolveAssetPath(result.asset)} alt={`${result.name} relic`} />
                  <div className="restore-relic-stage-caption">{result.name}</div>
                </div>
              ) : stageCaption ? (
                <div className="restore-relic-stage-caption">{stageCaption}</div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="restore-relic-footer">
          {error ? <div className="restore-relic-error">{error}</div> : <div className="restore-relic-hint">{selectionHint}</div>}
          <div className="restore-relic-actions">
            {phase === 'select' ? (
              <>
                <button type="button" className="secondary" onClick={handleClose} disabled={working}>
                  Cancel
                </button>
                <button type="button" className="primary" onClick={handleRestore} disabled={!canRestore}>
                  Restore Relic
                </button>
              </>
            ) : null}
            {phase === 'focus' || phase === 'merging' ? (
              <button type="button" className="primary" disabled>
                Restoring…
              </button>
            ) : null}
            {phase === 'revealed' ? (
              <button type="button" className="primary" onClick={handleClose}>
                Done
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RestoreRelicModal
