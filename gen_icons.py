from PIL import Image, ImageDraw

def draw_barbell(draw, cx, cy, scale, color):
    bar_w = int(120 * scale)
    bar_h = int(10 * scale)
    draw.rounded_rectangle(
        [cx - bar_w, cy - bar_h // 2, cx + bar_w, cy + bar_h // 2],
        radius=bar_h // 2, fill=color
    )
    plate_w = int(14 * scale)
    plate_h = int(70 * scale)
    for sign in (-1, 1):
        x = cx + sign * bar_w
        draw.rounded_rectangle(
            [x - plate_w, cy - plate_h, x + plate_w, cy + plate_h],
            radius=plate_w, fill=color
        )
        plate_w2 = int(9 * scale)
        plate_h2 = int(45 * scale)
        x2 = x + sign * int(20 * scale)
        draw.rounded_rectangle(
            [x2 - plate_w2, cy - plate_h2, x2 + plate_w2, cy + plate_h2],
            radius=plate_w2, fill=color
        )

def make_icon(path, size, bg, fg):
    img = Image.new("RGBA", (size, size), bg)
    draw = ImageDraw.Draw(img)
    draw_barbell(draw, size // 2, size // 2, size / 260, fg)
    img.save(path)

bg = (15, 23, 42, 255)   # slate-900
fg = (56, 189, 248, 255) # sky-400

make_icon("icons/icon-192.png", 192, bg, fg)
make_icon("icons/icon-512.png", 512, bg, fg)
make_icon("icons/apple-touch-icon.png", 180, bg, fg)
print("done")
