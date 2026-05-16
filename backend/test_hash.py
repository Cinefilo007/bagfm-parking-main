import bcrypt
hash_db = '$2b$12$9zK49sBIezoFgDKJiu38Nu2d0tdg95yqi/gzwzeHnQIn.V4Ba5NN.'
password = 'admin'
try:
    match = bcrypt.checkpw(password.encode('utf-8'), hash_db.encode('utf-8'))
    print(f"Match: {match}")
except Exception as e:
    print(f"Error: {e}")
