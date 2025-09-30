export type ActionCardType = 'standard' | 'legendary'

export interface ActionCardDefinition {
  key: string
  name: string
  asset: string
  type: ActionCardType
  backAsset?: string | null
}

export interface PlayerActionCard extends ActionCardDefinition {
  isExhausted: boolean
  acquiredAt?: string
}
