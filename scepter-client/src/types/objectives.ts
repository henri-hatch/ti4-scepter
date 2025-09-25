export type ObjectiveType = 'public_tier1' | 'public_tier2' | 'secret'

export interface ObjectiveDefinition {
  key: string
  name: string
  type: ObjectiveType
  victoryPoints: number
  asset: string
  slotIndex?: number | null
}

export interface PlayerObjective extends ObjectiveDefinition {
  isCompleted: boolean
  acquiredAt?: string | null
  completedAt?: string | null
}
