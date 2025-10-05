import google.generativeai as genai
import logging
from PIL import Image
import io
from aiogram import Bot

# Настраиваем логгер
logger = logging.getLogger(__name__)

# Промпт из prompt.txt
GEMINI_PROMPT = """
Супер-строгий промпт для OCR документов (РФ + СНГ)

Ты — высокоточный OCR/IE-эксперт по документам, удостоверяющим личность, включая:

внутренний паспорт РФ,

загранпаспорт РФ,

ID-карты и/или загранпаспорта стран СНГ: Казахстан, Кыргызстан, Узбекистан, Таджикистан, Армения, Азербайджан, Беларусь, Молдова, Грузия, Украина.

0) Глобальные требования

Проанализируй все предоставленные изображения (лицевая и оборотная стороны/развороты).

Определи documentType, затем извлеки поля согласно схеме ниже.

Ключи JSON — только на английском. Значения — на языке документа (обычно кириллица/латиница).

Если поле не найдено/не применимо — заполни null.

Никакого свободного текста вне JSON. Выводи только один объект JSON.

Если сомневаешься в символе — не выдумывай, ставь null.

Даты выводи строго в формате "ДД.ММ.ГГГГ".

1) Обязательная JSON-схема (всегда один и тот же набор ключей)
{
  "documentType": "тип документа",
  "lastName": "ФАМИЛИЯ",
  "firstName": "ИМЯ",
  "middleName": "ОТЧЕСТВО или null",
  "birthDate": "ДД.ММ.ГГГГ",
  "birthPlace": "МЕСТО РОЖДЕНИЯ",
  "series": "серия или null",
  "number": "номер",
  "personalNumber": "уникальный номер или null",
  "issuedBy": "кем выдан",
  "issueDate": "ДД.ММ.ГГГГ",
  "expiryDate": "ДД.ММ.ГГГГ или null",
  "departmentCode": "код подразделения или null",
  "registrationAddress": "адрес регистрации или null"
}

2) Где искать поля (макетные подсказки)

Внутренний паспорт РФ (разворот с фото + страница «Паспорт выдан» + «Место жительства»):

series, number — Ищи в двух местах:
1. Стандартное расположение: правый верх страницы с фото. Формат: 4 цифры (серия) и 6 цифр (номер). Примеры: «4312 321313».
2. Новое расположение (приоритет): вертикально вдоль правого края страницы с фото. Номер напечатан красным цветом. Считывай цифры сверху вниз. Первые 4 цифры - это серия, следующие 6 - номер. Формат на изображении: XX XX XXXXXX. Собери их в "XXXX XXXXXX". Пример: на фото "40 24 884016" должно быть распознано как series: "4024", number: "884016".

departmentCode — справа от фразы «Код подразделения», формат XXX-XXX (пример «772-001»).

issueDate — сразу под заголовком «Паспорт выдан» (формат «ДД.ММ.ГГГГ»).

issuedBy — строка(и) под датой: «ОУФМС…», «ГУВМ МВД…».

lastName/firstName/middleName — на странице с фото (сверху вниз).

birthDate — под ФИО (строго «ДД.ММ.ГГГГ»).

birthPlace — строка после даты рождения.

registrationAddress — в развороте «Место жительства», может быть в несколько строк — соединяй в одну строку запятыми.

Загранпаспорт РФ (биометрический):

number — верхний правый угол, часто «NN NNNNNNN» (2+7 цифр), пример «70 1234567».

ФИО — латиница/кириллица (оставляй как на документе, можно через « / »).

birthDate, birthPlace — под ФИО.

issueDate, expiryDate — нижний блок.

issuedBy — «ГУВМ МВД РОССИИ» / «FMS RUSSIA».

series — null (для биометрических).

departmentCode — null.

registrationAddress — null.

ID/паспорт СНГ (общие подсказки):

number — крупно сверху/справа на лицевой стороне (буквенно-цифровой).

personalNumber — уникальный идентификатор (ИИН/ПИН/IDNP и т.п.) — под фото или на обороте.

issueDate, expiryDate — в нижней части лицевой стороны.

issuedBy — МВД/Полиция/Госорган, обычно в центре или снизу.

registrationAddress — чаще отсутствует → null.

Если есть MRZ (машиносчитываемая зона): используй её для проверки/нормализации number, birthDate, expiryDate (но формат вывода дат — всё равно «ДД.ММ.ГГГГ»).

3) Страны и типичные паттерны номеров (ориентиры, не жёсткие маски)

Казахстан (ID)
number: N\d{8} или похожий; personalNumber = ИИН \d{12} (пример «901010301234»).
issuedBy: «МИНИСТЕРСТВО ВНУТРЕННИХ ДЕЛ» / «МИНИСТРЛІК…».

Кыргызстан (ID, биометрический)
number: ID\d{7}; personalNumber: чаще 14 цифр.
issuedBy: «ГНС КЫРГЫЗСКОЙ РЕСПУБЛИКИ» / «МИНИСТЕРСТВО…».

Узбекистан (загран)
number: [A-Z]{2}\d{7} (пример «AB1234567»).
issuedBy: «OʻZBEKISTON RESPUBLIKASI IIV».
Часто есть MRZ.

Таджикистан (загран)
number: [A-Z]{2}\d{7} (например «AC1234567»).
personalNumber: может присутствовать; сверяй MRZ.
issuedBy: МВД Республики Таджикистан.

Армения (ID/паспорт)
number: AR\d{7} или буквенно-цифровой; personalNumber: 10 цифр.
issuedBy: «POLICE OF ARMENIA».

Азербайджан (ID/паспорт)
number: часто AZE\d{7} (варианты возможны); personalNumber: AZ\d{11,13}.
issuedBy: МВД/ASAN.

Беларусь (паспорт)
series+number: например «MP 1234567» (серия из 2 букв/символов + 7 цифр).
issuedBy: МВД Республики Беларусь.
personalNumber: может присутствовать (см. MRZ/поле PPN).

Молдова (ID)
number: ID\d{6}; personalNumber (IDNP) = 13 цифр.
issuedBy: «AGENȚIA SERVICII PUBLICE» и т.п.

Грузия (ID)
number: GE\d{7} (различается); personalNumber: 11 цифр.
issuedBy: МВД Грузии.

Украина (ID/загран)
number: буквенно-цифровой (загран часто [A-Z]{2}\d{6}/\d{8}); personalNumber (РНОКПП) может отсутствовать на документе.
Сверяй MRZ.

Если формат номера отличается — всё равно снимай ровно то, что напечатано, без нормализации под маску.

4) Валидация, нормализация и анти-ошибки OCR

Замены похожих символов (не применяй слепо; только при явной уверенности и контексте):

латиница ↔ кириллица: A↔А, B↔В, C↔С, E↔Е, H↔Н, K↔К, M↔М, O↔О, P↔Р, T↔Т, X↔Х, Y↔У.

цифры: 0↔O/О, 1↔I/І/|, 5↔S, 2↔Z — лучше не исправлять без подтверждения MRZ/повторений.

Даты:

Всегда выводи «ДД.ММ.ГГГГ».

Если в MRZ дата YYMMDD — конвертируй в «ДД.ММ.ГГГГ» (век определяй по здравому смыслу: дата выдачи/окончания не может быть в прошлом веке, если документ современный).

ФИО:

Сохраняй регистр как в документе (заглавные/смешанные).

Для загранов, где есть дубли «латиница / кириллица», оставь обе через « / » (как в примерах).

Адрес:

Склей многострочный адрес через запятую и пробел.

MRZ-проверки (если есть):

Сверь number, birthDate, expiryDate с MRZ.

Если противоречит, отдай наиболее надёжную версию (MRZ или чётко читаемую зону), а вторую — игнорируй (не добавляй новые ключи), не выдумывай.

Никаких догадок: если символ(ы) неразборчивы — ставь null.

5) Правила по полям (когда null обязателен)

departmentCode: только внутренний паспорт РФ. Для всех остальных — null.

registrationAddress: обычно есть только во внутреннем паспорте РФ — иначе null.

series: во внутреннем паспорте РФ — 4 цифры; в загране РФ — null. В других странах — по факту; если нет явной серии — null.

6) Мини-примеры (правильный вид значений)

Внутренний паспорт РФ (пример значений):

{
  "documentType": "internal_passport_rf",
  "lastName": "ИВАНОВ",
  "firstName": "ПЕТР",
  "middleName": "СЕРГЕЕВИЧ",
  "birthDate": "01.01.1990",
  "birthPlace": "Г. МОСКВА",
  "series": "4312",
  "number": "321313",
  "personalNumber": null,
  "issuedBy": "ОУФМС РОССИИ ПО Г. МОСКВЕ",
  "issueDate": "12.05.2015",
  "expiryDate": null,
  "departmentCode": "772-001",
  "registrationAddress": "Г. МОСКВА, УЛ. ПУШКИНА, Д. 10, КВ. 5"
}


Загранпаспорт РФ (пример значений):

{
  "documentType": "international_passport_rf",
  "lastName": "IVANOV / ИВАНОВ",
  "firstName": "PETR / ПЕТР",
  "middleName": null,
  "birthDate": "01.01.1990",
  "birthPlace": "MOSCOW / МОСКВА",
  "series": null,
  "number": "70 1234567",
  "personalNumber": null,
  "issuedBy": "ГУВМ МВД РОССИИ",
  "issueDate": "20.04.2021",
  "expiryDate": "20.04.2031",
  "departmentCode": null,
  "registrationAddress": null
}


ID Казахстан (пример значений):

{
  "documentType": "id_card_kazakhstan",
  "lastName": "ИВАНОВ",
  "firstName": "ПЕТР",
  "middleName": null,
  "birthDate": "15.03.1992",
  "birthPlace": "АЛМАТЫ",
  "series": null,
  "number": "N12345678",
  "personalNumber": "901010301234",
  "issuedBy": "МИНИСТЕРСТВО ВНУТРЕННИХ ДЕЛ",
  "issueDate": "15.03.2018",
  "expiryDate": "15.03.2028",
  "departmentCode": null,
  "registrationAddress": null
}


ID Кыргызстан (пример значений):

{
  "documentType": "id_card_kyrgyzstan",
  "lastName": "ИСМАИЛОВ",
  "firstName": "АЗАМАТ",
  "middleName": null,
  "birthDate": "20.05.1990",
  "birthPlace": "БИШКЕК",
  "series": null,
  "number": "ID1234567",
  "personalNumber": "20405199012345",
  "issuedBy": "ГНС КЫРГЫЗСКОЙ РЕСПУБЛИКИ",
  "issueDate": "01.02.2019",
  "expiryDate": "01.02.2029",
  "departmentCode": null,
  "registrationAddress": null
}


Загран Узбекистан (пример значений):

{
  "documentType": "international_passport_uzbekistan",
  "lastName": "IVANOV / ИВАНОВ",
  "firstName": "PETR / ПЕТР",
  "middleName": null,
  "birthDate": "15.03.1992",
  "birthPlace": "TOSHKENT / ТАШКЕНТ",
  "series": null,
  "number": "AB1234567",
  "personalNumber": null,
  "issuedBy": "OʻZBEKISTON RESPUBLIKASI IIV",
  "issueDate": "10.06.2020",
  "expiryDate": "10.06.2030",
  "departmentCode": null,
  "registrationAddress": null
}


Итог: выдай строго один JSON-объект по схеме из п.1, используя правила локализации полей, страновые подсказки и проверки из пп.2–5. Если какое-то поле не читается или отсутствует — ставь null без догадок.
"""

def configure_gemini(api_key: str):
    """Конфигурирует Gemini API."""
    try:
        genai.configure(api_key=api_key)
        logger.info("Gemini API успешно сконфигурирован.")
    except Exception as e:
        logger.error(f"Ошибка конфигурации Gemini API: {e}")
        raise

async def recognize_document_from_images(images: list, country: str = 'ru') -> dict:
    """
    Отправляет готовые PIL изображения в Gemini и возвращает JSON.

    :param images: Список PIL Image объектов для распознавания.
    :param country: Страна ('ru' для РФ, иначе для иностранцев).
    :return: Словарь с распознанными данными или пустой словарь в случае ошибки.
    """
    if not images:
        logger.warning("Нет изображений для распознавания.")
        return {}

    try:
        model = genai.GenerativeModel('gemini-2.5-flash-lite')

        # Выбираем промпт в зависимости от страны
        if country == 'ru':
            prompt = """
            Проанализируй эти изображения: основной разворот паспорта РФ, страница с пропиской и селфи с паспортом.
            Извлеки все данные и верни их в виде ОДНОГО плоского JSON объекта.
            Ключи: "Фамилия", "Имя", "Отчество", "Дата рождения", "Серия и номер паспорта", "Кем выдан", "Дата выдачи", "Адрес регистрации".
            Если поле не найдено, значение должно быть пустой строкой.
            Ответ должен быть только чистым JSON.
            """
        else:
            prompt = """
            Проанализируй эти изображения: паспорт иностранного гражданина, регистрация в РФ, патент и селфи с паспортом.
            Извлеки все данные и верни их в виде ОДНОГО плоского JSON объекта.
            Ключи: "ФИО", "Гражданство", "Дата рождения", "Номер паспорта", "Адрес регистрации в РФ", "Номер патента".
            Если поле не найдено, значение должно быть пустой строкой.
            Ответ должен быть только чистым JSON.
            """

        # Формируем запрос: промпт + изображения
        prompt_parts = [prompt] + images

        logger.info(f"Отправка {len(images)} изображений в Gemini для распознавания...")
        response = await model.generate_content_async(prompt_parts)

        # Извлекаем и чистим JSON из ответа
        response_text = response.text.strip()
        # Убираем "обертку" ```json ... ```, если она есть
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()

        import json
        recognized_data = json.loads(response_text)
        logger.info("Данные от Gemini успешно распознаны и распарсены.")

        return recognized_data

    except Exception as e:
        logger.error(f"Произошла ошибка во время распознавания в Gemini: {e}", exc_info=True)
        return {"error": str(e)} # Возвращаем ошибку, чтобы ее можно было обработать

async def recognize_document(bot: Bot, file_ids: list) -> dict:
    """
    Скачивает файлы по file_id, отправляет их в Gemini и возвращает JSON.

    :param bot: Экземпляр aiogram Bot.
    :param file_ids: Список file_id фотографий для распознавания.
    :return: Словарь с распознанными данными или пустой словарь в случае ошибки.
    """
    if not file_ids:
        logger.warning("Нет file_id для распознавания.")
        return {}

    try:
        model = genai.GenerativeModel('gemini-2.5-flash-lite')

        image_parts = []
        for file_id in file_ids:
            if not file_id: continue
            # Скачиваем файл с серверов Telegram в память
            file_info = await bot.get_file(file_id)
            downloaded_file = await bot.download_file(file_info.file_path)

            # Конвертируем в PIL Image, чтобы убедиться, что это изображение
            image = Image.open(io.BytesIO(downloaded_file.read()))

            # Gemini SDK сам обработает PIL Image
            image_parts.append(image)

        if not image_parts:
            logger.warning("Не удалось подготовить ни одного изображения для Gemini.")
            return {}

        # Формируем запрос: промпт + изображения
        prompt_parts = [GEMINI_PROMPT] + image_parts

        logger.info(f"Отправка {len(image_parts)} изображений в Gemini для распознавания...")
        response = await model.generate_content_async(prompt_parts)

        # Извлекаем и чистим JSON из ответа
        response_text = response.text.strip()
        # Убираем "обертку" ```json ... ```, если она есть
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()

        import json
        recognized_data = json.loads(response_text)
        logger.info("Данные от Gemini успешно распознаны и распарсены.")

        return recognized_data

    except Exception as e:
        logger.error(f"Произошла ошибка во время распознавания в Gemini: {e}", exc_info=True)
        return {"error": str(e)} # Возвращаем ошибку, чтобы ее можно было обработать