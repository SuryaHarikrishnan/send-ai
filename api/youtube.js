export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=rock+climbing+bouldering+send&type=video&order=relevance&maxResults=1&publishedAfter=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}&key=${process.env.YOUTUBE_API_KEY}`
    );
    const data = await response.json();

    if (!data.items?.length) {
      return res.status(200).json({ video: null });
    }

    const v = data.items[0];
    res.status(200).json({
      video: {
        id: v.id.videoId,
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        thumbnail: v.snippet.thumbnails.high.url,
        url: `https://www.youtube.com/watch?v=${v.id.videoId}`,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}