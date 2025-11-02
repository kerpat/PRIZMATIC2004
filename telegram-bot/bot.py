import asyncio
import json
import logging
import aiohttp
from aiohttp import web
from typing import Union
import base64
from pathlib import Path
from PIL import Image
import io
import sys
sys.path.append(str(Path(__file__).resolve().parent.parent))


from aiogram import Bot, Dispatcher, F, types
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.filters import CommandStart
from aiogram.types import (
    Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove, WebAppInfo,
    FSInputFile
)
from supabase import Client
from supabase_client import get_supabase_service_role_client
from ocr import configure_gemini, recognize_document, recognize_document_from_images

# --- Конфигурация ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '8126548981:AAGC86ZaJ0SYLICC0WbpS7aGOhU9t8iz_a4')
WEBAPP_REGISTER_API = 'https://prizmatic-2004.vercel.app/api/telegram-register'
BOT_REGISTER_API = 'https://prizmatic-2004.vercel.app/api/auth'
ADMIN_SECRET_KEY = 'your_super_secret_admin_key' # Секрет для уведомлений от админки
WEB_APP_URL = 'https://prizmatic-2004.vercel.app/' # URL вашего основного веб-приложения

# --- ВОТ ЭТОТ НОВЫЙ БЛОК ---
# Добавь сюда ID админов, которым будут приходить уведомления
ADMIN_IDS = [752012766]  # <--- ЗАМЕНИ НА РЕАЛЬНЫЕ ID АДМИНОВ
# --- КОНЕЦ НОВОГО БЛОКА ---

# Supabase settings
GEMINI_API_KEY = os.getenv('GOOGLE_API_KEY')
if not GEMINI_API_KEY:
    logger.critical("!!! ���� GOOGLE_API_KEY �� ������. �஢���� ��� .env 䠩� � ��� �ᯮ�������.")
else:
    logger.info("���� Gemini API �ᯥ譮 ����㦥� �� ��६����� ���㦥���.")

try:
    supabase: Client = get_supabase_service_role_client()
    logger.info("Supabase client initialized.")
except RuntimeError as exc:
    logger.critical("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set! %s", exc)
    supabase = None  # type: ignore[assignment]

# --- Инициализация Aiogram ---
bot = Bot(token=TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

# --- Состояния FSM для регистрации ---
class Reg(StatesGroup):
    agreement = State()      # НОВОЕ СОСТОЯНИЕ ДЛЯ СОГЛАСИЯ
    phone = State()
    name = State()
    birth_date = State()
    city = State()
    country = State()
    other_country = State()
    passport_main = State()
    passport_reg = State()
    # inn = State()          # УБРАЛИ СОСТОЯНИЕ ИНН
    patent_front = State()
    patent_back = State()
    patent_receipt = State()
    driver_license = State()
    emergency_phone = State()
    video_note = State()

async def upload_file_to_supabase(file_id: str, user_id: int, key: str) -> str:
    """Download file from Telegram and upload to Supabase Storage"""
    try:
        # Get file info
        file_info = await bot.get_file(file_id)
        # Download file
        file_bytes = await bot.download_file(file_info.file_path)
        # Upload to Supabase
        storage_path = f"{user_id}/{key}.jpg"
        response = supabase.storage.from_("passports").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
        logger.info(f"Uploaded {storage_path} to Supabase")
        return storage_path
    except Exception as e:
        logger.error(f"Failed to upload {key} for user {user_id}: {e}")
        return None

# --- Клавиатуры ---
def get_phone_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="📱 Поделиться номером", request_contact=True)]],
        resize_keyboard=True,
        one_time_keyboard=True
    )

def get_city_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🏙️ Москва", callback_data="city_msk")
        ],
        [
            InlineKeyboardButton(text="🏙️ Санкт-Петербург", callback_data="city_spb")
        ]
    ])

def get_country_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🇷🇺 Российская Федерация", callback_data="country_ru")],
        [InlineKeyboardButton(text="🇰🇿 Казахстан", callback_data="country_kz")],
        [InlineKeyboardButton(text="🇰🇬 Кыргызстан", callback_data="country_kg")],
        [InlineKeyboardButton(text="🇺🇿 Узбекистан", callback_data="country_uz")],
        [InlineKeyboardButton(text="🇹🇯 Таджикистан", callback_data="country_tj")],
        [InlineKeyboardButton(text="🌍 Другое", callback_data="country_other")]
    ])

def get_skip_keyboard(text: str = "Пропустить") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=text, callback_data="skip")]
    ])

# --- ВОТ ЭТА НОВАЯ ФУНКЦИЯ ---
async def notify_admins_about_new_user(user_name: str, user_id: int):
    """Отправляет уведомление всем админам о новом пользователе."""
    if not ADMIN_IDS:
        logger.warning("Список ADMIN_IDS пуст, уведомления админам не отправлены.")
        return

    text = (
        f"🔔 *Новая заявка на верификацию!*\n\n"
        f"Пользователь: *{user_name}*\n"
        f"ID пользователя: `{user_id}`\n\n"
        f"Пожалуйста, проверьте анкету в панели администратора."
    )

    admin_keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➡️ Открыть админ-панель", url=f"{WEB_APP_URL}/admin.html")]
    ])

    for admin_id in ADMIN_IDS:
        try:
            await bot.send_message(
                chat_id=admin_id,
                text=text,
                parse_mode='Markdown',
                reply_markup=admin_keyboard
            )
            logger.info(f"Уведомление о новом пользователе {user_name} отправлено админу {admin_id}")
        except Exception as e:
            logger.error(f"Не удалось отправить уведомление админу {admin_id}: {e}")
# --- КОНЕЦ НОВОЙ ФУНКЦИИ ---

# --- Функции переходов ---
# Функция go_to_inn удалена, так как больше не нужна

async def go_to_driver(msg: Union[Message, CallbackQuery], state: FSMContext):
    text = "🚗 *Дополнительные документы (необязательно):* Отправьте фото водительского удостоверения."
    keyboard = get_skip_keyboard("⏭️ Пропустить")
    if isinstance(msg, CallbackQuery):
        await msg.message.edit_text(text + "\n\n_Если нет, нажмите кнопку ниже._", parse_mode='Markdown', reply_markup=keyboard)
    else:
        await msg.answer(text + "\n\n_Если нет, нажмите кнопку ниже._", parse_mode='Markdown', reply_markup=keyboard)
    await state.set_state(Reg.driver_license)

async def go_to_emergency(msg: Union[Message, CallbackQuery], state: FSMContext):
    text = "📞 *Телефон экстренного контакта:*\n_Пример: +7 (999) 123-45-67_"
    if isinstance(msg, CallbackQuery):
        await msg.message.edit_text(text, parse_mode='Markdown')
    else:
        await msg.answer(text, parse_mode='Markdown')
    await state.set_state(Reg.emergency_phone)

# --- Хэндлеры Бота ---

@dp.message(CommandStart())
async def start_handler(message: Message, state: FSMContext):
    await state.clear()
    args = message.text.split()[1] if len(message.text.split()) > 1 else None

    if args == 'register':
        try:
            # Создаем объекты файлов
            agreement_file = FSInputFile('soglashenie.docx')
            appendix_file = FSInputFile('prilozhenie.docx')

            # Создаем клавиатуру с кнопкой согласия
            agreement_kb = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="✅ Я согласен и принимаю условия", callback_data="agree_and_continue")]
            ])

            # Отправляем документы и сообщение с кнопкой
            await message.answer_document(agreement_file)
            await message.answer_document(
                appendix_file,
                caption=(
                    "📄 *Пожалуйста, ознакомьтесь с документами выше.*\n\n"
                    "Нажимая кнопку «Я согласен», вы подтверждаете, что полностью "
                    "прочитали, поняли и принимаете условия Пользовательского соглашения "
                    "и Приложения к нему. Это действие имеет юридическую силу и "
                    "приравнивается к вашей собственноручной подписи."
                ),
                parse_mode='Markdown',
                reply_markup=agreement_kb
            )
            # Устанавливаем новое начальное состояние ожидания согласия
            await state.set_state(Reg.agreement)
        except FileNotFoundError:
            logger.error("Файлы соглашений (soglashenie.docx, prilozhenie.docx) не найдены!")
            await message.answer("❌ Не удалось загрузить документы для регистрации. Пожалуйста, обратитесь в поддержку.")
        return

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🚀 Открыть приложение", web_app=WebAppInfo(url=WEB_APP_URL))]
    ])
    await message.answer(
        f"👋 Здравствуйте, *{message.from_user.first_name or 'пользователь'}!*\n\n"
        "Добро пожаловать в *PRIZMATIC* — сервис аренды электровелосипедов.\n\n"
        "🚀 Нажмите кнопку ниже, чтобы открыть приложение и начать пользоваться сервисом.",
        parse_mode='Markdown',
        reply_markup=keyboard
    )

@dp.callback_query(Reg.agreement, F.data == "agree_and_continue")
async def process_agreement(callback: CallbackQuery, state: FSMContext):
    # Убираем кнопку, чтобы избежать повторных нажатий
    await callback.message.edit_reply_markup(reply_markup=None)
    # Начинаем стандартный процесс регистрации
    await callback.message.answer(
        "🚀 *Спасибо за подтверждение!* Давайте начнем регистрацию.\n\n"
        "Это займет всего несколько шагов и обеспечит безопасность вашего аккаунта.\n\n"
        "📱 *Шаг 1:* Поделитесь вашим контактом для верификации.",
        parse_mode='Markdown',
        reply_markup=get_phone_keyboard()
    )
    await state.set_state(Reg.phone)
    await callback.answer()

@dp.message(Reg.agreement)
async def agreement_fallback(message: Message):
    await message.answer("Пожалуйста, нажмите кнопку '✅ Я согласен' под документами выше, чтобы продолжить.")


@dp.message(Reg.phone, F.contact)
async def process_phone(message: types.Message, state: FSMContext):
    if message.contact.user_id != message.from_user.id:
        await message.answer("❌ Пожалуйста, поделитесь своим собственным контактом.", reply_markup=get_phone_keyboard())
        return

    await state.update_data(phone=message.contact.phone_number, telegram_user_id=message.from_user.id)
    await message.answer(
        "✅ *Отлично! Контакт получен.*\n\n"
        "📝 *Шаг 2:* Введите ваше полное имя (ФИО), как в паспорте.\n"
        "_Пример: Иванов Иван Иванович_",
        parse_mode='Markdown',
        reply_markup=ReplyKeyboardRemove()
    )
    await state.set_state(Reg.name)

# ... (остальные хэндлеры до `process_passport_reg` остаются без изменений) ...

@dp.message(Reg.phone)
async def process_phone_invalid(message: Message):
    await message.answer(
        "❌ Пожалуйста, используйте кнопку ниже, чтобы поделиться контактом.\n\n"
        "_Это необходимо для верификации вашего аккаунта._",
        parse_mode='Markdown',
        reply_markup=get_phone_keyboard()
    )

@dp.message(Reg.name)
async def process_name(message: Message, state: FSMContext):
    await state.update_data(name=message.text.strip())
    await message.answer(
        "👤 *Имя сохранено!*\n\n"
        "📅 *Шаг 3:* Введите вашу дату рождения (ДД.ММ.ГГГГ).\n"
        "_Пример: 15.05.1990_",
        parse_mode='Markdown'
    )
    await state.set_state(Reg.birth_date)

@dp.message(Reg.birth_date)
async def process_birth_date(message: Message, state: FSMContext):
    import re
    from datetime import datetime

    date_str = message.text.strip()
    if not re.match(r'^\d{2}\.\d{2}\.\d{4}$', date_str):
        await message.answer(
            "❌ *Неверный формат даты*\n\n"
            "Введите дату в формате ДД.ММ.ГГГГ\n"
            "_Пример: 15.05.1990_",
            parse_mode='Markdown'
        )
        return

    try:
        birth_date = datetime.strptime(date_str, '%d.%m.%Y')
        today = datetime.now()
        age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

        if age < 18:
            await message.answer(
                "❌ *Возраст должен быть 18+ лет*\n\n"
                "Регистрация доступна только для совершеннолетних.\n"
                "Попробуйте позже.",
                parse_mode='Markdown'
            )
            await state.clear()
            return

        await state.update_data(birth_date=date_str)
        await message.answer(
            f"📅 *Дата рождения сохранена!*\n"
            f"_Ваш возраст: {age} лет_\n\n"
            "🏙️ *Шаг 4:* Выберите город работы.",
            parse_mode='Markdown',
            reply_markup=get_city_keyboard()
        )
        await state.set_state(Reg.city)
    except ValueError:
        await message.answer(
            "❌ *Неверная дата*\n\n"
            "Проверьте корректность даты и попробуйте снова.\n"
            "_Пример: 15.05.1990_",
            parse_mode='Markdown'
        )

@dp.callback_query(Reg.city, F.data.startswith("city_"))
async def process_city_callback(callback: CallbackQuery, state: FSMContext):
    data = callback.data
    if data == "city_msk":
        city = "Москва"
    elif data == "city_spb":
        city = "Санкт-Петербург"
    else:
        await callback.answer("❌ Неверный выбор.")
        return

    await state.update_data(city=city)
    await callback.message.edit_text(
        f"🏙️ *Город сохранен: {city}*\n\n"
        "🌍 *Шаг 5:* Выберите страну гражданства.",
        parse_mode='Markdown',
        reply_markup=get_country_keyboard()
    )
    await state.set_state(Reg.country)
    await callback.answer()

@dp.callback_query(Reg.country, F.data.startswith("country_"))
async def process_country_callback(callback: CallbackQuery, state: FSMContext):
    data = callback.data
    country_map = {
        "country_ru": ("ru", "Российская Федерация"),
        "country_kz": ("kz", "Казахстан"),
        "country_kg": ("kg", "Кыргызстан"),
        "country_uz": ("uz", "Узбекистан"),
        "country_tj": ("tj", "Таджикистан"),
        "country_other": ("other", "Другое")
    }
    country_info = country_map.get(data)
    if not country_info:
        await callback.answer("❌ Неверный выбор.")
        return

    country_code, country_name = country_info
    await state.update_data(citizenship=country_code)

    if country_code == "other":
        await callback.message.edit_text(
            "🌍 *Введите полное название вашей страны.*\n"
            "_Пример: Армения_",
            parse_mode='Markdown',
            reply_markup=None
        )
        await state.set_state(Reg.other_country)
        await callback.answer()
        return

    patent_required = country_code in ['uz', 'tj']
    back_optional = country_code != 'ru'
    await state.update_data(
        patent_required=patent_required,
        back_optional=back_optional
    )

    if country_code == 'ru':
        passport_text = "📸 *Шаг 6:* Отправьте фото главного разворота паспорта.\n_Убедитесь, что фото четкое и все данные читаемы._"
    else:
        passport_text = "📸 *Шаг 6:* Отправьте фото основного документа.\n_Загранпаспорт (главная страница) или ID-карта (лицевая сторона)._"

    await callback.message.edit_text(
        f"🌍 *Страна: {country_name}*\n\n"
        f"{passport_text}",
        parse_mode='Markdown',
        reply_markup=None
    )
    await state.set_state(Reg.passport_main)
    await callback.answer()

@dp.message(Reg.other_country)
async def process_other_country(message: Message, state: FSMContext):
    country_name = message.text.strip()
    if not country_name:
        await message.answer(
            "❌ *Название страны обязательно.*\n"
            "_Введите полное название._",
            parse_mode='Markdown'
        )
        return

    await state.update_data(
        citizenship=country_name,
        patent_required=True,
        back_optional=True
    )

    await message.answer(
        f"🌍 *Страна: {country_name}*\n\n"
        "📸 *Шаг 6:* Отправьте фото основного документа.\n"
        "_Загранпаспорт (главная страница) или ID-карта (лицевая сторона)._",
        parse_mode='Markdown'
    )
    await state.set_state(Reg.passport_main)

@dp.message(Reg.passport_main, F.photo)
async def process_passport_main(message: Message, state: FSMContext):
    await state.update_data(passport_main_file_id=message.photo[-1].file_id)
    data = await state.get_data()
    country = data.get('citizenship')

    if country == 'ru':
        reg_text = "📸 *Шаг 7:* Отправьте фото страницы с регистрацией.\n_Если регистрации нет, отправьте любое фото паспорта._"
    else:
        reg_text = "📸 *Шаг 7:* Если у вас ID-карта, отправьте фото оборотной стороны.\n_Если загранпаспорт, отправьте любое фото документа или пропустите._"

    await message.answer(
        f"📷 *Фото получено!*\n\n{reg_text}",
        parse_mode='Markdown'
    )
    await state.set_state(Reg.passport_reg)

@dp.message(Reg.passport_reg, F.photo)
async def process_passport_reg_photo(message: Message, state: FSMContext):
    await state.update_data(passport_reg_file_id=message.photo[-1].file_id)
    
    # --- ИЗМЕНЕННАЯ ЛОГИКА: Вместо go_to_inn ---
    data = await state.get_data()
    patent_required = data.get('patent_required', False)
    if patent_required:
        await message.answer(
            "📝 *Фото получено!*\n\n"
            "📄 *Шаг 8:* Отправьте фото патента на работу (лицевая сторона).\n"
            "_Если нет, нажмите кнопку ниже._",
            parse_mode='Markdown',
            reply_markup=get_skip_keyboard()
        )
        await state.set_state(Reg.patent_front)
    else:
        await go_to_driver(message, state)


@dp.message(Reg.passport_reg)
async def process_passport_reg_text(message: Message, state: FSMContext):
    data = await state.get_data()
    country = data.get('citizenship')
    if country == 'ru':
        await message.answer(
            "❌ *Для РФ требуется фото страницы с регистрацией.*\n"
            "_Отправьте фото._",
            parse_mode='Markdown'
        )
        return
    # Skip for non-RU
    await state.update_data(passport_reg_file_id=None)
    
    # --- ИЗМЕНЕННАЯ ЛОГИКА: Вместо go_to_inn ---
    patent_required = data.get('patent_required', False)
    if patent_required:
        await message.answer(
            "📝 *Пропущено!*\n\n"
            "📄 *Шаг 8:* Отправьте фото патента на работу (лицевая сторона).\n"
            "_Если нет, нажмите кнопку ниже._",
            parse_mode='Markdown',
            reply_markup=get_skip_keyboard()
        )
        await state.set_state(Reg.patent_front)
    else:
        await go_to_driver(message, state)


# --- Хэндлер process_inn удален ---

@dp.message(Reg.patent_front, F.photo)
async def process_patent_front(message: Message, state: FSMContext):
    await state.update_data(patent_front_file_id=message.photo[-1].file_id)
    await message.answer(
        "📄 *Фото получено!*\n\n"
        "📄 *Шаг 9:* Отправьте фото патента (оборотная сторона).\n"
        "_Если нет, нажмите кнопку ниже._",
        parse_mode='Markdown',
        reply_markup=get_skip_keyboard()
    )
    await state.set_state(Reg.patent_back)

@dp.callback_query(Reg.patent_front, F.data == "skip")
async def skip_patent_front(callback: CallbackQuery, state: FSMContext):
    await state.update_data(patent_front_file_id=None)
    await callback.message.edit_text(
        "📄 *Пропущено!*\n\n",
        parse_mode='Markdown',
        reply_markup=None
    )
    await go_to_driver(callback, state)
    await callback.answer()

@dp.message(Reg.patent_back, F.photo)
async def process_patent_back(message: Message, state: FSMContext):
    await state.update_data(patent_back_file_id=message.photo[-1].file_id)
    await message.answer(
        "📄 *Фото получено!*\n\n"
        "📄 *Шаг 10:* Отправьте фото чека об оплате патента.\n"
        "_Если нет, нажмите кнопку ниже._",
        parse_mode='Markdown',
        reply_markup=get_skip_keyboard()
    )
    await state.set_state(Reg.patent_receipt)

@dp.callback_query(Reg.patent_back, F.data == "skip")
async def skip_patent_back(callback: CallbackQuery, state: FSMContext):
    await state.update_data(patent_back_file_id=None)
    await callback.message.edit_text(
        "📄 *Пропущено!*\n\n"
        "📄 *Шаг 10:* Отправьте фото чека об оплате патента.\n"
        "_Если нет, нажмите кнопку ниже._",
        parse_mode='Markdown',
        reply_markup=get_skip_keyboard()
    )
    await state.set_state(Reg.patent_receipt)
    await callback.answer()

# ... (остальные хэндлеры до конца остаются без изменений) ...

@dp.message(Reg.patent_receipt, F.photo)
async def process_patent_receipt(message: Message, state: FSMContext):
    await state.update_data(patent_receipt_file_id=message.photo[-1].file_id)
    await go_to_driver(message, state)

@dp.callback_query(Reg.patent_receipt, F.data == "skip")
async def skip_patent_receipt(callback: CallbackQuery, state: FSMContext):
    await state.update_data(patent_receipt_file_id=None)
    await callback.message.edit_text(
        "📄 *Пропущено!*\n\n",
        parse_mode='Markdown',
        reply_markup=None
    )
    await go_to_driver(callback, state)
    await callback.answer()

@dp.message(Reg.driver_license, F.photo)
async def process_driver_license(message: Message, state: FSMContext):
    await state.update_data(driver_license_file_id=message.photo[-1].file_id)
    await message.answer("🚗 *Фото получено!*\n\n", reply_markup=None)
    await go_to_emergency(message, state)

@dp.callback_query(Reg.driver_license, F.data == "skip")
async def skip_driver_license(callback: CallbackQuery, state: FSMContext):
    await state.update_data(driver_license_file_id=None)
    await callback.message.edit_text(
        "🚗 *Пропущено!*\n\n",
        parse_mode='Markdown',
        reply_markup=None
    )
    await go_to_emergency(callback, state)
    await callback.answer()

@dp.message(Reg.driver_license)
async def fallback_driver(message: Message, state: FSMContext):
    # If text message, treat as skip or ignore
    await message.answer("Пожалуйста, отправьте фото или нажмите кнопку пропустить.", reply_markup=get_skip_keyboard())

@dp.message(Reg.emergency_phone)
async def process_emergency_phone(message: Message, state: FSMContext):
    emergency_phone = message.text.strip()
    await state.update_data(emergency_phone=emergency_phone)
    await message.answer(
        "📞 *Телефон сохранен!*\n\n"
        "🎥 *Финальный шаг:* Запишите видео-кружок, где держите документ рядом с лицом.\n"
        "_Это обеспечит безопасность вашего аккаунта._",
        parse_mode='Markdown'
    )
    await state.set_state(Reg.video_note)

@dp.message(Reg.video_note, F.video_note)
async def process_video_note(message: Message, state: FSMContext):
    # Сохраняем file_id видео
    await state.update_data(video_note_file_id=message.video_note.file_id)
    user_data = await state.get_data()
    user_id = user_data.get('telegram_user_id')

    await message.answer(
        "🎉 *Видео получено!*\n\n"
        "🤖 Обрабатываю ваши документы... Это может занять до минуты.",
        parse_mode='Markdown'
    )

    try:
        # --- ШАГ 1: Собираем все file_id (и фото, и видео) ---
        file_ids_to_upload = {
            key.replace('_file_id', ''): user_data[key]
            for key in user_data if key.endswith('_file_id') and user_data[key]
        }

        images_for_gemini = []

        # --- ШАГ 2: Скачиваем файлы ОДИН РАЗ и загружаем ВСЕ в Storage ---
        for key, file_id in file_ids_to_upload.items():
            try:
                file_info = await bot.get_file(file_id)
                file_bytes_io = await bot.download_file(file_info.file_path)
                file_bytes = file_bytes_io.read() # Читаем байты в переменную

                # Определяем тип контента
                if key == 'video_note':
                    content_type = 'video/mp4'
                else:
                    content_type = 'image/jpeg'

                # Загружаем ЛЮБОЙ файл в Supabase Storage
                storage_path = f"{user_id}/{key}.{content_type.split('/')[1]}" # e.g., .../passport_main.jpeg or .../video_note.mp4
                supabase.storage.from_("passports").upload(
                    path=storage_path,
                    file=file_bytes,
                    file_options={"content-type": content_type, "upsert": "true"}
                )

                # Заменяем file_id на путь в Storage прямо в user_data
                user_data[key + '_storage_path'] = storage_path
                del user_data[key + '_file_id'] # Удаляем старый ключ с file_id

            except Exception as e:
                logger.error(f"Ошибка при обработке файла {key}: {e}")
                continue # Пропускаем битый файл и идем дальше

        # --- ШАГ 3: Готовим данные для отправки на сервер ---
        await message.answer("✅ Документы загружены! Отправляю анкету на сервер для обработки...")

        # Удаляем временные флаги
        user_data.pop('patent_required', None)
        user_data.pop('back_optional', None)
        # Удаляем ИНН, если он вдруг где-то сохранился
        user_data.pop('inn', None)

        api_data = {
            "action": "bot-register",
            "userId": user_id,
            "formData": user_data # Отправляем все, что собрали
        }
        logger.info(f"ОТЛАДКА: Отправляю на Vercel API следующие данные: {json.dumps(api_data, indent=2, ensure_ascii=False)}")

        async with aiohttp.ClientSession() as session:
            async with session.post(BOT_REGISTER_API, json=api_data) as response:
                if response.status != 200:
                    response_text = await response.text()
                    logger.error(f"API returned status {response.status}: {response_text}")
                    raise Exception(f"API returned status {response.status}")

                result = await response.json()
                if result.get('success'):

                    # --- ВОТ ЭТУ СТРОЧКУ НУЖНО ДОБАВИТЬ ---
                    await notify_admins_about_new_user(user_name=user_data.get('name'), user_id=user_id)
                    # --- КОНЕЦ ДОБАВЛЕНИЯ ---

                    await message.answer(
                        "✅ *Регистрация завершена!*\n\n"
                        "🎊 Ваши данные приняты и отправлены на проверку.\n\n"
                        "📱 Вы можете в любой момент зайти в приложение и посмотреть там статус проверки, дозаполнить данные (если потребуется), подключить карту, написать в поддержку или пригласить друга.\n\n"
                        "_Спасибо за доверие к PRIZMATIC!_",
                        parse_mode='Markdown'
                    )
                    # Send video with app button
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[
                        [InlineKeyboardButton(text="🚀 Открыть приложение", web_app=WebAppInfo(url=WEB_APP_URL))]
                    ])
                    # Убедитесь, что файл IMG_7164.MP4 лежит в той же папке
                    try:
                        video_for_send = FSInputFile('IMG_7164.MP4')
                        await message.answer_video(
                            video=video_for_send,
                            caption="Посмотрите короткое видео о том, как пользоваться приложением!",
                            reply_markup=keyboard
                        )
                    except FileNotFoundError:
                        logger.warning("Файл с видео-инструкцией (IMG_7164.MP4) не найден.")
                        # Просто отправляем сообщение без видео, если файла нет
                        await message.answer("🚀 Нажмите кнопку ниже, чтобы открыть приложение.", reply_markup=keyboard)

                else:
                    await message.answer(
                        f"❌ *Ошибка регистрации*\n\n{result.get('error', 'Неизвестная ошибка')}\n\nПопробуйте еще раз или обратитесь в поддержку.",
                        parse_mode='Markdown'
                    )
    except Exception as e:
        logger.error("Final registration API call failed: %s", e)
        await message.answer("❌ Произошла ошибка при регистрации. Попробуйте позже.")
    finally:
        await state.clear()

# --- Универсальный хэндлер для отлова всего остального ---
@dp.message()
async def any_message_handler(message: types.Message, state: FSMContext):
    current_state = await state.get_state()
    if current_state is None:
        return # Не отвечаем на сообщения вне FSM
    logger.info(f"Сообщение типа {message.content_type} в состоянии {current_state}")


# --- Веб-сервер для уведомлений от админки ---
async def notify_handler(request: web.Request):
    if request.headers.get('Authorization') != f'Bearer {ADMIN_SECRET_KEY}':
        return web.Response(status=401, text='Unauthorized')
    
    try:
        data = await request.json()
        user_id = data.get('user_id')
        text = data.get('text')
        if not user_id or not text:
            return web.json_response({'error': 'user_id and text are required'}, status=400)
        
        await bot.send_message(chat_id=user_id, text=text)
        return web.json_response({'success': True})
    except Exception as e:
        logger.error("Notify handler error: %s", e)
        return web.json_response({'error': 'Failed to send message'}, status=500)

async def start_http_server():
    app = web.Application()
    app.router.add_post('/notify', notify_handler)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8080)
    await site.start()
    logger.info("HTTP server for notifications started on port 8080")

# --- Главная функция запуска ---
async def main():
    # Конфигурируем Gemini при старте бота
    if GEMINI_API_KEY:
        configure_gemini(GEMINI_API_KEY)
    else:
        logger.error("Ключ GEMINI_API_KEY не найден. Распознавание не будет работать.")

    # Запускаем HTTP сервер параллельно с ботом
    http_server_task = asyncio.create_task(start_http_server())

    logger.info("🤖 Бот запущен!")
    await dp.start_polling(bot)

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 Бот остановлен.")
