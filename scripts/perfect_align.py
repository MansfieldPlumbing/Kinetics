import json, re

def clean(text):
    return re.sub(r'[^a-zA-Z0-9]', '', text).lower()

with open('timings_whisper.json') as f:
    whisper_words = json.load(f)

with open('lyrics.txt', 'r') as f:
    raw_lines = [l.strip() for l in f if l.strip() and not l.strip().startswith('**')]

# Standardize transcript pool
w_idx = 0
total_whisper = len(whisper_words)
aligned_timed_words = []

for line in raw_lines:
    words = line.split()
    for word in words:
        cw = clean(word)
        matched_sample = None
        
        # Scan forward in Whisper results within a limited lookahead window
        search_limit = min(w_idx + 10, total_whisper)
        for i in range(w_idx, search_limit):
            cand = whisper_words[i]
            if clean(cand['text']) == cw:
                matched_sample = cand
                w_idx = i + 1  # Advance sequence pointer to prevent out-of-order matches
                break
        
        if matched_sample:
            st = round(matched_sample['start'], 2)
            en = round(matched_sample['end'], 2)
        else:
            # Fallback relative to previous anchor if Whisper missed the word
            st = aligned_timed_words[-1]['end'] if aligned_timed_words else 0.0
            en = round(st + 0.35, 2)
            
        aligned_timed_words.append({"text": word, "start": st, "end": en})

def format_vtt_timestamp(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"

vtt_lines = [
    "WEBVTT - Kinetic Math Typography Atomic Subtitles",
    ""
]

for idx, item in enumerate(aligned_timed_words, 1):
    start_str = format_vtt_timestamp(item['start'])
    end_str = format_vtt_timestamp(item['end'])
    vtt_lines.append(str(idx))
    vtt_lines.append(f"{start_str} --> {end_str}")
    vtt_lines.append(item['text'])
    vtt_lines.append("")

vtt_content = "\n".join(vtt_lines)

with open('subtitles.vtt', 'w') as f:
    f.write(vtt_content)

with open('public/subtitles.vtt', 'w') as f:
    f.write(vtt_content)

print("Successfully written atomic subtitles!")
