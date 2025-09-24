export interface FactionDefinition {
  key: string
  name: string
  startingTech: string[]
  homePlanet: string[]
  referenceAsset: string | null
  sheetFrontAsset: string | null
  sheetBackAsset: string | null
  tokenAsset: string | null
}
