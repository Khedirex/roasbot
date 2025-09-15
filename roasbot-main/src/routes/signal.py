from flask import Blueprint, request, jsonify
from src.models.user import db
from src.models.bot import Bot, Strategy, GameResult
from src.services.telegram_service import TelegramService
from src.services.signal_analyzer import SignalAnalyzer
from datetime import datetime
import json
import threading
import time

signal_bp = Blueprint('signal', __name__)
analyzer = SignalAnalyzer()

@signal_bp.route('/signals/test-telegram', methods=['POST'])
def test_telegram():
    """Testar conexão com Telegram"""
    try:
        data = request.get_json()
        bot_token = data.get('bot_token')
        chat_id = data.get('chat_id')
        
        if not bot_token or not chat_id:
            return jsonify({
                'success': False,
                'error': 'bot_token e chat_id são obrigatórios'
            }), 400
        
        telegram = TelegramService(bot_token)
        result = telegram.test_connection(chat_id)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@signal_bp.route('/signals/send-manual', methods=['POST'])
def send_manual_signal():
    """Enviar sinal manual"""
    try:
        data = request.get_json()
        bot_id = data.get('bot_id')
        message = data.get('message')
        
        if not bot_id or not message:
            return jsonify({
                'success': False,
                'error': 'bot_id e message são obrigatórios'
            }), 400
        
        bot = Bot.query.get(bot_id)
        if not bot:
            return jsonify({
                'success': False,
                'error': 'Robô não encontrado'
            }), 404
        
        telegram = TelegramService(bot.telegram_token)
        result = telegram.send_message(bot.telegram_chat_id, message)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@signal_bp.route('/signals/analyze', methods=['POST'])
def analyze_signals():
    """Analisar sinais para um jogo específico"""
    try:
        data = request.get_json()
        game_type = data.get('game_type')
        game_data = data.get('game_data', {})
        
        if not game_type:
            return jsonify({
                'success': False,
                'error': 'game_type é obrigatório'
            }), 400
        
        # Buscar estratégias ativas para o tipo de jogo
        bots = Bot.query.filter_by(game_type=game_type, is_active=True).all()
        strategies = []
        
        for bot in bots:
            bot_strategies = Strategy.query.filter_by(bot_id=bot.id, is_active=True).all()
            strategies.extend([s.to_dict() for s in bot_strategies])
        
        # Analisar sinais
        signals = analyzer.analyze_game_data(game_type, game_data, strategies)
        
        return jsonify({
            'success': True,
            'data': {
                'signals_detected': len(signals),
                'signals': signals,
                'game_stats': analyzer.get_game_statistics(game_type)
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@signal_bp.route('/signals/simulate-game', methods=['POST'])
def simulate_game():
    """Simular dados de jogo para teste"""
    try:
        data = request.get_json()
        game_type = data.get('game_type', 'mines')
        
        # Simular dados do jogo
        game_data = analyzer.simulate_game_data(game_type)
        
        # Analisar sinais baseado nos dados simulados
        bots = Bot.query.filter_by(game_type=game_type, is_active=True).all()
        strategies = []
        
        for bot in bots:
            bot_strategies = Strategy.query.filter_by(bot_id=bot.id, is_active=True).all()
            strategies.extend([s.to_dict() for s in bot_strategies])
        
        signals = analyzer.analyze_game_data(game_type, game_data, strategies)
        
        # Enviar sinais detectados
        sent_signals = []
        for signal in signals:
            strategy_id = signal['strategy_id']
            strategy = Strategy.query.get(strategy_id)
            
            if strategy and strategy.bot:
                telegram = TelegramService(strategy.bot.telegram_token)
                
                # Usar mensagem personalizada se disponível
                if strategy.custom_message and not strategy.use_default_message:
                    message = strategy.custom_message
                else:
                    message = None
                
                result = telegram.send_signal_message(
                    strategy.bot.telegram_chat_id,
                    game_type,
                    signal['signal_data'],
                    message
                )
                
                if result['success']:
                    # Registrar resultado
                    game_result = GameResult(
                        strategy_id=strategy_id,
                        game_data=json.dumps(game_data),
                        signal_sent=True,
                        timestamp=datetime.utcnow()
                    )
                    db.session.add(game_result)
                    
                    # Atualizar estatísticas da estratégia
                    strategy.total_signals += 1
                    
                    sent_signals.append({
                        'strategy_id': strategy_id,
                        'signal': signal,
                        'telegram_result': result
                    })
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'game_data': game_data,
                'signals_sent': len(sent_signals),
                'sent_signals': sent_signals
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@signal_bp.route('/signals/start-monitoring/<int:bot_id>', methods=['POST'])
def start_monitoring(bot_id):
    """Iniciar monitoramento automático para um robô"""
    try:
        bot = Bot.query.get_or_404(bot_id)
        
        # Verificar se já existe um thread de monitoramento
        thread_name = f"monitor_bot_{bot_id}"
        
        # Iniciar thread de monitoramento
        monitor_thread = threading.Thread(
            target=_monitor_bot_signals,
            args=(bot_id,),
            name=thread_name,
            daemon=True
        )
        monitor_thread.start()
        
        return jsonify({
            'success': True,
            'message': f'Monitoramento iniciado para o robô {bot.name}'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def _monitor_bot_signals(bot_id: int):
    """Função para monitorar sinais de um robô em background"""
    try:
        while True:
            bot = Bot.query.get(bot_id)
            if not bot or not bot.is_active:
                break
            
            # Simular coleta de dados do jogo (em produção, conectar com API real)
            game_data = analyzer.simulate_game_data(bot.game_type)
            
            # Buscar estratégias ativas do robô
            strategies = Strategy.query.filter_by(bot_id=bot_id, is_active=True).all()
            strategy_dicts = [s.to_dict() for s in strategies]
            
            # Analisar sinais
            signals = analyzer.analyze_game_data(bot.game_type, game_data, strategy_dicts)
            
            # Enviar sinais detectados
            for signal in signals:
                strategy = Strategy.query.get(signal['strategy_id'])
                if strategy:
                    telegram = TelegramService(bot.telegram_token)
                    
                    message = strategy.custom_message if not strategy.use_default_message else None
                    
                    result = telegram.send_signal_message(
                        bot.telegram_chat_id,
                        bot.game_type,
                        signal['signal_data'],
                        message
                    )
                    
                    if result['success']:
                        # Registrar resultado
                        game_result = GameResult(
                            strategy_id=strategy.id,
                            game_data=json.dumps(game_data),
                            signal_sent=True,
                            timestamp=datetime.utcnow()
                        )
                        db.session.add(game_result)
                        strategy.total_signals += 1
            
            db.session.commit()
            
            # Aguardar antes da próxima análise (30 segundos)
            time.sleep(30)
            
    except Exception as e:
        print(f"Erro no monitoramento do robô {bot_id}: {str(e)}")

@signal_bp.route('/signals/game-stats/<game_type>', methods=['GET'])
def get_game_stats(game_type):
    """Obter estatísticas de um tipo de jogo"""
    try:
        stats = analyzer.get_game_statistics(game_type)
        
        return jsonify({
            'success': True,
            'data': stats
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

