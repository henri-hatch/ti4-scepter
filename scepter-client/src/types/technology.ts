export type TechnologyType = 'Biotic' | 'Propulsion' | 'Cybernetic' | 'Warfare' | 'Unit'
export type TechnologyFaction = 'none' | string

export interface TechnologyDefinition {
  key: string
  name: string
  type: TechnologyType
  faction: TechnologyFaction
  tier: number
  asset: string
}

export interface PlayerTechnology extends TechnologyDefinition {
  isExhausted: boolean
}
