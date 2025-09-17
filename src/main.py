

from pathlib import Path

import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from src.models.user import db
from src.routes.user import user_bp
from src.routes.bot import bot_bp
from src.routes.signal import signal_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(bot_bp, url_prefix='/api')
app.register_blueprint(signal_bp, url_prefix='/api')

# uncomment if you need to use database
app.config["SQLALCHEMY_DATABASE_URI"] = "PLACEHOLDER_DB_URI_WILL_BE_OVERRIDDEN"

# --- injected db override (BEGIN) ---
# Determina a URI do SQLite por ENV, com fallback para var/app.db (absoluto).
_db_uri = os.environ.get("DATABASE_URL") or os.environ.get("SQLALCHEMY_DATABASE_URI") or "sqlite:////workspaces/roasbot/var/app.db"

# Normaliza relativo para absoluto quando for sqlite:///relativo.db
if _db_uri.startswith("sqlite:///") and not _db_uri.startswith("sqlite:////"):
    from pathlib import Path as _P
    rel = _db_uri[len("sqlite:///"):]
    _db_uri = "sqlite:///" + str(_P(os.getcwd(), rel).resolve())

# Garante diretório existente para o arquivo sqlite
if _db_uri.startswith("sqlite:///"):
    from pathlib import Path as _P
    _path = _db_uri[len("sqlite:///"):]
    os.makedirs(str(_P(_path).parent), exist_ok=True)

# Reaplica na config (sobrescreve o placeholder) e garante flag de track
app.config["SQLALCHEMY_DATABASE_URI"] = _db_uri
app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
# --- injected db override (END) ---


app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
with app.app_context():
    db.create_all()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404


if __name__ == "__main__":
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", 5001)),
        debug=False,
        use_reloader=False,
    )
