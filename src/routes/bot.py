from flask import Blueprint, jsonify, request
from datetime import datetime
from src.models.user import db
from src.models.bot import Bot
from src.models.strategy import Strategy

bot_bp = Blueprint("bot", __name__)

# -------- BOTS --------
@bot_bp.route("/bots", methods=["GET"])
def get_bots():
    bots = Bot.query.order_by(Bot.id.desc()).all()
    return jsonify({"success": True, "data": [b.to_dict() for b in bots]})

@bot_bp.route("/bots", methods=["POST"])
def create_bot():
    data = request.get_json(force=True) or {}
    b = Bot(
        name=data.get("name","Bot"),
        game_type=data.get("game_type","aviator"),
        casino_site=data.get("casino_site"),
        telegram_token=data.get("telegram_token"),
        telegram_chat_id=data.get("telegram_chat_id"),
        is_active=data.get("is_active", True),
    )
    db.session.add(b); db.session.commit()
    return jsonify({"success": True, "data": b.to_dict()}), 201

# -------- STRATEGIES --------
@bot_bp.route("/bots/<int:bot_id>/strategies", methods=["GET"])
def list_strategies(bot_id):
    if not Bot.query.get(bot_id):
        return jsonify({"success": False, "error": "Robô não encontrado"}), 404
    items = Strategy.query.filter_by(bot_id=bot_id).order_by(Strategy.id.desc()).all()
    return jsonify({"success": True, "data": [s.to_dict() for s in items]})

@bot_bp.route("/strategies", methods=["POST"])
def create_strategy():
    data = request.get_json(force=True) or {}
    for f in ["name","bot_id","pattern","action"]:
        if f not in data:
            return jsonify({"success": False, "error": f"Campo obrigatório: {f}"}), 400
    if not Bot.query.get(data["bot_id"]):
        return jsonify({"success": False, "error": "Robô não encontrado"}), 404
    s = Strategy(
        name=data["name"], bot_id=data["bot_id"],
        pattern=data["pattern"], action=data["action"],
        start_time=data.get("start_time"),
        end_time=data.get("end_time"),
        custom_message=data.get("custom_message"),
        use_default_message=data.get("use_default_message", True),
        is_active=data.get("is_active", True),
    )
    db.session.add(s); db.session.commit()
    return jsonify({"success": True, "data": s.to_dict()}), 201

@bot_bp.route("/strategies/<int:strategy_id>", methods=["PUT"])
def update_strategy(strategy_id):
    s = Strategy.query.get_or_404(strategy_id)
    data = request.get_json(force=True) or {}
    for f in ["name","pattern","action","start_time","end_time","custom_message","use_default_message","is_active"]:
        if f in data: setattr(s, f, data[f])
    s.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"success": True, "data": s.to_dict()})

@bot_bp.route("/strategies/<int:strategy_id>", methods=["DELETE"])
def delete_strategy(strategy_id):
    s = Strategy.query.get_or_404(strategy_id)
    db.session.delete(s); db.session.commit()
    return jsonify({"success": True, "message": "Estratégia removida"})
