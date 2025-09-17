import { useEffect, useRef, useState } from 'react'
import '../../styles/PlayerActionMenu.css'

type MenuOption = {
  label: string
  onSelect: () => void
  disabled?: boolean
}

type PlayerActionMenuProps = {
  options: MenuOption[]
  ariaLabel?: string
}

function PlayerActionMenu({ options, ariaLabel = 'Player actions' }: PlayerActionMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickAway = (event: Event) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickAway)
      document.addEventListener('touchstart', handleClickAway)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickAway)
      document.removeEventListener('touchstart', handleClickAway)
    }
  }, [open])

  const handleToggle = () => {
    if (options.length === 0) {
      setOpen((current) => !current)
      return
    }

    setOpen((current) => !current)
  }

  const handleSelect = (option: MenuOption) => {
    if (option.disabled) {
      return
    }

    option.onSelect()
    setOpen(false)
  }

  return (
    <div className="player-action-menu" ref={containerRef}>
      <button
        type="button"
        className="player-action-button"
        onClick={handleToggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="player-action-icon" />
      </button>
      {open ? (
        <div className="player-action-sheet">
          {options.length > 0 ? (
            <ul>
              {options.map((option) => (
                <li key={option.label}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="player-action-empty">No actions available</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export type { MenuOption }
export default PlayerActionMenu
