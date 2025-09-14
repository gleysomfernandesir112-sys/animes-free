import requests
import re
import os
import json
import time

# Configuration
M3U_URL = "https://pub-b518a77f46ca4165b58d8329e13fb2a9.r2.dev/206609967_playlist.m3u"
JIKAN_API_BASE = "https://api.jikan.moe/v4/anime"
LOCAL_COVERS_DIR = "local_covers"

# Ensure local_covers directory exists
os.makedirs(LOCAL_COVERS_DIR, exist_ok=True)

def get_series_name(title):
    clean_title = re.sub(r'\s*\(S\d+E\d+\)|\s*\[[^\]]+\]|\s*S\d+E\d+', '', title).strip()
    clean_title = re.sub(r'(?:-|–|—)?\s*(EP|E|EPISODIO|episódio)?\s*\d+\s*$', '', clean_title).strip()
    clean_title = re.sub(r'\s*[- –—]\s*$', '', clean_title).strip()
    return clean_title

def sanitize_filename(title):
    # Replace any non-alphanumeric character (except underscore) with a single underscore
    sanitized = re.sub(r'[^a-zA-Z0-9_]+', '_', title)
    # Remove leading/trailing underscores
    sanitized = re.sub(r'^_|_$', '', sanitized)
    return sanitized

def download_image(url, filepath):
    try:
        img_data = requests.get(url, timeout=10).content
        with open(filepath, 'wb') as handler:
            handler.write(img_data)
        print(f"Downloaded: {filepath}")
        return True
    except Exception as e:
        print(f"Error downloading {url} to {filepath}: {e}")
        return False

def main():
    print("Fetching M3U content...")
    try:
        m3u_response = requests.get(M3U_URL, timeout=30)
        m3u_response.raise_for_status()
        m3u_content = m3u_response.text
    except requests.exceptions.RequestException as e:
        print(f"Error fetching M3U: {e}")
        return

    lines = m3u_content.split('\n')
    series_titles = set() # Use a set to store unique series titles

    for i in range(len(lines)):
        line = lines[i].strip()
        if line.startswith('#EXTINF'):
            parts = line.split(',')
            original_title = parts[-1].strip()
            
            if 'group-title="◆ SERIES | ANIMES"' in line:
                series_name = get_series_name(original_title) # Apply sanitization for series
                if series_name:
                    series_titles.add(series_name)
            elif 'group-title="◆ FILMES | ANIMES"' in line:
                series_name = original_title.strip() # For movies, use the original title directly
                if series_name:
                    series_titles.add(series_name)

    print(f"Found {len(series_titles)} unique series/movie titles. Starting image download...")

    for title in sorted(list(series_titles)):
        # Sanitize title for filename
        filename = sanitize_filename(title) + ".jpg"
        filepath = os.path.join(LOCAL_COVERS_DIR, filename)

        if os.path.exists(filepath):
            print(f"Skipping {title}: already exists.")
            continue

        # Fetch from Jikan API
        print(f"Searching Jikan for: {title}")
        try:
            jikan_response = requests.get(f"{JIKAN_API_BASE}?q={title}&limit=1", timeout=10)
            jikan_response.raise_for_status()
            jikan_data = jikan_response.json()

            if jikan_data['data'] and len(jikan_data['data']) > 0:
                image_url = jikan_data['data'][0]['images']['jpg']['image_url']
                download_image(image_url, filepath)
            else:
                print(f"No image found on Jikan for: {title}")
        except requests.exceptions.RequestException as e:
            print(f"Error fetching Jikan for {title}: {e}")
        
        time.sleep(1) # Respect Jikan API rate limit (1 request per second)

    print("\nDownload process complete.")

if __name__ == "__main__":
    main()