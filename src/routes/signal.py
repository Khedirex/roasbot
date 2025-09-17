
from flask import Blueprint, jsonify, request
import requests, time
from typing import Dict, List, Tuple

from src.models.user import db
from src.models.bot import Bot
from src.models.strategy import Strategy

signal_bp = Blueprint("signal", __name__)

TG_API = "https://api.telegram.org/bot{token}/{method}"

# buffers em memória por bot
RING: Dict[int, List[float]] = {}
LAST_PRE: Dict[Tuple[int, str], int] = {}
LAST_CONF: Dict[Tuple[int, str], int] = {}
EVENT_COUNT: Dict[int, int] = {}

def _tg_send(bot_token, chat_id, text, parse_mode="HTML"):
    if not bot_token or not chat_id:
        return {"ok": False, "error": "missing token/chat_id"}
    try:
        r = requests.post(
            TG_API.format(token=bot_token, method="sendMessage"),
            data={"chat_id": chat_id, "text": text, "parse_mode": parse_mode, "disable_web_page_preview": True},
            timeout=10,
        )
        try:
            j = r.json()
        except Exception:
            j = {"raw_text": r.text}
        return {"ok": bool(isinstance(j, dict) and j.get("ok")), "status": r.status_code, "raw": j}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@signal_bp.route("/signals/ping", methods=["GET"])
def ping():
    return jsonify({"ok": True, "service": "signals"})

@signal_bp.route("/signals/test-telegram", methods=["GET","POST"])
def test_telegram():
    if request.method == "GET":
        bot_token = request.args.get("bot_token"); chat_id = request.args.get("chat_id")
    else:
        data = request.get_json(silent=True) or {}
        bot_token = data.get("bot_token"); chat_id = data.get("chat_id")
    res = _tg_send(bot_token, chat_id, "Teste via backend Flask: OK")
    return jsonify({"success": bool(res.get("ok")), "response": res})

@signal_bp.route("/signals/send-manual", methods=["GET","POST"])
def send_manual():
    if request.method == "GET":
        bot_token = request.args.get("bot_token"); chat_id = request.args.get("chat_id")
        message = request.args.get("message", "Envio manual via backend.")
    else:
        data = request.get_json(silent=True) or {}
        bot_token = data.get("bot_token"); chat_id = data.get("chat_id")
        message = data.get("message", "Envio manual via backend.")
    res = _tg_send(bot_token, chat_id, message)
    return jsonify({"success": bool(res.get("ok")), "response": res})

def _tail_consecutive(seq, cond):
    c = 0
    for x in reversed(seq):
        if cond(x): c += 1
        else: break
    return c

def _ensure_bot_with_token(bot_id):
    b = Bot.query.get(bot_id)
    if not b:
        return None, "bot not found"
    if not b.telegram_token or not b.telegram_chat_id:
        return None, "bot missing telegram_token/chat_id"
    return b, None

@signal_bp.route("/signals/receive-game-data", methods=["POST"])
def receive_game_data():
    payload = request.get_json(silent=True) or {}
    bot_id = payload.get("bot_id")
    game_type = payload.get("game_type")
    g = payload.get("game_data") or {}
    try:
        mult = float(g.get("multiplier", 0.0))
    except Exception:
        return jsonify({"success": False, "error": "invalid multiplier"}), 400

    # resolver bot
    if not bot_id:
        q = Bot.query
        if game_type: q = q.filter_by(game_type=game_type)
        q = q.filter(Bot.is_active==True, Bot.telegram_token.isnot(None), Bot.telegram_chat_id.isnot(None)).order_by(Bot.id.desc())
        b = q.first()
        if not b:
            return jsonify({"success": False, "error": "no active bot with token/chat found"}), 400
        bot_id = b.id
    b, err = _ensure_bot_with_token(bot_id)
    if err:
        return jsonify({"success": False, "error": err}), 400

    # atualizar buffers
    buf = RING.setdefault(bot_id, [])
    buf.append(mult)
    if len(buf) > 20: buf.pop(0)
    EVENT_COUNT[bot_id] = EVENT_COUNT.get(bot_id, 0) + 1
    ev_idx = EVENT_COUNT[bot_id]

    # carregar strategies ativas
    strats = Strategy.query.filter_by(bot_id=bot_id, is_active=True).all()
    out = {"pre": [], "confirmed": []}

    for s in strats:
        if s.pattern == "low-mults":
            need = 3
            tail = _tail_consecutive(buf, lambda m: m < 2.0)
            key = (bot_id, s.pattern)
            # pre-sinal
            if tail == need - 1 and LAST_PRE.get(key, -1) != ev_idx:
                text = "PRE-SINAL (low-mults): faltando 1 para confirmar. observados %d consecutivos < 2.0. acao: %s" % (tail, (s.action or "entry_2.5x"))
                _tg_send(b.telegram_token, b.telegram_chat_id, text)
                LAST_PRE[key] = ev_idx
                out["pre"].append({"strategy_id": s.id, "tail": tail})
            # confirmado
            if tail >= need and LAST_CONF.get(key, -1) != ev_idx:
                text = "CONFIRMADO (low-mults): padrao completo. %d consecutivos < 2.0. acao: %s" % (need, (s.action or "entry_2.5x"))
                _tg_send(b.telegram_token, b.telegram_chat_id, text)
                LAST_CONF[key] = ev_idx
                out["confirmed"].append({"strategy_id": s.id, "tail": tail})

    return jsonify({"success": True, "bot_id": bot_id, "mult": mult, "buf_len": len(buf), "result": out})

@signal_bp.route("/signals/start-monitoring/<int:bot_id>", methods=["GET","POST"])
def start_monitoring(bot_id):
    return jsonify({"success": True, "message": "monitor accepted for bot %d" % bot_id})

def _monitor_bot_signals(bot_id: int):
    while True:
        time.sleep(30)
