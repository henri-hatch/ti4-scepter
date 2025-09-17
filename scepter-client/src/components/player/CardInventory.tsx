import '../../styles/PlayerView.css'
import PlayerActionMenu from './PlayerActionMenu'

function CardInventory() {
  return (
    <div className="player-page">
      <h1>Card Inventory</h1>
      <p>Coming Soon</p>
      <PlayerActionMenu options={[]} ariaLabel="Card inventory actions" />
    </div>
  )
}

export default CardInventory
