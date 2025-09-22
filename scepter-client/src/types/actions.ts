export interface ActionCardDefinition {
  key: string
  name: string
  asset: string
}

export interface PlayerActionCard extends ActionCardDefinition {
  isExhausted: boolean
  acquiredAt?: string
}
