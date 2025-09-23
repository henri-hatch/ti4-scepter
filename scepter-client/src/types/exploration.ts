export type ExplorationSubtype = 'attach' | 'action' | 'relic_fragment' | 'relic'
export type ExplorationType = 'Cultural' | 'Hazardous' | 'Industrial' | 'Frontier' | 'Relic' | string

export interface ExplorationCardDefinition {
  key: string
  name: string
  type: ExplorationType
  subtype: ExplorationSubtype
  asset: string
}

export interface PlayerExplorationCard extends ExplorationCardDefinition {
  isExhausted: boolean
  acquiredAt?: string
}

export interface PlanetAttachment extends ExplorationCardDefinition {
  id: number
  attachedAt?: string
}
