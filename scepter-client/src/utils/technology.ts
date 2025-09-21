export function formatFactionLabel(faction: string | null | undefined): string {
  if (!faction || faction === 'none') {
    return ''
  }

  return faction
    .split(/[_-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}
