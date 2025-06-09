import os
import datetime
import uuid
import sqlite3

from components.database import execute_query

def create_game_file(game_name, players, GAMES_DIR='games'):
    """Create a new game database with the given name and players"""
    db_path = os.path.join(GAMES_DIR, f"{game_name}.sqlite3")
    
    # Check if database already exists
    if os.path.exists(db_path):
        return {"error": "Game with this name already exists"}, 400
    
    # Create Player table
    execute_query(db_path, '''
        CREATE TABLE players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playerId TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            resources INTEGER DEFAULT 0,
            influence INTEGER DEFAULT 0,
            commodities INTEGER DEFAULT 0,
            trade_goods INTEGER DEFAULT 0,
            victoryPoints INTEGER DEFAULT 0,
            faction TEXT
        )
    ''')

    # Create Game metadata table
    execute_query(db_path, '''
        CREATE TABLE game_metadata (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insert game metadata
    execute_query(db_path, "INSERT INTO game_metadata (name, created_at, last_updated) VALUES (?, ?, ?)", (game_name, datetime.datetime.now(), datetime.datetime.now()))
    
    # Insert players
    for player in players:
        player_id = str(uuid.uuid4())
        execute_query(db_path, "INSERT INTO players (playerId, name) VALUES (?, ?)", (player_id, player['name']))
    
    return {"success": True, "database": game_name}, 200

def list_games(GAMES_DIR='games'):
    """List all games in the specified directory"""
    games = []
    
    if os.path.exists(GAMES_DIR):
        for filename in os.listdir(GAMES_DIR):
            if filename.endswith('.sqlite3'):
                game_name = filename[:-8]  # Remove .sqlite3 extension
                file_path = os.path.join(GAMES_DIR, filename)
                
                # Get creation time
                created_time = datetime.datetime.fromtimestamp(os.path.getctime(file_path))
                
                # Try to get game metadata from database
                try:
                    conn = sqlite3.connect(file_path)
                    cursor = conn.cursor()
                    cursor.execute("SELECT last_updated FROM game_metadata WHERE id = 1")
                    result = cursor.fetchone()
                    last_updated = result[0] if result else created_time.isoformat()
                    conn.close()
                except:
                    last_updated = created_time.isoformat()
                
                games.append({
                    'name': game_name,
                    'created': created_time.isoformat(),
                    'lastUpdated': last_updated
                })
    
    return {'games': games}