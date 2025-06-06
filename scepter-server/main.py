from flask import Flask, send_from_directory, request, jsonify
import sqlite3
import os
import uuid
from datetime import datetime

app = Flask(__name__, static_folder='../scepter-client/dist', static_url_path='/')

# Create games directory if it doesn't exist
GAMES_DIR = 'games'
if not os.path.exists(GAMES_DIR):
    os.makedirs(GAMES_DIR)

def create_database(db_name, players):
    """Create a new game database with the given name and players"""
    db_path = os.path.join(GAMES_DIR, f"{db_name}.sqlite3")
    
    # Check if database already exists
    if os.path.exists(db_path):
        return {"error": "Game with this name already exists"}, 400
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create Player table
    cursor.execute('''
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
    cursor.execute('''
        CREATE TABLE game_metadata (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insert game metadata
    cursor.execute(
        "INSERT INTO game_metadata (name, created_at, last_updated) VALUES (?, ?, ?)",
        (db_name, datetime.now(), datetime.now())
    )
    
    # Insert players
    for player in players:
        player_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO players (playerId, name) VALUES (?, ?)",
            (player_id, player['name'])
        )
    
    conn.commit()
    conn.close()
    
    return {"success": True, "database": db_name}, 200

@app.route('/api/create-game', methods=['POST'])
def create_game():
    """API endpoint to create a new game"""
    data = request.get_json()
    
    if not data or 'gameName' not in data or 'players' not in data:
        return jsonify({"error": "Missing required fields: gameName and players"}), 400
    
    game_name = data['gameName']
    players = data['players']
    
    if not game_name.strip():
        return jsonify({"error": "Game name cannot be empty"}), 400
    
    if len(players) < 1:
        return jsonify({"error": "At least one player is required"}), 400
    
    # Validate players
    for player in players:
        if not player.get('name', '').strip():
            return jsonify({"error": "All players must have a name"}), 400
    
    result, status_code = create_database(game_name, players)
    return jsonify(result), status_code

@app.route('/api/list-games', methods=['GET'])
def list_games():
    """API endpoint to list existing games"""
    games = []
    
    if os.path.exists(GAMES_DIR):
        for filename in os.listdir(GAMES_DIR):
            if filename.endswith('.sqlite3'):
                game_name = filename[:-8]  # Remove .sqlite3 extension
                file_path = os.path.join(GAMES_DIR, filename)
                
                # Get creation time
                created_time = datetime.fromtimestamp(os.path.getctime(file_path))
                
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
    
    return jsonify({'games': games})

@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'index.html')

# Catch-all route for React Router
@app.route('/<path:path>')
def catch_all(path):
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=True)
