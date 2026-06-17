export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { category } = req.query;

  const queries = {
    latest: '"rock climbing" OR "bouldering" OR "sport climbing" OR "free solo" OR "climbing gym"',
    gear: '"climbing shoes" OR "climbing harness" OR "climbing chalk" OR "La Sportiva" OR "Scarpa" OR "Black Diamond" OR "climbing gear"',
    achievements: '"first ascent" OR "climbing send" OR "V16" OR "V17" OR "5.15" OR "free climb" OR "climbing record" OR "Adam Ondra" OR "Magnus Midtbø"',
  };

  const query = queries[category] || queries.latest;

  try {
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=8&language=en&domains=climbing.com,rockandice.com,ukclimbing.com,outsideonline.com,eveningsends.com,gripped.com&apiKey=${process.env.NEWS_API_KEY}`
    );
    const data = await response.json();

    // fallback without domain filter if no results
    if (data.status !== "ok" || !data.articles?.length) {
      const fallback = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=8&language=en&apiKey=${process.env.NEWS_API_KEY}`
      );
      const fallbackData = await fallback.json();
      const articles = (fallbackData.articles || [])
        .filter(a => a.title && a.description && !a.title.includes("[Removed]"))
        .map(a => ({
          title: a.title,
          description: a.description,
          url: a.url,
          image: a.urlToImage,
          source: a.source.name,
          publishedAt: a.publishedAt,
        }));
      return res.status(200).json({ articles });
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