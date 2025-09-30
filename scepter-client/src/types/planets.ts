import type { PlanetAttachment } from './exploration'

export type PlanetType = 'Cultural' | 'Hazardous' | 'Industrial'
export type TechSpecialty = 'Biotic - Green' | 'Propulsion - Blue' | 'Cybernetic - Yellow' | 'Warfare - Red' | 'None' | null

export interface PlanetDefinition {
  key: string
  name: string
  type: PlanetType
  techSpecialty: TechSpecialty
  resources: number
  influence: number
  legendary: boolean
  assetFront: string
  assetBack: string
  legendaryAbility: string | null
}

export interface PlayerPlanet extends PlanetDefinition {
  isExhausted: boolean
  attachments: PlanetAttachment[]
}
