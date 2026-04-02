# Spotify Song & Playlist Recommendation Engine

## 📺 Demo Video

<div align="center">
  <a href="https://www.youtube.com/watch?v=_sonBs3rjo4">
    <img src="https://img.youtube.com/vi/_sonBs3rjo4/maxresdefault.jpg" alt="Spotify recommendation engine demo video" style="border-radius: 10px;">
    <p><b>Click to watch the full project walkthrough and demonstration</b></p>
  </a>
</div>

A powerful, incredibly fast MERN stack application built to provide Spotify song recommendations based on word2vec embeddings. This project was developed to satisfy the NoSQL and MongoDB requirements for Big Data Analysis.

## Core Architectural Decision

The complete dataset (songs + embeddings) contains 2.2 million records (1 GB total size), which completely exceeds the 512 MB limit of the MongoDB Atlas Free cluster. Because the `$vectorSearch` feature is exclusively an Atlas capability, this application intelligently bypasses the cloud limitation by using **Local MongoDB combined with High-Speed In-Memory Computation.**

1. All 2.2 million song metadata references and embeddings are loaded into a standard Local MongoDB database.
2. The Node.js Backend handles the NoSQL retrieval and uses memory-safe Float32 typed arrays to instantly compute Cosine Similarities (Dot Products) against 2.2 million items in less than ~50ms.
3. We fetch final resulting objects from MongoDB using `$in` matching.

## Setup Instructions

### Prerequisites
* You must have **Node.js** installed locally.
* You must have **MongoDB database server** running locally via default port (`mongodb://127.0.0.1:27017`).

### 1. Preparing the Data
Ensure both `meta_word2vec_2M.tsv` and `emb_word2vec_2M.tsv` are downloaded and placed into the `/data` folder located at the root of this project.

### 2. Ingesting into MongoDB
*Open a terminal:*
```bash
cd backend
npm install
node importData.js
```
*Note: Due to the size of the dataset (2.2 Million documents), inserting the data will take 10-15 minutes depending on your computer's SSD speed. Please let it finish. It will automatically build the necessary NoSQL Text Indexes upon completion.*

### 3. Running the Backend Server
*Open a terminal:*
```bash
cd backend
npm install
npm start
```
*Note: Upon startup, the backend server will execute an aggressive `collection.find()` to load the 2.2M vectors into memory cache. This process takes ~10-15 seconds. Once it says "Backend initialization exactly finished", the server is fully ready to generate predictions!*

### 4. Running the Frontend App
*Open a new terminal:*
```bash
cd frontend
npm install
npm run dev
```
Open the provided `localhost` link in your browser to experience a sleek dark-themed Spotify frontend where you can add songs to your playlist and retrieve 500 immediate high-accuracy nearest-neighbor recommendations.
