from flask import Flask, send_from_directory, request, jsonify
import sqlite3
import os
from datetime import datetime

from routes.games import create_game_file, list_games

app = Flask(__name__, static_folder='../scepter-client/dist', static_url_path='/')

GAMES_DIR = 'games'
if not os.path.exists(GAMES_DIR):
    os.makedirs(GAMES_DIR)

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
    
    result, status_code = create_game_file(game_name, players, GAMES_DIR)
    return jsonify(result), status_code

@app.route('/api/list-games', methods=['GET'])
def list_all_games():
    """API endpoint to list existing games"""
    games = list_games(GAMES_DIR)
    return jsonify(games), 200

@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'index.html')

# Catch-all route for React Router
@app.route('/<path:path>')
def catch_all(path):
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=True)
