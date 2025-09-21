import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface CardSelectionModalRenderHelpers<T> {
  onSelect: (item: T) => void
  disabled: boolean
}

interface CardSelectionModalProps<T> {
  isOpen: boolean
  title: string
  items: T[]
  onClose: () => void
  onSelect: (item: T) => void
  getSearchText: (item: T) => string
  renderItems: (items: T[], helpers: CardSelectionModalRenderHelpers<T>) => ReactNode
  searchPlaceholder?: string
  disabled?: boolean
  emptyMessage?: string
  modalClassName?: string
  backdropClassName?: string
  contentClassName?: string
}

function CardSelectionModal<T>({
  isOpen,
  title,
  items,
  onClose,
  onSelect,
  getSearchText,
  renderItems,
  searchPlaceholder = 'Search…',
  disabled = false,
  emptyMessage = 'No items match your search.',
  modalClassName,
  backdropClassName,
  contentClassName
}: CardSelectionModalProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      window.setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) {
      return items
    }

    return items.filter((item) => getSearchText(item).toLowerCase().includes(term))
  }, [getSearchText, items, searchTerm])

  if (!isOpen) {
    return null
  }

  const handleSelect = (item: T) => {
    if (disabled) {
      return
    }
    onSelect(item)
  }

  const backdropClasses = ['planet-modal-backdrop', 'card-selection-backdrop', backdropClassName]
    .filter(Boolean)
    .join(' ')

  const modalClasses = ['planet-modal', 'card-selection-modal', modalClassName]
    .filter(Boolean)
    .join(' ')

  const listClasses = ['planet-modal-list', 'card-selection-list', contentClassName]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={backdropClasses} role="dialog" aria-modal="true">
      <div className={modalClasses}>
        <div className="planet-modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} className="planet-modal-close" aria-label="Close">
            ×
          </button>
        </div>
        <div className="planet-modal-search">
          <input
            ref={inputRef}
            type="search"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className={listClasses}>
          {filteredItems.length > 0 ? (
            renderItems(filteredItems, { disabled, onSelect: handleSelect })
          ) : (
            <div className="planet-modal-empty">{emptyMessage}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export type { CardSelectionModalProps, CardSelectionModalRenderHelpers }
export default CardSelectionModal
