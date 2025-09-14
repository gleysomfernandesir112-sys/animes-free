document.addEventListener('DOMContentLoaded', () => {
    const seriesTitleEl = document.getElementById('series-title');
    const episodeTitleEl = document.getElementById('episode-title');
    const video = document.getElementById('video-player');
    const episodeListEl = document.getElementById('episode-list');

    let seriesData = null;
    try {
        seriesData = JSON.parse(sessionStorage.getItem('currentSeries'));
    } catch (e) {
        console.error('Erro ao carregar seriesData do sessionStorage:', e);
    }
    let watchedEpisodes = [];
    try {
        watchedEpisodes = JSON.parse(localStorage.getItem(seriesData?.seriesTitle) || '[]');
    } catch (e) {
        console.error('Erro ao carregar watchedEpisodes do localStorage:', e);
        // Fallback to an empty array if parsing fails
        watchedEpisodes = [];
    }

    if (!seriesData) {
        seriesTitleEl.textContent = "Erro: Nenhum dado da série encontrado.";
        return;
    }

    seriesTitleEl.textContent = seriesData.seriesTitle;
    document.title = seriesData.seriesTitle;

    function playEpisode(episode, episodeLi) {
        video.src = episode.url;
        video.play();
        episodeTitleEl.textContent = episode.title;

        // Update active state in UI
        document.querySelectorAll('#episode-list li').forEach(li => li.classList.remove('active'));
        episodeLi.classList.add('active');

        // Mark as watched
        if (!watchedEpisodes.includes(episode.url)) {
            watchedEpisodes.push(episode.url);
            localStorage.setItem(seriesData.seriesTitle, JSON.stringify(watchedEpisodes));
            episodeLi.classList.add('watched');
        }
    }

    seriesData.episodes.forEach(episode => {
        const li = document.createElement('li');
        li.textContent = episode.title;
        li.addEventListener('click', () => playEpisode(episode, li));

        if (watchedEpisodes.includes(episode.url)) {
            li.classList.add('watched');
        }

        episodeListEl.appendChild(li);
    });

    // Auto-play the first unwatched episode or the very first one
    const firstUnwatched = seriesData.episodes.find(ep => !watchedEpisodes.includes(ep.url));
    const episodeToPlay = firstUnwatched || seriesData.episodes[0];
    if (episodeToPlay) {
        const firstLi = Array.from(episodeListEl.children).find(li => li.textContent === episodeToPlay.title);
        playEpisode(episodeToPlay, firstLi);
    }
});