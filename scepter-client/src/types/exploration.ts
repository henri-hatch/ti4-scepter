export type ExplorationSubtype = 'attach' | 'action' | 'relic_fragment'
export type ExplorationType = 'Cultural' | 'Hazardous' | 'Industrial' | 'Frontier' | string

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
