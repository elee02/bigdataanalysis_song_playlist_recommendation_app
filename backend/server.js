const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const URL = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'spotify_recommendations';
const COLLECTION_NAME = 'songs';

let db;
let collection;
let totalItems = 0;
let vectorsBuffer = null;
let initialized = false;

async function init() {
  console.log(`Connecting to MongoDB at ${URL}...`);
  const client = new MongoClient(URL);
  await client.connect();
  db = client.db(DB_NAME);
  collection = db.collection(COLLECTION_NAME);
  
  totalItems = await collection.countDocuments();
  if (totalItems === 0) {
      console.warn("WARNING: Database is empty. Please run importData.js first.");
      return;
  }
  
  console.log(`Database has ${totalItems} songs. Loading vectors into high-speed memory footprint...`);
  
  // Allocate typed array for max performance (Float32 is 4 bytes. 2M * 32 * 4 ~= 256MB)
  vectorsBuffer = new Float32Array(totalItems * 32);
  
  const cursor = collection.find({}, { projection: { _id: 1, embedding: 1 } });
  
  let loaded = 0;
  for await (const doc of cursor) {
    const id = doc._id; 
    const baseIndex = id * 32;
    for (let i = 0; i < 32; i++) {
        vectorsBuffer[baseIndex + i] = doc.embedding[i];
    }
    loaded++;
    if (loaded % 100000 === 0) {
        process.stdout.write(`\rLoaded ${loaded} vectors into memory...`);
    }
  }
  process.stdout.write(`\rSuccessfully loaded all ${totalItems} vectors into Float32Array.\n`);
  
  initialized = true;
  console.log("\nBackend initialization exactly finished! Server is ready.");
}

// Endpoint to Search for songs to add to Playlist
app.get('/api/songs/search', async (req, res) => {
    if (!initialized) return res.status(503).json({ error: "System warming up, vectors loading into memory." });
    
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: "Missing query" });
    
    try {
        const results = await collection.find(
            { $text: { $search: query } },
            { projection: { score: { $meta: "textScore" }, embedding: 0 } }
        )
        .sort({ score: { $meta: "textScore" } })
        .limit(20)
        .toArray();
        
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Search failed." });
    }
})

// Endpoint to Get Recommendations based on Playlist
app.post('/api/recommend', async (req, res) => {
    if (!initialized) return res.status(503).json({ error: "System warming up..." });
    
    const { playlist } = req.body; // Array of song objects with _id
    if (!playlist || playlist.length === 0) {
        return res.status(400).json({ error: "Empty playlist" });
    }
    
    // 1. Calculate Average Vector of Playlist
    const queryVector = new Float32Array(32);
    for (const song of playlist) {
        const id = song._id;
        const baseIndex = id * 32;
        for (let i = 0; i < 32; i++) {
            queryVector[i] += vectorsBuffer[baseIndex + i];
        }
    }
    const len = playlist.length;
    for(let i=0; i<32; i++) queryVector[i] /= len;
    
    // Magnitude of Query Vector
    let magA = 0;
    for (let i=0; i<32; i++) magA += queryVector[i] * queryVector[i];
    magA = Math.sqrt(magA);
    
    // 2. Perform extreme high-speed Cosine Similarity over total dataset without Garbage Collection lags
    const K = 500;
    const topScores = new Float32Array(K).fill(-Infinity);
    const topIds = new Int32Array(K).fill(-1);
    
    // Quick helper to insert into sorted array
    function insertTop(id, score) {
        if (score <= topScores[K - 1]) return; // Optimization to skip
        let i = K - 2;
        while(i >= 0 && score > topScores[i]) {
            topScores[i+1] = topScores[i];
            topIds[i+1] = topIds[i];
            i--;
        }
        topScores[i+1] = score;
        topIds[i+1] = id;
    }
    
    // Create Set of playlist IDs to skip
    const skipIds = new Set(playlist.map(s => s._id));
    
    for (let id = 0; id < totalItems; id++) {
        if (skipIds.has(id)) continue; 
        
        const baseIndex = id * 32;
        let dot = 0;
        let magB = 0;
        for (let i=0; i<32; i++) {
            const valB = vectorsBuffer[baseIndex + i];
            dot += queryVector[i] * valB;
            magB += valB * valB;
        }
        
        const sim = (magA === 0 || magB === 0) ? 0 : dot / (magA * Math.sqrt(magB));
        insertTop(id, sim);
    }
    
    // 3. Fetch matched details from MongoDB
    const validTopIds = Array.from(topIds).filter(id => id !== -1);
    
    const matchedDocs = await collection.find(
        { _id: { $in: validTopIds } }, 
        { projection: { embedding: 0 } }
    ).toArray();
    
    // Re-order docs based on the array scores (since $in doesn't retain order)
    const docsWithScores = matchedDocs.map(doc => {
        const rankIndex = topIds.indexOf(doc._id);
        return {
            ...doc,
            similarity: topScores[rankIndex]
        };
    }).sort((a, b) => b.similarity - a.similarity);
    
    res.json(docsWithScores);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    init().catch(console.error);
});
