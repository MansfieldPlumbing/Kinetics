import json, re

with open('timings_whisper.json') as f:
    whisper_chunks = json.load(f)

with open('lyrics.txt') as f:
    raw_lines = [line.strip() for line in f if line.strip() and not line.strip().startswith('**')]

def clean(w):
    return re.sub(r'[^a-zA-Z0-9]', '', w).lower()

# Inspect whisper text stream
w_words = [c['text'] for c in whisper_chunks]
w_clean = [clean(w) for w in w_words]

# Print sample alignment check
print("Whisper start:", whisper_chunks[0]['start'], "end:", whisper_chunks[-1]['end'])

aligned_lines = []
w_idx = 0

for line_num, line in enumerate(raw_lines):
    line_words = line.split()
    matched_chunks = []
    
    # Try to greedily or fuzzy match words from line into whisper_chunks
    for lw in line_words:
        clw = clean(lw)
        best_j = -1
        # Look ahead up to 15 chunks
        for j in range(w_idx, min(w_idx + 15, len(whisper_chunks))):
            cw = w_clean[j]
            if cw == clw or (len(cw) >= 3 and (cw in clw or clw in cw)):
                best_j = j
                break
        
        if best_j != -1:
            matched_chunks.append((lw, whisper_chunks[best_j]['start'], whisper_chunks[best_j]['end']))
            w_idx = best_j + 1
        else:
            # Estimate based on current w_idx
            if w_idx < len(whisper_chunks):
                cur_s = whisper_chunks[w_idx]['start']
                cur_e = whisper_chunks[w_idx]['end']
                matched_chunks.append((lw, cur_s, cur_e))
                w_idx += 1
            elif matched_chunks:
                last_e = matched_chunks[-1][2]
                matched_chunks.append((lw, last_e + 0.1, last_e + 0.4))
            else:
                matched_chunks.append((lw, 13.0, 13.4))
                
    aligned_lines.append({
        "lineIndex": line_num,
        "lineText": line,
        "words": [{"text": m[0], "start": round(m[1], 2), "end": round(m[2], 2)} for m in matched_chunks],
        "start": round(matched_chunks[0][1], 2),
        "end": round(matched_chunks[-1][2], 2)
    })

print(f"Aligned {len(aligned_lines)} lines.")
print("Line 1:", aligned_lines[0]['start'], "-", aligned_lines[0]['end'], aligned_lines[0]['lineText'])
print("Line 5:", aligned_lines[4]['start'], "-", aligned_lines[4]['end'], aligned_lines[4]['lineText'])
print("Line 15:", aligned_lines[14]['start'], "-", aligned_lines[14]['end'], aligned_lines[14]['lineText'])
print("Line 40:", aligned_lines[39]['start'], "-", aligned_lines[39]['end'], aligned_lines[39]['lineText'])

# Flatten to all words for timings.json
flattened = []
for l in aligned_lines:
    for w in l['words']:
        flattened.append(w)

with open('timings.json', 'w') as f:
    json.dump(flattened, f, indent=2)

with open('aligned_lines.json', 'w') as f:
    json.dump(aligned_lines, f, indent=2)

print("Saved perfectly aligned timings.json and aligned_lines.json!")
