"""
Session manager for handling active game sessions and WebSocket connections
"""
import logging
import os
import socket
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, asdict
from datetime import datetime

from routes.games import get_game_metadata, get_player_count
from components.database import execute_query

logger = logging.getLogger(__name__)

@dataclass
class PlayerConnection:
    """Represents a connected player"""
    session_id: str
    player_id: str
    player_name: str
    joined_at: datetime

@dataclass
class GameSession:
    """Represents an active game session"""
    game_name: str
    db_path: str
    host_session_id: str
    host_ip: str
    created_at: datetime
    last_activity: datetime
    connected_players: Dict[str, PlayerConnection]  # session_id -> PlayerConnection

class SessionManager:
    """Manages active game sessions and player connections"""
    
    def __init__(self):
        self.active_sessions: Dict[str, GameSession] = {}  # game_name -> GameSession
        self.session_to_game: Dict[str, str] = {}  # session_id -> game_name
        
    def get_local_ip(self) -> str:
        """Get the local IP address of the host machine"""
        try:
            # Connect to a remote address to determine local IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                return s.getsockname()[0]
        except Exception:
            return "localhost"
    
    def start_hosting_session(self, game_name: str, db_path: str, host_session_id: str) -> bool:
        """
        Start hosting a game session
        
        Args:
            game_name: Name of the game
            db_path: Path to the game database
            host_session_id: WebSocket session ID of the host
            
        Returns:
            True if session started successfully, False otherwise
        """
        try:
            # Check if game database exists
            if not os.path.exists(db_path):
                logger.error(f"Game database not found: {db_path}")
                return False
            
            # Check if session is already active
            if game_name in self.active_sessions:
                logger.warning(f"Game session '{game_name}' is already active")
                return False
            
            # Create new session
            now = datetime.now()
            session = GameSession(
                game_name=game_name,
                db_path=db_path,
                host_session_id=host_session_id,
                host_ip=self.get_local_ip(),
                created_at=now,
                last_activity=now,
                connected_players={}
            )
            
            self.active_sessions[game_name] = session
            self.session_to_game[host_session_id] = game_name
            
            logger.info(f"Started hosting session for game '{game_name}' from {session.host_ip}")
            return True
            
        except Exception as e:
            logger.error(f"Error starting hosting session for '{game_name}': {e}")
            return False
    
    def stop_hosting_session(self, host_session_id: str) -> Optional[str]:
        """
        Stop hosting a game session
        
        Args:
            host_session_id: WebSocket session ID of the host
            
        Returns:
            Game name if session was stopped, None otherwise
        """
        try:
            game_name = self.session_to_game.get(host_session_id)
            if not game_name:
                return None
            
            # Remove session
            if game_name in self.active_sessions:
                del self.active_sessions[game_name]
            
            if host_session_id in self.session_to_game:
                del self.session_to_game[host_session_id]
            
            logger.info(f"Stopped hosting session for game '{game_name}'")
            return game_name
            
        except Exception as e:
            logger.error(f"Error stopping hosting session: {e}")
            return None
    
    def get_active_games(self) -> List[Dict]:
        """
        Get list of all active game sessions
        
        Returns:
            List of active game session information
        """
        try:
            active_games = []
            
            for game_name, session in self.active_sessions.items():
                # Get game metadata from database
                metadata = get_game_metadata(session.db_path)
                player_count = get_player_count(session.db_path)
                
                game_info = {
                    'name': game_name,
                    'hostIp': session.host_ip,
                    'createdAt': session.created_at.isoformat(),
                    'lastActivity': session.last_activity.isoformat(),
                    'playerCount': player_count,
                    'connectedPlayers': len(session.connected_players)
                }
                
                if metadata:
                    game_info.update({
                        'created': metadata.get('created_at'),
                        'lastUpdated': metadata.get('last_updated')
                    })
                
                active_games.append(game_info)
            
            return active_games
            
        except Exception as e:
            logger.error(f"Error getting active games: {e}")
            return []
    
    def get_game_players(self, game_name: str) -> List[Dict]:
        """
        Get list of players for a specific game
        
        Args:
            game_name: Name of the game
            
        Returns:
            List of player information from database
        """
        try:
            session = self.active_sessions.get(game_name)
            if not session:
                return []
            
            # Get players from database
            players = execute_query(
                session.db_path,
                "SELECT playerId, name FROM players ORDER BY name",
                fetch_all=True
            )
            
            return players or []
            
        except Exception as e:
            logger.error(f"Error getting players for game '{game_name}': {e}")
            return []
    
    def join_player_to_session(self, game_name: str, player_id: str, player_name: str, session_id: str) -> bool:
        """
        Add a player to a game session
        
        Args:
            game_name: Name of the game
            player_id: ID of the player
            player_name: Name of the player
            session_id: WebSocket session ID
            
        Returns:
            True if player joined successfully, False otherwise
        """
        try:
            session = self.active_sessions.get(game_name)
            if not session:
                logger.error(f"Game session '{game_name}' not found")
                return False
            
            # Check if player is already connected
            for conn in session.connected_players.values():
                if conn.player_id == player_id:
                    logger.warning(f"Player '{player_name}' is already connected to '{game_name}'")
                    return False
            
            # Add player connection
            connection = PlayerConnection(
                session_id=session_id,
                player_id=player_id,
                player_name=player_name,
                joined_at=datetime.now()
            )
            
            session.connected_players[session_id] = connection
            session.last_activity = datetime.now()
            self.session_to_game[session_id] = game_name
            
            logger.info(f"Player '{player_name}' joined game '{game_name}'")
            return True
            
        except Exception as e:
            logger.error(f"Error joining player to session: {e}")
            return False
    
    def remove_player_from_session(self, session_id: str) -> Optional[Dict]:
        """
        Remove a player from their current session
        
        Args:
            session_id: WebSocket session ID
            
        Returns:
            Dictionary with game_name and player_name if removed, None otherwise
        """
        try:
            game_name = self.session_to_game.get(session_id)
            if not game_name:
                return None
            
            session = self.active_sessions.get(game_name)
            if not session or session_id not in session.connected_players:
                return None
            
            # Remove player
            connection = session.connected_players.pop(session_id)
            del self.session_to_game[session_id]
            session.last_activity = datetime.now()
            
            logger.info(f"Player '{connection.player_name}' left game '{game_name}'")
            
            return {
                'game_name': game_name,
                'player_name': connection.player_name,
                'player_id': connection.player_id
            }
            
        except Exception as e:
            logger.error(f"Error removing player from session: {e}")
            return None
    
    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """
        Get session information for a specific session ID
        
        Args:
            session_id: WebSocket session ID
            
        Returns:
            Session information or None if not found
        """
        try:
            game_name = self.session_to_game.get(session_id)
            if not game_name:
                return None
            
            session = self.active_sessions.get(game_name)
            if not session:
                return None
            
            # Check if this is the host
            is_host = session_id == session.host_session_id
            
            # Get player info if not host
            player_info = None
            if not is_host and session_id in session.connected_players:
                conn = session.connected_players[session_id]
                player_info = {
                    'player_id': conn.player_id,
                    'player_name': conn.player_name,
                    'joined_at': conn.joined_at.isoformat()
                }
            
            return {
                'game_name': game_name,
                'is_host': is_host,
                'player_info': player_info,
                'session_info': asdict(session) if is_host else None
            }
            
        except Exception as e:
            logger.error(f"Error getting session info: {e}")
            return None
    
    def cleanup_disconnected_sessions(self, connected_session_ids: Set[str]):
        """
        Remove sessions that are no longer connected
        
        Args:
            connected_session_ids: Set of currently connected session IDs
        """
        try:
            sessions_to_remove = []
            
            # Find disconnected sessions
            for session_id in list(self.session_to_game.keys()):
                if session_id not in connected_session_ids:
                    sessions_to_remove.append(session_id)
            
            # Remove disconnected sessions
            for session_id in sessions_to_remove:
                game_name = self.session_to_game.get(session_id)
                if game_name:
                    session = self.active_sessions.get(game_name)
                    if session:
                        if session_id == session.host_session_id:
                            # Host disconnected, remove entire session
                            self.stop_hosting_session(session_id)
                        else:
                            # Player disconnected, remove just the player
                            self.remove_player_from_session(session_id)
            
        except Exception as e:
            logger.error(f"Error cleaning up disconnected sessions: {e}")

# Global session manager instance
session_manager = SessionManager()
