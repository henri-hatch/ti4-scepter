# Scepter Server

Backend server for the TI4 Scepter application built with Flask and SQLite.

## Features

- **Game Management**: Create and list TI4 games
- **SQLite Database**: Each game stored in its own SQLite database
- **RESTful API**: Clean API endpoints for frontend integration
- **Error Handling**: Comprehensive error handling and logging
- **Configuration**: Environment-based configuration system

## Project Structure

```
scepter-server/
├── main.py              # Main Flask application
├── config.py            # Configuration settings
├── requirements.txt     # Python dependencies
├── components/
│   └── database.py      # Database utilities and connection management
├── routes/
│   └── games.py         # Game-related routes and logic
└── games/              # Directory for game database files
```

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python main.py
```

The server will start on `http://localhost:5000` by default.

## API Endpoints

### Health Check
- **GET** `/api/health` - Server health status

### Games
- **POST** `/api/create-game` - Create a new game
- **GET** `/api/list-games` - List all existing games

### Static Files
- **GET** `/` - Serve React application
- **GET** `/<path>` - Serve static files or React routing

## Configuration

The server uses environment-based configuration:

- `FLASK_ENV=development` (default) - Development mode with debug enabled
- `FLASK_ENV=production` - Production mode with debug disabled

## Database Schema

Each game database contains:

### `players` table
- `id` - Auto-incrementing primary key
- `playerId` - Unique player identifier (UUID)
- `name` - Player name
- `resources` - Resource count (default: 0)
- `influence` - Influence count (default: 0)
- `commodities` - Commodity count (default: 0)
- `trade_goods` - Trade goods count (default: 0)
- `victoryPoints` - Victory points (default: 0)
- `faction` - Player's faction (optional)

### `game_metadata` table
- `id` - Primary key
- `name` - Game name
- `created_at` - Creation timestamp
- `last_updated` - Last update timestamp

## Error Handling

The server includes comprehensive error handling:
- Input validation for all API endpoints
- Database operation error handling
- Proper HTTP status codes
- Detailed logging for debugging

## Logging

Structured logging is configured with:
- Timestamp
- Logger name
- Log level
- Message

Log levels can be configured via the `LOG_LEVEL` setting in config.py.
