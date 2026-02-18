from flask import Flask, request, jsonify, send_from_directory
import sqlite3
from decimal import Decimal, InvalidOperation
from datetime import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'expenses.db')

app = Flask(__name__, static_folder='static', static_url_path='')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS expenses (
           id TEXT PRIMARY KEY,
           amount_cents INTEGER NOT NULL,
           category TEXT NOT NULL,
           description TEXT,
           date TEXT NOT NULL,
           created_at TEXT NOT NULL
        )'''
    )
    conn.commit()
    conn.close()


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


def row_to_dict(row):
    return {
        'id': row['id'],
        'amount': str(Decimal(row['amount_cents']) / 100),
        'category': row['category'],
        'description': row['description'],
        'date': row['date'],
        'created_at': row['created_at']
    }


@app.route('/expenses', methods=['POST'])
def create_expense():
    data = request.get_json(force=True)
    # Required fields
    for f in ('amount', 'category', 'date'):
        if f not in data:
            return jsonify({'error': f'Missing field: {f}'}), 400

    # Optional client-provided id for idempotency
    eid = data.get('id')

    # Validate amount using Decimal and store as cents
    try:
        amt = Decimal(str(data['amount']))
    except (InvalidOperation, TypeError):
        return jsonify({'error': 'Invalid amount'}), 400

    if amt < 0:
        return jsonify({'error': 'Amount must be non-negative'}), 400

    amount_cents = int((amt * 100).to_integral_value())

    category = str(data['category'])
    description = str(data.get('description') or '')
    date = str(data['date'])
    created_at = datetime.utcnow().isoformat() + 'Z'

    conn = get_db()
    cur = conn.cursor()

    if not eid:
        # generate server id if not provided
        import uuid
        eid = str(uuid.uuid4())

    try:
        cur.execute(
            'INSERT INTO expenses (id, amount_cents, category, description, date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (eid, amount_cents, category, description, date, created_at)
        )
        conn.commit()
        cur.execute('SELECT * FROM expenses WHERE id = ?', (eid,))
        row = cur.fetchone()
        resp = row_to_dict(row)
        return jsonify(resp), 201
    except sqlite3.IntegrityError:
        # id already exists -> idempotent: return existing
        cur.execute('SELECT * FROM expenses WHERE id = ?', (eid,))
        row = cur.fetchone()
        if row:
            return jsonify(row_to_dict(row)), 200
        else:
            return jsonify({'error': 'Conflict'}), 409
    finally:
        conn.close()


@app.route('/expenses', methods=['GET'])
def list_expenses():
    category = request.args.get('category')
    sort = request.args.get('sort')

    conn = get_db()
    cur = conn.cursor()
    q = 'SELECT * FROM expenses'
    params = []
    if category:
        q += ' WHERE category = ?'
        params.append(category)

    if sort == 'date_desc':
        q += ' ORDER BY date DESC, created_at DESC'
    else:
        q += ' ORDER BY date ASC'

    cur.execute(q, params)
    rows = cur.fetchall()
    items = [row_to_dict(r) for r in rows]

    # total of visible list
    total_cents = sum(int(Decimal(item['amount']) * 100) for item in items)
    total = str(Decimal(total_cents) / 100)

    conn.close()
    return jsonify({'expenses': items, 'total': total})

# Ensure database is initialized when app starts (Render/Gunicorn)
with app.app_context():
    init_db()

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)

