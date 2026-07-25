import sqlite3

conn  = sqlite3.connect('a.db')   # create a.db if it not exist

c = conn.cursor()

## update
c.execute("UPDATE users SET first_name = 'xx' WHERE last_name='aa'")
c.execute("UPDATE users SET first_name = 'xx' WHERE rowid=1")

conn.commit()
conn.close()
