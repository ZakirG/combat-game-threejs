# SpacetimeDB Architecture in this Project

This document provides a comprehensive overview of how SpacetimeDB is utilized in this 3D multiplayer game. It covers the server-side implementation, client-side integration, and the overall data flow that enables real-time multiplayer functionality.

## 1. Core Concepts of SpacetimeDB

SpacetimeDB is a real-time database designed for building scalable, stateful applications like multiplayer games. It combines a database, a web server, and a WebAssembly runtime into a single integrated platform. Here's a breakdown of the key concepts used in this project:

- **Tables**: These are Rust structs that define the structure of your data. The `#[spacetimedb::table]` macro is used to mark a struct as a database table. These tables are strongly typed and can be marked as `public` to allow client-side access.
- **Reducers**: These are Rust functions that modify the state of the database. They are the only way to write data to tables. Reducers are transactional, meaning that all changes within a reducer are applied atomically. The `#[spacetimedb::reducer]` macro is used to define a reducer.
- **Subscriptions**: Clients can subscribe to SQL-like queries on the database. When the data matching a query changes, the server automatically pushes the updates to all subscribed clients.
- **Bindings**: SpacetimeDB can automatically generate client-side code (in TypeScript for this project) that provides type-safe access to your tables and reducers. This eliminates the need to write boilerplate code for API calls and data serialization.
- **Identity**: Each connected client has a unique `Identity`, which is used to identify and authenticate the client. This is often used as a primary key in tables to associate data with a specific player.

## 2. Server-Side Implementation (`server/src`)

The server-side logic is written in Rust and is located in the `server/src` directory. It defines the game's schema and the rules for how the game state can be changed.

### 2.1. Database Schema (`lib.rs`)

The database schema is defined in `server/src/lib.rs`. The two main tables are:

- **`PlayerData` (`player` table)**: This table stores the state of all currently connected players. It includes information such as `identity`, `username`, `character_class`, `position`, `rotation`, `health`, `mana`, and the current animation state. The `identity` field is the primary key. This table is marked as `public` so that clients can subscribe to it.

- **`LoggedOutPlayerData` (`logged_out_player` table)**: This table stores the state of players who have disconnected. This allows player data to persist between sessions. When a player reconnects, their data is moved from this table back to the `PlayerData` table.

### 2.2. Reducers (`lib.rs`)

Reducers are the functions that clients call to interact with the game world. Key reducers include:

- **`register_player`**: This reducer is called when a player joins the game. It creates a new entry in the `PlayerData` table for the new player, or moves an existing entry from `LoggedOutPlayerData` if the player is rejoining. It also assigns a random color and an initial spawn position.

- **`update_player_input`**: This is one of the most frequently called reducers. It is called every frame for each client to send their latest input state (e.g., which keys are pressed) to the server. The server then uses this input to update the player's position, rotation, and animation state in the `PlayerData` table. This is the core of the real-time movement system.

- **`identity_connected` / `identity_disconnected`**: These are lifecycle reducers that are automatically called by SpacetimeDB when a client connects or disconnects. The `identity_disconnected` reducer is responsible for moving a player's data from the `player` table to the `logged_out_player` table when they disconnect.

### 2.3. Player Logic (`player_logic.rs`)

To keep the code organized, the logic for updating player state is separated into `server/src/player_logic.rs`. The `update_player_input` reducer calls the `update_input_state` function in this file to perform the actual calculations for the player's new position based on their input and rotation. This helps to keep `lib.rs` focused on the schema and reducer definitions.

## 3. Client-Side Integration (`client/src`)

The client-side application is a React application built with Vite and TypeScript. It uses the auto-generated bindings from SpacetimeDB to interact with the server.

### 3.1. Connection and Authentication (`App.tsx`)

In `client/src/App.tsx`, the application establishes a connection to the SpacetimeDB server. This is done within a `useEffect` hook to ensure it only runs once. Upon a successful connection, the server sends back an `Identity` for the client, which is stored in the React state.

### 3.2. Subscriptions and Data Synchronization (`App.tsx`)

Once connected, the client subscribes to the `player` table using `conn.subscriptionBuilder()`. This tells the server that the client wants to receive all data from the `player` table, as well as any future updates to it.

The client then registers a set of callbacks (`onInsert`, `onUpdate`, `onDelete`) for the `player` table. These callbacks are triggered whenever a player is added, updated, or removed from the table. Inside these callbacks, the React state is updated to reflect the changes from the server. This is how the local game state on the client is kept in sync with the server's state in real-time.

### 3.3. Calling Reducers (`App.tsx`)

To send data to the server, the client calls the reducers that were defined on the server. For example:

- When the player enters their name and clicks "Join Game", the `register_player` reducer is called with the player's chosen username and character class.
- In the main game loop (`requestAnimationFrame`), the client captures the current input state (keyboard and mouse) and calls the `update_player_input` reducer. This sends the player's actions to the server for processing.

The generated bindings provide type-safe functions for calling these reducers (e.g., `conn.reducers.registerPlayer(...)`), which makes the client-server communication less error-prone.

## 4. How it All Works Together for Multiplayer

The combination of these server-side and client-side components creates a robust real-time multiplayer experience:

1.  **Player Joins**: A new client connects, calls `register_player`, and a new player appears in the game world for all connected clients because they are all subscribed to the `player` table.
2.  **Player Moves**: The player presses a movement key. The client's game loop detects this, and calls the `update_player_input` reducer with the new input state. The server receives this, recalculates the player's position, and updates the `PlayerData` table.
3.  **State Synchronization**: Because the `PlayerData` table was updated, SpacetimeDB automatically sends the updated player data to all subscribed clients.
4.  **Remote Player Rendering**: On all other clients, the `onUpdate` callback for the `player` table is triggered. This updates their local React state, which causes the 3D scene to re-render with the remote player in their new position.

This architecture ensures that the server is the single source of truth for the game state, while the clients are responsible for rendering that state and sending input to the server. The use of SpacetimeDB's real-time features and generated bindings greatly simplifies the amount of networking and data synchronization code that needs to be written.

### Asset and Position Handling

- **Player Position**: As described above, the player's position is managed authoritatively by the server. The client sends input, and the server calculates the new position. This prevents cheating (e.g., speed hacks) because the server is in control. The client does perform client-side prediction to make movement feel responsive, but it is always corrected by the server's state.
- **Assets**: Player assets, such as the 3D model for their chosen character class, are determined on the client-side. The `character_class` string stored in the `PlayerData` table is used by the client to decide which 3D model and animations to load and render for that player. The server only needs to know about the character class for potential game logic differences, not for rendering. 