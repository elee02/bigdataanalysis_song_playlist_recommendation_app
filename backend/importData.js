const fs = require('fs');
const readline = require('readline');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config();

const URL = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'spotify_recommendations';
const COLLECTION_NAME = 'songs';

async function importData() {
  console.log(`Connecting to MongoDB at ${URL}...`);
  const client = new MongoClient(URL);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);
  
  console.log("Clearing existing collection...");
  await collection.deleteMany({});
  
  const metaStream = fs.createReadStream(path.join(__dirname, '../data/meta_word2vec_2M.tsv'), { encoding: 'utf8' });
  const embStream = fs.createReadStream(path.join(__dirname, '../data/emb_word2vec_2M.tsv'), { encoding: 'utf8' });

  const rlMeta = readline.createInterface({ input: metaStream, crlfDelay: Infinity });
  const rlEmb = readline.createInterface({ input: embStream, crlfDelay: Infinity });

  const metaIterator = rlMeta[Symbol.asyncIterator]();
  const embIterator = rlEmb[Symbol.asyncIterator]();

  let batch = [];
  let count = 0;
  console.log("Starting data ingestion process...");

  while (true) {
    const metaLine = await metaIterator.next();
    const embLine = await embIterator.next();

    if (metaLine.done || embLine.done) {
      break;
    }

    const metaStr = metaLine.value.trim();
    if (!metaStr) continue;

    // "Title- Artist" format
    const parts = metaStr.split('- ');
    let artist = 'Unknown';
    let title = metaStr;
    
    if (parts.length >= 2) {
      artist = parts.pop(); // The last part is artist
      title = parts.join('- '); // Reassemble title if it contained dashes
    }

    const embParts = embLine.value.trim().split('\t');
    const embedding = embParts.map(n => parseFloat(n));

    batch.push({
      _id: count,
      title: title,
      artist: artist,
      embedding: embedding
    });

    count++;

    if (batch.length === 5000) {
      await collection.insertMany(batch);
      process.stdout.write(`\rInserted ${count} songs...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await collection.insertMany(batch);
  }
  process.stdout.write(`\rSuccessfully inserted a total of ${count} songs!\n`);

  console.log("Creating text index on title and artist to allow fast frontend searching...");
  await collection.createIndex({ title: "text", artist: "text" });
  
  console.log("Data generation completed successfully!");
  await client.close();
}

importData().catch(console.error);
