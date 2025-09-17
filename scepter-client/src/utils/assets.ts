const assetModules = import.meta.glob<string>('../assets/**/*', { eager: true, import: 'default' })

const ASSET_CACHE: Record<string, string> = {}

for (const [key, value] of Object.entries(assetModules)) {
  const url = value as string
  ASSET_CACHE[key] = url

  const withoutPrefix = key.replace('../assets/', '')
  ASSET_CACHE[withoutPrefix] = url
  ASSET_CACHE[`/${withoutPrefix}`] = url
}

function normalisePath(relativePath: string): string {
  return relativePath
    .replace(/\\/g, '/')
    .replace(/^\.\/?/, '')
    .replace(/^assets\//, '')
}

export function resolveAssetPath(relativePath: string): string {
  const normalised = normalisePath(relativePath)
  const potential = [
    normalised,
    `planets/${normalised}`,
    normalised.startsWith('planets/') ? normalised.replace(/^planets\//, '') : undefined,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0)

  const candidates = new Set<string>(potential)

  if (normalised.includes('.front.')) {
    const faceVariant = normalised.replace('.front.', '.face.')
    candidates.add(faceVariant)
    candidates.add(`planets/${faceVariant}`)
  }

  if (normalised.includes('.face.')) {
    const frontVariant = normalised.replace('.face.', '.front.')
    candidates.add(frontVariant)
    candidates.add(`planets/${frontVariant}`)
  }

  for (const candidate of candidates) {
    if (candidate in ASSET_CACHE) {
      return ASSET_CACHE[candidate]
    }
  }

  return new URL(`../assets/${normalised}`, import.meta.url).href
}
