require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  // Serve index.html for root requests
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    // For other requests, try to serve files from the directory
    fs.readFile(path.join(__dirname, req.url), (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('File not found');
        return;
      }
      
      // Set content type based on file extension
      const ext = path.extname(req.url);
      let contentType = 'text/plain';
      
      switch (ext) {
        case '.html':
          contentType = 'text/html';
          break;
        case '.css':
          contentType = 'text/css';
          break;
        case '.js':
          contentType = 'text/javascript';
          break;
        case '.json':
          contentType = 'application/json';
          break;
        case '.png':
          contentType = 'image/png';
          break;
        case '.jpg':
        case '.jpeg':
          contentType = 'image/jpeg';
          break;
      }
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

const PORT = 3000;

// Initialize Twitter client with bearer token
const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
// Get a read-only client
const readOnlyClient = twitterClient.readOnly;

console.log('Twitter API initialized with bearer token');


wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send a welcome message
  ws.send(JSON.stringify({
    type: 'info',
    message: 'Connected to WebSocket server'
  }));
  
  // Start streaming real tweets
  startTwitterStream(ws);
});

// Function to start Twitter stream
async function startTwitterStream(ws) {
  try {
    // Check if we have a valid bearer token
    if (!process.env.TWITTER_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN.trim() === '') {
      console.log('No Twitter bearer token found in .env file. Using simulated tweets.');
      startSendingSimulatedTweets(ws);
      return;
    }
    
    // Log the bearer token (partially masked for security)
    const maskedToken = process.env.TWITTER_BEARER_TOKEN.substring(0, 10) + '...' + 
                        process.env.TWITTER_BEARER_TOKEN.substring(process.env.TWITTER_BEARER_TOKEN.length - 10);
    console.log(`Using Twitter bearer token: ${maskedToken}`);
    console.log('Attempting to connect to Twitter API...');
    
    try {
      console.log('Setting up Twitter stream rules...');
      
      // First, get and delete any existing rules
      const rules = await readOnlyClient.v2.streamRules();
      if (rules.data && rules.data.length > 0) {
        await readOnlyClient.v2.updateStreamRules({
          delete: { ids: rules.data.map(rule => rule.id) }
        });
      }
      
      // Add rules to filter tweets with geo information
      await readOnlyClient.v2.updateStreamRules({
        add: [
          { value: 'has:geo -is:retweet', tag: 'geo-tweets' }
        ]
      });
      
      console.log('Starting Twitter stream...');
      
      // Start the filtered stream with expansions to get geo data
      const stream = await readOnlyClient.v2.searchStream({
        expansions: ['geo.place_id', 'author_id'],
        'place.fields': ['contained_within', 'country', 'country_code', 'full_name', 'geo', 'id', 'name', 'place_type'],
        'user.fields': ['username', 'name'],
        'tweet.fields': ['created_at', 'entities', 'geo', 'text']
      });
      
      // Handle stream events
      stream.on('data', async (tweetData) => {
        try {
          if (ws.readyState !== WebSocket.OPEN) {
            return;
          }
          
          // Process the tweet data
          const processedTweet = processTweetData(tweetData);
          if (processedTweet) {
            console.log('Sending tweet:', processedTweet.text);
            ws.send(JSON.stringify(processedTweet));
          }
        } catch (error) {
          console.error('Error processing tweet:', error);
        }
      });
      
      stream.on('error', (error) => {
        console.error('Stream error:', error);
        // If we can't get real tweets, fall back to simulated tweets
        console.log('Falling back to simulated tweets...');
        startSendingSimulatedTweets(ws);
      });
      
      // Handle WebSocket close
      ws.on('close', () => {
        console.log('Client disconnected, closing stream');
        stream.close();
      });
    } catch (error) {
      console.error('Twitter API Error:', error.message);
      if (error.code === 403) {
        console.log('Access to Twitter API is forbidden. Your account may not have the appropriate level of API access.');
        console.log('The filtered stream endpoint requires at least Pro access level in your Twitter developer account.');
        console.log('Please check your Twitter developer account and ensure you have access to the filtered stream endpoint.');
        console.log('For more information, visit: https://developer.twitter.com/en/docs/twitter-api/tweets/filtered-stream/introduction');
      }
      // Fall back to simulated tweets
      console.log('Falling back to simulated tweets...');
      startSendingSimulatedTweets(ws);
    }
  } catch (error) {
    console.error('Error setting up Twitter stream:', error);
    // Fall back to simulated tweets if we can't set up the stream
    console.log('Falling back to simulated tweets...');
    startSendingSimulatedTweets(ws);
  }
}

// Function to process tweet data and extract geo information
function processTweetData(tweetData) {
  try {
    // Check if we have the necessary data
    if (!tweetData.data || !tweetData.includes) {
      return null;
    }
    
    const tweet = tweetData.data;
    const places = tweetData.includes.places;
    const users = tweetData.includes.users;
    
    // Skip if no geo data
    if (!places || places.length === 0) {
      return null;
    }
    
    const place = places[0];
    const user = users ? users.find(u => u.id === tweet.author_id) : null;
    
    // Extract coordinates from place
    let lat, lon;
    
    if (place.geo && place.geo.bbox) {
      // Calculate center point of bounding box
      const bbox = place.geo.bbox;
      lon = (bbox[0] + bbox[2]) / 2;
      lat = (bbox[1] + bbox[3]) / 2;
    } else {
      // If no precise coordinates, skip this tweet
      return null;
    }
    
    // Extract hashtags for trending detection
    const hashtags = tweet.entities && tweet.entities.hashtags 
      ? tweet.entities.hashtags.map(tag => tag.tag) 
      : [];
    
    // Consider a tweet trending if it has hashtags
    const trending = hashtags.length > 0;
    
    return {
      type: 'tweet',
      lat,
      lon,
      text: tweet.text,
      username: user ? `@${user.username}` : 'unknown',
      trending,
      hashtags,
      place: place.full_name,
      country: place.country,
      timestamp: tweet.created_at || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error processing tweet data:', error);
    return null;
  }
}

// Function to generate random tweets with geo coordinates (fallback)
function generateRandomTweet() {
    // Generate random latitude and longitude
    const lat = (Math.random() * 180) - 90; // -90 to 90
    const lon = (Math.random() * 360) - 180; // -180 to 180
    
    // Sample tweet texts
    const tweetTexts = [
        "Just posted a new blog about JavaScript performance optimization! #JavaScript #WebDev",
        "Loving the new features in the latest React update! #ReactJS #Frontend",
        "Working on a cool new project with Node.js and WebSockets! #NodeJS #RealTime",
        "Machine learning is fascinating! Just completed my first TensorFlow model. #ML #AI",
        "Docker containers make deployment so much easier! #DevOps #Docker",
        "Just pushed my latest project to GitHub! Check it out! #OpenSource #Coding",
        "Learning TypeScript today. Types are actually pretty nice! #TypeScript #JavaScript",
        "Cloud computing has revolutionized how we build applications! #AWS #Cloud",
        "Debugging this CSS issue for hours... #WebDev #CSSProblems",
        "Just deployed my first serverless function! #Serverless #CloudComputing"
    ];
    
    // Sample usernames
    const usernames = [
        "@devguru",
        "@codemaster",
        "@techexplorer",
        "@webwizard",
        "@datascientist",
        "@cloudarchitect",
        "@uxdesigner",
        "@mobiledeveloper",
        "@securityexpert",
        "@airesearcher"
    ];
    
    // Select a random tweet text and username
    const text = tweetTexts[Math.floor(Math.random() * tweetTexts.length)];
    const username = usernames[Math.floor(Math.random() * usernames.length)];
    
    // Extract hashtags from text
    const hashtagRegex = /#(\w+)/g;
    const hashtagMatches = text.match(hashtagRegex) || [];
    const hashtags = hashtagMatches.map(tag => tag.substring(1));
    
    // Randomly mark some tweets as trending (about 20%)
    const trending = Math.random() < 0.2 || hashtags.length > 0;
    
    return {
        type: 'tweet',
        lat,
        lon,
        text,
        username,
        trending,
        hashtags,
        place: getRandomPlace(),
        country: getRandomCountry(),
        timestamp: new Date().toISOString()
    };
}

// Helper function to get random place name
function getRandomPlace() {
    const places = [
        "New York, NY",
        "San Francisco, CA",
        "London, UK",
        "Tokyo, Japan",
        "Sydney, Australia",
        "Berlin, Germany",
        "Paris, France",
        "Toronto, Canada",
        "Mumbai, India",
        "Rio de Janeiro, Brazil"
    ];
    return places[Math.floor(Math.random() * places.length)];
}

// Helper function to get random country
function getRandomCountry() {
    const countries = [
        "United States",
        "United Kingdom",
        "Japan",
        "Australia",
        "Germany",
        "France",
        "Canada",
        "India",
        "Brazil",
        "South Korea"
    ];
    return countries[Math.floor(Math.random() * countries.length)];
}

// Function to start sending simulated tweets (fallback)
function startSendingSimulatedTweets(ws) {
  // Send a tweet immediately
  sendSimulatedTweet(ws);
  
  // Then send tweets at random intervals
  function scheduleNextTweet() {
    // Random interval between 2-10 seconds
    const interval = 2000 + Math.random() * 8000;
    setTimeout(() => {
      sendSimulatedTweet(ws);
      // Schedule the next tweet if the connection is still open
      if (ws.readyState === WebSocket.OPEN) {
        scheduleNextTweet();
      }
    }, interval);
  }
  
  scheduleNextTweet();
}

// Function to send a simulated tweet (fallback)
function sendSimulatedTweet(ws) {
  if (ws.readyState === WebSocket.OPEN) {
    const tweet = generateRandomTweet();
    console.log('Sending simulated tweet:', tweet);
    ws.send(JSON.stringify(tweet));
  }
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});