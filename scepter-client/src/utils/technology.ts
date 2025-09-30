export function formatIdentifier(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (trimmed === 'none') {
    return ''
  }

  const withSpaces = trimmed.replace(/_/g, ' ')

  return withSpaces
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word
      .split('-')
      .map((segment) => {
        const lower = segment.toLowerCase()
        return lower.charAt(0).toUpperCase() + lower.slice(1)
      })
      .join('-'))
    .join(' ')
}

export function formatFactionLabel(faction: string | null | undefined): string {
  if (!faction || faction === 'none') {
    return ''
  }

  return formatIdentifier(faction)
}
