from flask import Blueprint, jsonify
from src.models.bot import Bot
from src.models.user import db

bp = Blueprint("bots", __name__)

@bp.route("/api/bots", methods=["GET"])
def list_bots():
    # Se a tabela estiver vazia, retorna lista vazia
    rows = Bot.query.order_by(Bot.id.asc()).all()
    data = [
        {
            "id": b.id,
            "name": b.name,
            "game_type": b.game_type,
            "casino_site": b.casino_site,
            "is_active": b.is_active,
            "created_at": (b.created_at.isoformat() if b.created_at else None),
        }
        for b in rows
    ]
    return jsonify({"ok": True, "bots": data})
