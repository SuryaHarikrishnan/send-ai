import { useState, useEffect } from "react";

export default function News() {
  const [category, setCategory] = useState("latest");
  const [articles, setArticles] = useState([]);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, [category]);

  useEffect(() => {
    fetchVideo();
  }, []);

  async function fetchNews() {
    setLoading(true);
    try {
      const res = await fetch(`/api/news?category=${category}`);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (e) {
      setArticles([]);
    }
    setLoading(false);
  }

  async function fetchVideo() {
    setVideoLoading(true);
    try {
      const res = await fetch("/api/youtube");
      const data = await res.json();
      setVideo(data.video || null);
    } catch (e) {
      setVideo(null);
    }
    setVideoLoading(false);
  }

  const categories = [
    { key: "latest", label: "Latest" },
    { key: "gear", label: "Gear & Products" },
    { key: "achievements", label: "Achievements" },
  ];

  return (
    <div className="news">
      <h2 className="tab-title">News</h2>

      {/* Video of the week */}
      <div className="news-section">
        <div className="news-section-label">Video of the Week</div>
        {videoLoading && <div className="news-skeleton" />}
        {!videoLoading && video && (
          <a href={video.url} target="_blank" rel="noopener noreferrer" className="video-card">
            <div className="video-thumb-wrap">
              <img src={video.thumbnail} alt={video.title} className="video-thumb" />
              <div className="video-play">▶</div>
            </div>
            <div className="video-info">
              <div className="video-title">{video.title}</div>
              <div className="video-channel">{video.channel}</div>
            </div>
          </a>
        )}
        {!videoLoading && !video && (
          <div className="coming-soon">No video found this week.</div>
        )}
      </div>

      {/* News categories */}
      <div className="news-section">
        <div className="coach-modes" style={{ marginBottom: "1.25rem" }}>
          {categories.map(c => (
            <button
              key={c.key}
              className={category === c.key ? "active" : ""}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1,2,3].map(i => <div key={i} className="news-skeleton" />)}
          </div>
        )}

        {!loading && articles.length === 0 && (
          <div className="coming-soon">No articles found.</div>
        )}

        {!loading && articles.map((a, i) => (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="article-card">
            {a.image && (
              <img src={a.image} alt={a.title} className="article-image" onError={e => e.target.style.display = "none"} />
            )}
            <div className="article-body">
              <div className="article-meta">{a.source} · {new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
              <div className="article-title">{a.title}</div>
              <div className="article-desc">{a.description}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}