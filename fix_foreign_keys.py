import psycopg2
from urllib.parse import quote

# Подключение к базе данных - кодируем пароль
password = "ln2+1fSbrciaIavThI+w2S/0+BQufhiMUmUU9g1CDeQ="
encoded_password = quote(password, safe='')

db_url = f"postgresql://prizmatic_user:{encoded_password}@51.250.17.150:5432/prizmatic"
conn = psycopg2.connect(db_url)
cur = conn.cursor()

try:
    # Удаляем записи, которые ссылаются на несуществующих пользователей
    print("Удаляем сообщения поддержки для несуществующих пользователей...")
    cur.execute("""
        DELETE FROM support_messages 
        WHERE client_id NOT IN (SELECT id FROM clients);
    """)
    
    print("Удаляем аренды для несуществующих пользователей...")
    cur.execute("""
        DELETE FROM rentals 
        WHERE user_id NOT IN (SELECT id FROM clients);
    """)
    
    print("Удаляем бронирования для несуществующих пользователей...")
    cur.execute("""
        DELETE FROM bookings 
        WHERE user_id NOT IN (SELECT id FROM clients);
    """)
    
    print("Удаляем платежи для несуществующих пользователей...")
    cur.execute("""
        DELETE FROM payments 
        WHERE client_id NOT IN (SELECT id FROM clients);
    """)
    
    print("Удаляем связи аренд и батарей для несуществующих аренд...")
    cur.execute("""
        DELETE FROM rental_batteries 
        WHERE rental_id NOT IN (SELECT id FROM rentals);
    """)

    # Меняем ограничения на каскадное удаление
    print("Изменяем ограничения на каскадное удаление...")
    
    # Для support_messages
    cur.execute("""
        ALTER TABLE support_messages 
        DROP CONSTRAINT support_messages_client_id_fkey,
        ADD CONSTRAINT support_messages_client_id_fkey 
        FOREIGN KEY (client_id) REFERENCES clients(id) 
        ON DELETE CASCADE;
    """)
    
    # Для payments
    cur.execute("""
        ALTER TABLE payments 
        DROP CONSTRAINT payments_client_id_fkey,
        ADD CONSTRAINT payments_client_id_fkey 
        FOREIGN KEY (client_id) REFERENCES clients(id) 
        ON DELETE CASCADE;
    """)
    
    # Для bookings
    cur.execute("""
        ALTER TABLE bookings 
        DROP CONSTRAINT bookings_user_id_fkey,
        ADD CONSTRAINT bookings_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES clients(id) 
        ON DELETE CASCADE;
    """)
    
    # Для rental_batteries
    cur.execute("""
        ALTER TABLE rental_batteries 
        DROP CONSTRAINT rental_batteries_rental_id_fkey,
        ADD CONSTRAINT rental_batteries_rental_id_fkey 
        FOREIGN KEY (rental_id) REFERENCES rentals(id) 
        ON DELETE CASCADE;
    """)
    
    # Для rentals
    cur.execute("""
        ALTER TABLE rentals 
        DROP CONSTRAINT rentals_user_id_fkey,
        ADD CONSTRAINT rentals_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES clients(id) 
        ON DELETE CASCADE;
    """)

    # Фиксируем изменения
    conn.commit()
    print("Ограничения успешно изменены на каскадное удаление.")
    
except Exception as e:
    print(f"Ошибка: {e}")
    conn.rollback()
    
finally:
    cur.close()
    conn.close()