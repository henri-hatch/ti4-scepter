# Scepter Server

Backend server for the TI4 Scepter application built with Flask and SQLite.

## Features

- **Game Management**: Create and list TI4 games
- **SQLite Database**: Each game stored in its own SQLite database
- **RESTful API**: Clean API endpoints for frontend integration
- **Technology & Planets**: Catalog seeding, validation, and player inventories
- **Error Handling**: Comprehensive error handling and logging
- **Configuration**: Environment-based configuration system

## Project Structure

```
scepter-server/
├── main.py              # Main Flask application
├── config.py            # Configuration settings
├── requirements.txt     # Python dependencies
├── components/
│   ├── database.py           # Database utilities and connection management
│   ├── planet_catalog.py     # Planet seeding helpers
│   ├── technology_catalog.py # Technology seeding helpers
│   ├── action_catalog.py     # Action card seeding helpers
│   └── exploration_catalog.py # Exploration card utilities
├── data/
│   ├── planets.json       # Base planet catalog used when creating games
│   ├── technology.json    # Base technology catalog used when creating games
│   ├── actions.json       # Action card catalog
│   └── exploration.json   # Exploration card catalog
├── routes/
│   ├── games.py         # Game-related routes and logic
│   ├── planets.py       # Planet inventory endpoints
│   ├── technology.py    # Technology inventory endpoints
│   └── cards.py         # Action and exploration endpoints
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

### Players
- **GET** `/api/game/<game_name>/player/<player_id>` - Returns the player's profile including faction and track totals.

### Planets
- **GET** `/api/planets/catalog` - Returns the base planet catalog seeded into new games.
- **GET** `/api/game/<game_name>/planets/definitions` - Lists planet definitions stored in the selected game database.
- **GET** `/api/game/<game_name>/player/<player_id>/planets` - Fetches the planets assigned to the given player.
- **POST** `/api/game/<game_name>/player/<player_id>/planets` - Adds a catalog planet to the player's inventory.
- **PATCH** `/api/game/<game_name>/player/<player_id>/planets/<planet_key>` - Updates whether a planet is exhausted (card flipped).
- **DELETE** `/api/game/<game_name>/player/<player_id>/planets/<planet_key>` - Removes a planet from the player's inventory.

### Technology
- **GET** `/api/technology/catalog` - Returns the base technology catalog with faction metadata.
- **GET** `/api/game/<game_name>/player/<player_id>/technology/definitions` - Lists catalog technology available to the player (faction-aware).
- **GET** `/api/game/<game_name>/player/<player_id>/technology` - Fetches the technology assigned to the player.
- **POST** `/api/game/<game_name>/player/<player_id>/technology` - Adds a technology card to the player's inventory after validation.
- **PATCH** `/api/game/<game_name>/player/<player_id>/technology/<technology_key>` - Updates whether a technology card is exhausted.
- **DELETE** `/api/game/<game_name>/player/<player_id>/technology/<technology_key>` - Removes a technology card from the player's inventory.

### Action Cards
- **GET** `/api/actions/catalog` - Returns the global action card catalog.
- **GET** `/api/game/<game_name>/player/<player_id>/actions` - Lists action cards owned by the player.
- **GET** `/api/game/<game_name>/player/<player_id>/actions/definitions` - Definitions not yet owned by the player.
- **POST** `/api/game/<game_name>/player/<player_id>/actions` - Assigns an action card by key.
- **PATCH** `/api/game/<game_name>/player/<player_id>/actions/<action_key>` - Toggles exhausted state.
- **DELETE** `/api/game/<game_name>/player/<player_id>/actions/<action_key>` - Removes the action card.
- **POST** `/api/game/<game_name>/player/<player_id>/actions/draw` - Returns a random unowned action card.

### Exploration & Attachments
- **GET** `/api/exploration/catalog` - Returns the exploration catalog.
- **GET** `/api/game/<game_name>/player/<player_id>/exploration` - Lists non-attachment exploration cards owned by the player.
- **GET** `/api/game/<game_name>/player/<player_id>/exploration/definitions` - Available exploration definitions filtered by subtype.
- **POST** `/api/game/<game_name>/player/<player_id>/exploration` - Adds an exploration card to the player's inventory.
- **PATCH** `/api/game/<game_name>/player/<player_id>/exploration/<exploration_key>` - Toggles exhausted state for exploration actions.
- **DELETE** `/api/game/<game_name>/player/<player_id>/exploration/<exploration_key>` - Removes the exploration card.
- **POST** `/api/game/<game_name>/player/<player_id>/planets/<planet_key>/explore` - Resolves an exploration draw for the planet type.
- **POST** `/api/game/<game_name>/player/<player_id>/planets/<planet_key>/attachments` - Attaches an exploration card to the planet.
- **DELETE** `/api/game/<game_name>/player/<player_id>/planets/<planet_key>/attachments/<exploration_key>` - Removes the attachment.
- **GET** `/api/game/<game_name>/player/<player_id>/attachments` - Lists attachments grouped by planet (optional filter via `planetKeys`).

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

### `planetDefinitions` table
- `planetKey` - Catalog key for lookup
- `name` - Display name
- `type` - Planet type (Cultural/Hazardous/Industrial)
- `techSpecialty` - Optional tech specialty string
- `resources` - Resource value
- `influence` - Influence value
- `legendary` - Boolean stored as 0/1
- `assetFront` / `assetBack` - Relative image paths

### `playerPlanets` table
- `id` - Auto-incrementing primary key
- `playerId` - Owning player reference
- `planetKey` - Planet assigned to the player
- `isExhausted` - Boolean stored as 0/1
- `acquiredAt` - Timestamp of assignment

### `technologyDefinitions` table
- `technologyKey` - Catalog key for lookup
- `name` - Display name
- `type` - Discipline (Biotic/Propulsion/Cybernetic/Warfare)
- `faction` - Owning faction or `none`
- `tier` - Tier index 0-3
- `asset` - Relative image path

### `playerTechnologies` table
- `id` - Auto-incrementing primary key
- `playerId` - Owning player reference
- `technologyKey` - Technology assigned to the player
- `isExhausted` - Boolean stored as 0/1
- `acquiredAt` - Timestamp of assignment

### `actionDefinitions` table
- `actionKey` - Catalog key for lookup
- `name` - Display name
- `asset` - Relative image path

### `playerActions` table
- `id` - Auto-incrementing primary key
- `playerId` - Owning player reference
- `actionKey` - Action card assigned to the player
- `isExhausted` - Boolean stored as 0/1
- `acquiredAt` - Timestamp of assignment

### `explorationDefinitions` table
- `explorationKey` - Catalog key for lookup
- `name` - Display name
- `type` - Planet type the card applies to
- `subtype` - `attach`, `action`, or `relic_fragment`
- `asset` - Relative image path

### `playerExplorationCards` table
- `id` - Auto-incrementing primary key
- `playerId` - Owning player reference
- `explorationKey` - Exploration card assigned to the player
- `isExhausted` - Boolean stored as 0/1
- `acquiredAt` - Timestamp of assignment

### `planetAttachments` table
- `id` - Auto-incrementing primary key
- `playerId` - Owning player reference
- `planetKey` - Planet receiving the attachment
- `explorationKey` - Attached exploration card key
- `attachedAt` - Timestamp of attachment

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
