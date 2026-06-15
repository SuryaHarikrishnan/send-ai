export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { category } = req.query;

  const queries = {
    latest: "rock climbing OR bouldering OR sport climbing",
    gear: "climbing gear OR climbing shoes OR climbing equipment",
    achievements: "climbing send OR first ascent OR climbing record OR V17 OR 5.15",
  };

  const query = queries[category] || queries.latest;

  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=6&language=en&apiKey=${process.env.NEWS_API_KEY}`
    );
    const data = await response.json();

    if (data.status !== "ok") {
      return res.status(500).json({ error: data.message });
    }

    const articles = data.articles
      .filter(a => a.title && a.description && !a.title.includes("[Removed]"))
      .map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
        image: a.urlToImage,
        source: a.source.name,
        publishedAt: a.publishedAt,
      }));

    res.status(200).json({ articles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}