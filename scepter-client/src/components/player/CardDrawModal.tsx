import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import '../../styles/CardDrawModal.css'

type CardDrawModalProps<T> = {
  isOpen: boolean
  title: string
  drawCard?: () => Promise<T>
  initialCard?: T | null
  onConfirm: (card: T) => Promise<void> | void
  onDismiss: (card: T | null) => void
  renderCard: (card: T, revealed: boolean) => ReactNode
  confirmLabel?: string
  dismissLabel?: string
}

function CardDrawModal<T>({
  isOpen,
  title,
  drawCard,
  initialCard = null,
  onConfirm,
  onDismiss,
  renderCard,
  confirmLabel = 'Add to Inventory',
  dismissLabel = 'Dismiss'
}: CardDrawModalProps<T>) {
  const [loading, setLoading] = useState(false)
  const [card, setCard] = useState<T | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const revealTimer = useRef<number | null>(null)

  const clearRevealTimer = () => {
    if (revealTimer.current !== null) {
      window.clearTimeout(revealTimer.current)
      revealTimer.current = null
    }
  }

  useEffect(() => {
    if (!isOpen) {
      clearRevealTimer()
      setCard(null)
      setRevealed(false)
      setLoading(false)
      setError(null)
      setConfirmError(null)
      setConfirming(false)
      return
    }

    let cancelled = false

    const revealCard = (payload: T) => {
      if (cancelled) {
        return
      }
      setCard(payload)
      setLoading(false)
      setError(null)
      setRevealed(false)
      clearRevealTimer()
      revealTimer.current = window.setTimeout(() => {
        if (!cancelled) {
          setRevealed(true)
        }
      }, 450)
    }

    if (initialCard) {
      revealCard(initialCard)
      return () => {
        cancelled = true
        clearRevealTimer()
      }
    }

    if (!drawCard) {
      setError('No draw handler provided')
      setLoading(false)
      return () => {
        cancelled = true
        clearRevealTimer()
      }
    }

    setLoading(true)
    setError(null)
    setConfirmError(null)
    setConfirming(false)

    drawCard()
      .then((result) => {
        revealCard(result)
      })
      .catch((err: unknown) => {
        console.error('Failed to draw card', err)
        if (!cancelled) {
          setError('Unable to draw a card. Please try again.')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      clearRevealTimer()
    }
  }, [isOpen, drawCard, initialCard])

  if (!isOpen) {
    return null
  }

  const handleClose = () => {
    onDismiss(card)
  }

  const handleConfirm = async () => {
    if (!card || confirming) {
      return
    }
    setConfirming(true)
    setConfirmError(null)
    try {
      await onConfirm(card)
      onDismiss(card)
    } catch (err) {
      console.error('Failed to confirm drawn card', err)
      setConfirmError('Unable to add the card. Please try again.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="card-draw-backdrop" role="dialog" aria-modal="true">
      <div className="card-draw-modal">
        <div className="card-draw-header">
          <h2>{title}</h2>
          <button type="button" className="card-draw-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="card-draw-body">
          {error ? (
            <div className="card-draw-error">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  if (drawCard) {
                    setLoading(true)
                    drawCard()
                      .then((result) => {
                        setCard(result)
                        setConfirmError(null)
                        setRevealed(false)
                        clearRevealTimer()
                        revealTimer.current = window.setTimeout(() => setRevealed(true), 450)
                      })
                      .catch((err: unknown) => {
                        console.error('Failed to redraw card', err)
                        setError('Unable to draw a card. Please try again later.')
                      })
                      .finally(() => {
                        setLoading(false)
                      })
                  }
                }}
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="card-draw-stage">
              <div className={`card-draw-slot ${loading ? 'is-loading' : ''} ${revealed ? 'is-revealed' : ''}`}>
                {card && renderCard(card, revealed)}
                {!card && !loading ? (
                  <div className="card-draw-placeholder">No card available.</div>
                ) : null}
              </div>
            </div>
          )}
        </div>
        <div className="card-draw-footer">
          {confirmError ? <div className="card-draw-confirm-error">{confirmError}</div> : null}
          <div className="card-draw-actions">
            <button type="button" className="secondary" onClick={handleClose} disabled={confirming}>
              {dismissLabel}
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleConfirm}
              disabled={!card || confirming || loading || Boolean(error)}
            >
              {confirming ? 'Saving…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CardDrawModal
