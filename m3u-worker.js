const M3U_URL = 'https://pub-b518a77f46ca4165b58d8329e13fb2a9.r2.dev/206609967_playlist.m3u';
const FILTERS = { 
    series: 'group-title="◆ SERIES | ANIMES"',
    filmes: 'group-title="◆ FILMES | ANIMES"'
};

self.onmessage = function() {
    fetchAndParseM3U();
};

function getSeriesName(title) {
    // Improved function to clean up series names
    let cleanTitle = title
        .replace(/\s*\(S\d+E\d+\)|\s*\[[^\]]+\]|\s*S\d+E\d+/gi, '') // Handles (S01E01), [TAGS], and S01E01
        .trim();
    
    // Handles variations of - EP 01, EPISODIO 1, etc., at the end of the string
    cleanTitle = cleanTitle.replace(/(?:-|–|—)?\s*(EP|E|EPISODIO|episódio)?\s*\d+\s*$/i, '').trim();
    
    // Remove any leftover trailing dashes
    cleanTitle = cleanTitle.replace(/\s*[-–—]\s*$/, '').trim();

    return cleanTitle;
}

async function fetchAndParseM3U() {
    try {
        const response = await fetch(M3U_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.text();
        const lines = data.split('\n');
        const seriesMap = new Map();
        const BATCH_SIZE = 20;
        let batch = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line.startsWith('#EXTINF')) continue;

            let category = null;
            if (line.includes(FILTERS.series)) category = 'series';
            if (line.includes(FILTERS.filmes)) category = 'filmes';

            if (category) {
                // Correctly extract title by splitting by the last comma
                const parts = line.split(',');
                const originalTitle = parts[parts.length - 1].trim();
                
                const url = lines[i + 1] ? lines[i + 1].trim() : null;

                if (url) {
                    const seriesName = (category === 'filmes') ? originalTitle : getSeriesName(originalTitle);

                    if (!seriesMap.has(seriesName)) {
                        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                        const imageUrl = logoMatch && logoMatch[1] ? logoMatch[1] : 'images/cf-no-screenshot-warn.png';
                        const newSeries = {
                            seriesTitle: seriesName,
                            imageUrl: imageUrl,
                            category: category,
                            episodes: []
                        };
                        seriesMap.set(seriesName, newSeries);
                        batch.push(newSeries);

                        if (batch.length >= BATCH_SIZE) {
                            postMessage({ type: 'batch', data: batch });
                            batch = [];
                        }
                    }

                    const seriesEntry = seriesMap.get(seriesName);
                    seriesEntry.episodes.push({
                        title: originalTitle,
                        url: url
                    });
                }
            }
        }

        // Send any remaining items in the last batch
        if (batch.length > 0) {
            postMessage({ type: 'batch', data: batch });
        }

        // Signal that the process is complete
        postMessage({ type: 'done' });

    } catch (e) {
        console.error('Failed to fetch or parse M3U file:', e);
        postMessage({ type: 'error', message: e.message });
    }
}