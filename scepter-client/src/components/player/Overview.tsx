import '../../styles/PlayerView.css'
import PlayerActionMenu from './PlayerActionMenu'

function Overview() {
  return (
    <div className="player-page">
      <h1>Overview</h1>
      <p>Coming Soon</p>
      <PlayerActionMenu options={[]} ariaLabel="Overview actions" />
    </div>
  )
}

export default Overview
