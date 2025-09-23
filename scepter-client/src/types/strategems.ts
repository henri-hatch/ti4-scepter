export interface StrategemDefinition {
  key: string
  name: string
  asset: string
  tradeGoods: number
}

export interface PlayerStrategem extends StrategemDefinition {
  isExhausted: boolean
  acquiredAt?: string
}
