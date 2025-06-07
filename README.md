# Twitter Globe - Global Tweet Activity Visualization

![Twitter Globe](https://github.com/user/twitter-globe/raw/main/screenshot.png)

## Overview

Twitter Globe is an interactive 3D visualization that displays real-time Twitter activity from around the world. This beautiful WebGL-powered globe shows tweets as they happen, with special highlighting for trending topics and hashtags. The visualization creates an immersive experience that demonstrates the global reach and real-time nature of social media conversations.

## Features

- **Real-time Tweet Visualization**: See tweets appear on the globe as they happen
- **Interactive 3D Globe**: Rotate, zoom, and explore the visualization with intuitive mouse and touch controls
- **Data Filtering**: Toggle between different data views (all tweets, trending tweets, hashtags)
- **Detailed Information**: Hover over tweet markers to see the content, username, location, and timestamp
- **Customizable Display**: Adjust animation speed and visual intensity
- **Responsive Design**: Works on desktop and mobile devices
- **Beautiful Visual Effects**: Includes atmospheric glow, particle star field, and animated tweet markers
- **Live Statistics**: Track total tweets, active users, hashtags, countries, and tweets per minute

## Installation

### Prerequisites

- Node.js (v12 or higher)
- npm (v6 or higher)

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/twitter-globe.git
   cd twitter-globe
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. (Optional) Configure Twitter API:
   - Create a `.env` file in the project root
   - Add your Twitter API bearer token:
     ```
     TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here
     ```
   - If no token is provided, the application will use simulated tweet data

4. Start the server:
   ```
   node server.js
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### Controls

- **Rotate**: Click and drag to rotate the globe
- **Zoom**: Use the mouse wheel to zoom in and out
- **View Information**: Hover over tweet markers to see details

### Settings Panel

- **Activity Intensity**: Adjust the visual intensity of tweet markers
- **Animation Speed**: Control the speed of all animations
- **View Mode**: Switch between globe and satellite views
- **Data Layer**: Toggle between tweets, hashtags, and users views
- **Tweet Categories**: Filter between all tweets and trending tweets

## How It Works

The application consists of two main components:

### Backend (server.js)

- Creates an HTTP server to serve the web application
- Establishes a WebSocket server for real-time communication
- Connects to the Twitter API's filtered stream endpoint to get tweets with geo information
- Processes tweet data and sends it to connected clients
- Falls back to simulated tweets if no Twitter API token is provided

### Frontend (index.html)

- Renders a 3D globe using Three.js
- Connects to the WebSocket server to receive tweet data
- Visualizes tweets as animated markers on the globe
- Provides interactive controls for exploring the visualization
- Displays statistics and detailed information about tweets

## Technologies Used

- **Three.js**: 3D rendering library for creating the globe and visual effects
- **WebSockets**: For real-time communication between server and client
- **Node.js**: Server-side JavaScript runtime
- **Twitter API v2**: For accessing real-time tweet data
- **TopoJSON**: For rendering continent outlines on the globe

## Customization

You can customize various aspects of the visualization:

- Modify the visual appearance by editing the CSS styles
- Adjust the globe parameters in the `createGlobe()` method
- Change the simulated tweet data in the `generateRandomTweet()` function
- Add additional data layers or visualization modes

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Made By Ahmad Technology
- Three.js for the powerful 3D rendering capabilities
- Twitter for providing the API to access tweet data

---

Enjoy exploring the Twitter Globe! If you have any questions or suggestions, please open an issue or submit a pull request.