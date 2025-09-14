document.addEventListener('DOMContentLoaded', () => {
    // Containers
    const popularRailContainer = document.getElementById('popular-rail');
    const seriesGridContainer = document.getElementById('series-grid-container');
    const moviesGridContainer = document.getElementById('movies-grid-container');
    const seriesView = document.getElementById('series-view');
    const moviesView = document.getElementById('movies-view');
    const loadingOverlay = document.getElementById('loading-overlay');
    const appContainer = document.getElementById('app-container');
    const missingCoversSection = document.getElementById('missing-covers-section');
    const missingCoversList = document.getElementById('missing-covers-list');
    const hideMissingCoversBtn = document.getElementById('hide-missing-covers');

    // Controls
    const searchInput = document.getElementById('search-input');
    const filterSeriesBtn = document.getElementById('filter-series');
    const filterMoviesBtn = document.getElementById('filter-movies');

    // Data
    let allSeriesData = [];
    let allMoviesData = [];
    const NUM_RAIL_ITEMS = 10;

    const delay = ms => new Promise(res => setTimeout(res, ms)); // Keep delay for potential future use or other async tasks

    function fetchWithTimeout(url, timeout = 5000) {
        return Promise.race([
            fetch(url),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
        ]);
    }

    // Consistent filename sanitization
    function sanitizeFilename(title) {
        // Replace any non-alphanumeric character (except underscore) with a single underscore
        let sanitized = title.replace(/[^a-zA-Z0-9_]+/g, '_');
        // Remove leading/trailing underscores
        sanitized = sanitized.replace(/^_|_$/g, '');
        return sanitized;
    }

    async function fetchImageFor(item) {
        const seriesTitle = item.seriesTitle;
        const localFilename = sanitizeFilename(seriesTitle) + '.jpg';
        const localImageUrl = `local_covers/${localFilename}`;

        // Try to load from local_covers
        try {
            const response = await fetchWithTimeout(localImageUrl, 500); // Short timeout for local files
            if (response.ok) {
                return localImageUrl; // Found local image
            }
        } catch (e) {
            // Local file not found or timeout
            console.log(`Local image not found or timed out for ${seriesTitle}.`);
        }
        return item.imageUrl || 'images/cf-no-screenshot-error.png'; // Fallback to M3U or generic
    }

    function createSeriesCard(series) {
        const seriesCard = document.createElement('div');
        seriesCard.className = 'anime-card';
        seriesCard.dataset.title = series.seriesTitle; // Store title for API lookup
        seriesCard.dataset.originalImageUrl = series.imageUrl; // Store M3U image for comparison

        seriesCard.addEventListener('click', () => {
            sessionStorage.setItem('currentSeries', JSON.stringify(series));
            window.location.href = 'player.html';
        });

        const imageElement = document.createElement('img');
        imageElement.src = series.finalImageUrl; // Use the final image URL
        imageElement.alt = series.seriesTitle;
        seriesCard.appendChild(imageElement);
        
        const titleElement = document.createElement('h3');
        titleElement.textContent = series.seriesTitle;
        
        seriesCard.appendChild(titleElement);

        return seriesCard;
    }

    function renderContent(itemList, container) {
        container.innerHTML = '';
        itemList.forEach(item => {
            const card = createSeriesCard(item);
            container.appendChild(card);
        });
    }

    function setActiveButton(activeBtn) {
        [filterSeriesBtn, filterMoviesBtn].forEach(btn => btn.classList.remove('active'));
        activeBtn.classList.add('active');
    }

    if (window.Worker) {
        const myWorker = new Worker('m3u-worker.js');
        myWorker.postMessage('start');

        let tempSeries = [];
        let tempMovies = [];

        myWorker.onmessage = async function(e) { // Made async to await image fetches
            const msg = e.data;
            if (msg.type === 'error') {
                appContainer.innerHTML = `<p class="error-message">Erro ao carregar: ${msg.message}.</p>`;
                loadingOverlay.style.display = 'none';
                return;
            }

            if (msg.type === 'batch') {
                msg.data.forEach(item => {
                    if (item.category === 'series') tempSeries.push(item);
                    if (item.category === 'filmes') tempMovies.push(item);
                });
            }

            if (msg.type === 'done') {
                allSeriesData = tempSeries;
                allMoviesData = tempMovies;

                const allItemsToProcess = [...allSeriesData, ...allMoviesData];
                const missingCovers = [];

                // Attempt to load ALL local images in parallel.
                const localImagePromises = allItemsToProcess.map(async item => {
                    const originalFinalImageUrl = item.imageUrl; // Store original M3U fallback
                    item.finalImageUrl = await fetchImageFor(item); // fetchImageFor now only tries local
                    
                    // If final image is still the M3U fallback, it means local was not found
                    if (item.finalImageUrl === originalFinalImageUrl) {
                        missingCovers.push(item.seriesTitle);
                    }
                });
                await Promise.allSettled(localImagePromises); // Wait for all local fetches to complete

                loadingOverlay.style.display = 'none';
                appContainer.classList.remove('hidden');

                const popularItems = [...allSeriesData, ...allMoviesData]
                    .sort((a, b) => b.episodes.length - a.episodes.length)
                    .slice(0, NUM_RAIL_ITEMS);
                
                renderContent(popularItems, popularRailContainer);
                renderContent(allSeriesData, seriesGridContainer);
                renderContent(allMoviesData, moviesGridContainer);

                // Display missing covers list if any
                if (missingCovers.length > 0) {
                    missingCoversSection.classList.remove('hidden');
                    missingCoversList.innerHTML = '';
                    missingCovers.forEach(title => {
                        const li = document.createElement('li');
                        li.textContent = title;
                        missingCoversList.appendChild(li);
                    });
                }
            }
        };

    } else {
        appContainer.innerHTML = '<p>Seu navegador não suporta Web Workers.</p>';
        loadingOverlay.style.display = 'none';
    }

    // --- Event Listeners ---
    hideMissingCoversBtn.addEventListener('click', () => {
        missingCoversSection.classList.add('hidden');
    });

    searchInput.addEventListener('input', e => {
        const searchTerm = e.target.value.toLowerCase();
        const isMoviesActive = !moviesView.classList.contains('hidden');
        
        if (isMoviesActive) {
            const filtered = allMoviesData.filter(s => s.seriesTitle.toLowerCase().includes(searchTerm));
            renderContent(filtered, moviesGridContainer);
        } else {
            const filtered = allSeriesData.filter(s => s.seriesTitle.toLowerCase().includes(searchTerm));
            renderContent(filtered, seriesGridContainer);
        }
    });

    filterSeriesBtn.addEventListener('click', () => {
        moviesView.classList.add('hidden');
        seriesView.classList.remove('hidden');
        setActiveButton(filterSeriesBtn);
        // Re-render content for the active view on filter click
        renderContent(allSeriesData, seriesGridContainer);
    });

    filterMoviesBtn.addEventListener('click', () => {
        seriesView.classList.add('hidden');
        moviesView.classList.remove('hidden');
        setActiveButton(filterMoviesBtn);
        // Re-render content for the active view on filter click
        renderContent(allMoviesData, moviesGridContainer);
    });
});