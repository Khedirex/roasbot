from flask import Blueprint, request, jsonify
from src.models.user import db
from src.models.bot import Bot, Strategy, GameResult
from datetime import datetime
import json

bot_bp = Blueprint('bot', __name__)

@bot_bp.route('/bots', methods=['GET'])
def get_bots():
    """Listar todos os robôs"""
    try:
        bots = Bot.query.all()
        return jsonify({
            'success': True,
            'data': [bot.to_dict() for bot in bots]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bot_bp.route('/bots', methods=['POST'])
def create_bot():
    """Criar novo robô"""
    try:
        data = request.get_json()
        
        # Validação básica
        required_fields = ['name', 'game_type', 'casino_site', 'telegram_token', 'telegram_chat_id']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Campo obrigatório: {field}'
                }), 400
        
        bot = Bot(
            name=data['name'],
            game_type=data['game_type'],
            casino_site=data['casino_site'],
            telegram_token=data['telegram_token'],
            telegram_chat_id=data['telegram_chat_id'],
            is_active=data.get('is_active', True)
        )
        
        db.session.add(bot)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': bot.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bot_bp.route('/bots/<int:bot_id>', methods=['PUT'])
def update_bot(bot_id):
    """Atualizar robô"""
    try:
        bot = Bot.query.get_or_404(bot_id)
        data = request.get_json()
        
        # Atualizar campos permitidos
        allowed_fields = ['name', 'game_type', 'casino_site', 'telegram_token', 'telegram_chat_id', 'is_active']
        for field in allowed_fields:
            if field in data:
                setattr(bot, field, data[field])
        
        bot.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': bot.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bot_bp.route('/bots/<int:bot_id>', methods=['DELETE'])
def delete_bot(bot_id):
    """Deletar robô"""
    try:
        bot = Bot.query.get_or_404(bot_id)
        db.session.delete(bot)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Robô deletado com sucesso'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bot_bp.route('/bots/<int:bot_id>/strategies', methods=['GET'])
def get_bot_strategies(bot_id):
    """Listar estratégias de um robô"""
    try:
        bot = Bot.query.get_or_404(bot_id)
        strategies = Strategy.query.filter_by(bot_id=bot_id).all()
        
        return jsonify({
            'success': True,
            'data': [strategy.to_dict() for strategy in strategies]
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bot_bp.route('/strategies', methods=['POST'])
def create_strategy():
    """Criar nova estratégia"""
    try:
        data = request.get_json()
        
        # Validação básica
        required_fields = ['name', 'bot_id', 'pattern', 'action']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Campo obrigatório: {field}'
                }), 400
        
        # Verificar se o bot existe
        bot = Bot.query.get(data['bot_id'])
        if not bot:
            return jsonify({
                'success': False,
                'error': 'Robô não encontrado'
            }), 404
        
        strategy = Strategy(
            name=data['name'],
            bot_id=data['bot_id'],
            pattern=data['pattern'],
            action=data['action'],
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            custom_message=data.get('custom_message'),
            use_default_message=data.get('use_default_message', True),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(strategy)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': strategy.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bot_bp.route('/strategies/<int:strategy_id>', methods=['PUT'])
def update_strategy(strategy_id):
    """Atualizar estratégia"""
    try:
        strategy = Strategy.query.get_or_404(strategy_id)
        data = request.get_json()
        
        # Atualizar campos permitidos
        allowed_fields = ['name', 'pattern', 'action', 'start_time', 'end_time', 
                         'custom_message', 'use_default_message', 'is_active']
        for field in allowed_fields:
            if field in data:
                setattr(strategy, field, data[field])
        
        strategy.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': strategy.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bot_bp.route('/strategies/<int:strategy_id>/reset-stats', methods=['POST'])
def reset_strategy_stats(strategy_id):
    """Zerar estatísticas de uma estratégia"""
    try:
        strategy = Strategy.query.get_or_404(strategy_id)
        
        strategy.total_signals = 0
        strategy.wins = 0
        strategy.losses = 0
        strategy.wins_no_gale = 0
        strategy.wins_with_gale = 0
        strategy.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Estatísticas zeradas com sucesso',
            'data': strategy.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@bot_bp.route('/strategies/<int:strategy_id>/results', methods=['GET'])
def get_strategy_results(strategy_id):
    """Obter resultados de uma estratégia"""
    try:
        strategy = Strategy.query.get_or_404(strategy_id)
        results = GameResult.query.filter_by(strategy_id=strategy_id).order_by(GameResult.timestamp.desc()).limit(100).all()
        
        return jsonify({
            'success': True,
            'data': [result.to_dict() for result in results]
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

