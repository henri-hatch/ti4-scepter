import { useRef } from 'react'
import type { MouseEvent } from 'react'
import '../../styles/Card.css'

type CardProps = {
  frontImage: string
  backImage: string
  alt: string
  isFlipped?: boolean
  onPrimaryAction?: () => void
  onSecondaryAction?: () => void
  className?: string
}

const LONG_PRESS_DURATION = 500

function Card({
  frontImage,
  backImage,
  alt,
  isFlipped = false,
  onPrimaryAction,
  onSecondaryAction,
  className = ''
}: CardProps) {
  const timerRef = useRef<number | null>(null)
  const triggeredSecondary = useRef(false)

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handlePrimary = () => {
    if (!triggeredSecondary.current) {
      onPrimaryAction?.()
    }
    triggeredSecondary.current = false
  }

  const handleSecondary = () => {
    triggeredSecondary.current = true
    onSecondaryAction?.()
  }

  const handlePointerDown = () => {
    if (!onSecondaryAction) {
      return
    }

    clearTimer()
    triggeredSecondary.current = false
    timerRef.current = window.setTimeout(() => {
      handleSecondary()
    }, LONG_PRESS_DURATION)
  }

  const handlePointerUp = () => {
    if (timerRef.current) {
      clearTimer()
      if (!triggeredSecondary.current) {
        handlePrimary()
      }
    }
  }

  const handlePointerLeave = () => {
    clearTimer()
    triggeredSecondary.current = false
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    handlePrimary()
  }

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    handleSecondary()
  }

  const buttonClasses = [`card-base`, className, isFlipped ? 'is-flipped' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={buttonClasses}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerLeave}
      onTouchStart={handlePointerDown}
      onTouchEnd={handlePointerUp}
      aria-label={alt}
      aria-pressed={isFlipped}
    >
      <div className="card-inner">
        <div className="card-face card-face--front">
          <img src={frontImage} alt={alt} draggable={false} />
        </div>
        <div className="card-face card-face--back">
          <img src={backImage} alt={`${alt} (exhausted)`} draggable={false} />
        </div>
      </div>
    </button>
  )
}

export default Card
