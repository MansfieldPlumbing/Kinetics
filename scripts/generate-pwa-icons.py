from pathlib import Path
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parents[1] / 'public' / 'icons'
out.mkdir(exist_ok=True)
for size in (192, 512):
    image = Image.new('RGB', (size, size), '#f4f2eb')
    draw = ImageDraw.Draw(image)
    def points(coords):
        return [(round(x * size), round(y * size)) for x, y in coords]
    draw.polygon(points([(0.29, .27), (.39, .27), (.39, .45), (.57, .27), (.71, .27), (.47, .50), (.71, .73), (.57, .73), (.39, .55), (.39, .73), (.29, .73)]), fill='#1c1917')
    draw.ellipse((size * .66, size * .19, size * .75, size * .28), fill='#ed8a32')
    image.save(out / f'icon-{size}.png')
