import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [playlist, setPlaylist] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [isRecommending, setIsRecommending] = useState(false);

  // Fallback initial search
  useEffect(() => {
    handleSearch('rock'); // default search to populate some data
  }, []);

  const handleSearch = async (query) => {
    if (!query) return;
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/songs/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  const addToPlaylist = (song) => {
    if (!playlist.find(s => s._id === song._id)) {
      setPlaylist([...playlist, song]);
    }
  };

  const removeFromPlaylist = (songId) => {
    setPlaylist(playlist.filter(s => s._id !== songId));
  };

  const getRecommendations = async () => {
    if (playlist.length === 0) return;
    
    setIsRecommending(true);
    try {
      const res = await fetch(`${API_BASE}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlist })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecommendations(data);
    } catch (err) {
      console.error(err);
      alert('Failed to get recommendations. Ensure backend is running and warmed up.');
    } finally {
      setIsRecommending(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Spotify <span className="green">Recommender</span></h1>
      </header>

      <div className="main-content">
        
        {/* Left Panel: Search & Playlist */}
        <div className="panel">
          <div className="panel-header">
            <h2>Create your playlist</h2>
          </div>
          
          <form onSubmit={onSearchSubmit}>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search for songs..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </form>

          {/* Search Results */}
          <div className="scrollable-list" style={{ flex: '1 1 0px', minHeight: 0, marginBottom: '1rem', borderBottom: '1px solid #282828' }}>
            {isSearching ? <div className="loader"></div> : searchResults.map(song => (
              <div key={`search-${song._id}`} className="song-item" onClick={() => addToPlaylist(song)}>
                <div className="song-info">
                  <span className="song-title">{song.title}</span>
                  <span className="song-artist">{song.artist}</span>
                </div>
                <button className="btn" style={{ fontSize: '1.2rem', color: 'var(--color-green-primary)' }}>+</button>
              </div>
            ))}
          </div>

          {/* Current Playlist */}
          <div className="panel-header" style={{ marginTop: '0.5rem' }}>
            <h2>Your Selection ({playlist.length})</h2>
          </div>
          <div className="scrollable-list" style={{ flex: '1 1 0px', minHeight: 0 }}>
            {playlist.length === 0 && <div className="empty-state">No songs added yet.</div>}
            {playlist.map(song => (
              <div key={`play-${song._id}`} className="song-item">
                <div className="song-info">
                  <span className="song-title">{song.title}</span>
                  <span className="song-artist">{song.artist}</span>
                </div>
                <button className="btn" onClick={() => removeFromPlaylist(song._id)}>✕</button>
              </div>
            ))}
          </div>

          <button 
            className="btn-primary" 
            onClick={getRecommendations}
            disabled={playlist.length === 0 || isRecommending}
          >
            {isRecommending ? 'Generating...' : 'Get Recommendations'}
          </button>
        </div>

        {/* Right Panel: Recommendations */}
        <div className="panel">
          <div className="panel-header">
            <h2>Recommended for you</h2>
            <span style={{color: 'var(--color-text-subdued)'}}>{recommendations.length} songs</span>
          </div>
          
          <div className="scrollable-list">
            {isRecommending && <div className="loader"></div>}
            
            {!isRecommending && recommendations.length === 0 && (
              <div className="empty-state">
                Add songs to your playlist and hit recommend to see the magic happen.
              </div>
            )}

            {!isRecommending && recommendations.map(song => (
              <div key={`rec-${song._id}`} className="song-item" style={{ cursor: 'default' }}>
                <div className="song-info">
                  <span className="song-title">{song.title}</span>
                  <span className="song-artist">{song.artist}</span>
                </div>
                {song.similarity && (
                  <span className="score-badge">{(song.similarity * 100).toFixed(1)}% match</span>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
