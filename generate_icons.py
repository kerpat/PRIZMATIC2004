from PIL import Image
import os

# Путь к исходному изображению
source_image = "prizmatic.jpg"

# Размеры иконок для Android
icon_sizes = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192
}

# Создаем папку для иконок если её нет
output_dir = "icons"
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Открываем исходное изображение
try:
    img = Image.open(source_image)
    print(f"✓ Загружено изображение: {source_image}")
    print(f"  Размер: {img.size}")
    
    # Создаем квадратное изображение (обрезаем по центру)
    width, height = img.size
    min_dim = min(width, height)
    
    left = (width - min_dim) // 2
    top = (height - min_dim) // 2
    right = left + min_dim
    bottom = top + min_dim
    
    img_square = img.crop((left, top, right, bottom))
    print(f"✓ Обрезано до квадрата: {min_dim}x{min_dim}")
    
    # Создаем иконки для RuStore (512x512)
    icon_512 = img_square.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512_path = os.path.join(output_dir, "icon-512.png")
    icon_512.save(icon_512_path, "PNG", quality=100)
    print(f"✓ Создана иконка для RuStore: {icon_512_path}")
    
    # Создаем иконки для Android
    for density, size in icon_sizes.items():
        icon = img_square.resize((size, size), Image.Resampling.LANCZOS)
        
        # Путь к папке mipmap
        mipmap_dir = os.path.join("android", "app", "src", "main", "res", f"mipmap-{density}")
        
        if not os.path.exists(mipmap_dir):
            os.makedirs(mipmap_dir)
        
        # Сохраняем иконку
        icon_path = os.path.join(mipmap_dir, "ic_launcher.png")
        icon.save(icon_path, "PNG", quality=100)
        print(f"✓ Создана иконка {density}: {size}x{size} -> {icon_path}")
        
        # Также сохраняем round версию
        icon_round_path = os.path.join(mipmap_dir, "ic_launcher_round.png")
        icon.save(icon_round_path, "PNG", quality=100)
        print(f"✓ Создана круглая иконка {density}: {icon_round_path}")
    
    print("\n" + "="*50)
    print("✅ ВСЕ ИКОНКИ СОЗДАНЫ!")
    print("="*50)
    print(f"\n📦 Иконка для RuStore (512x512): icons/icon-512.png")
    print(f"📱 Иконки для приложения: android/app/src/main/res/mipmap-*/")
    
except FileNotFoundError:
    print(f"❌ Ошибка: Файл '{source_image}' не найден!")
    print("   Убедитесь что файл prizmatic.jpg находится в текущей папке")
except Exception as e:
    print(f"❌ Ошибка: {e}")
